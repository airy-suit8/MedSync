"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { format, parseISO } from "date-fns"
import { Download, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import DashboardShell from "@/components/medical/common/DashboardShell"
import { createClient } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import { testLabel } from "@/lib/utils"

type Row = {
  id: string; patient_id: string; test_type: string; original_name: string; file_name: string; uploaded_at: string
  priority: string | null; ai_status: string | null; doctor_id: string | null
}
type Filter = "all" | "todo" | "done" | "urgent"

const URGENT = ["urgent", "critical", "high"]
const AI_LABEL: Record<string, string> = { pending: "Waiting", running: "AI reading", done: "AI read", failed: "AI failed", not_applicable: "No AI" }

// Every report of every patient this doctor treats (RLS: patients with an active link, so a
// second-opinion doctor sees earlier reports too). Each row opens the report to review it.
export default function DoctorReportsPage() {
  return (
    <DashboardShell role="doctor" label="REPORTS" title="Reports" intro="Reports from your patients' labs. Open one to see the scan, the AI's reading and to write your review.">
      {(user) => <Reports doctorId={user.id} />}
    </DashboardShell>
  )
}

function Reports({ doctorId }: { doctorId: string }) {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [people, setPeople] = useState<Map<string, { name: string | null; short_id: string | null }>>(new Map())
  const [reviewed, setReviewed] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState<Filter>("all")
  const [query, setQuery] = useState("")
  const { toast } = useToast()

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data } = await supabase.from("reports")
        .select("id, patient_id, test_type, original_name, file_name, uploaded_at, priority, ai_status, doctor_id")
        .order("uploaded_at", { ascending: false })
      const list: Row[] = data || []
      const ids = list.map((r) => r.id)
      const patientIds = Array.from(new Set(list.map((r) => r.patient_id)))
      const [{ data: dir }, { data: mine }] = await Promise.all([
        patientIds.length ? supabase.from("profile_directory").select("id, name, short_id").in("id", patientIds) : Promise.resolve({ data: [] }),
        ids.length ? supabase.from("report_reviews").select("report_id").eq("doctor_id", doctorId).in("report_id", ids) : Promise.resolve({ data: [] }),
      ])
      setPeople(new Map((dir || []).map((p: { id: string; name: string | null; short_id: string | null }) => [p.id, p])))
      setReviewed(new Set((mine || []).map((r: { report_id: string }) => r.report_id)))
      setRows(list)
    }
    load()
  }, [doctorId])

  const download = async (r: Row) => {
    const { data, error } = await createClient().storage.from("reports").download(r.file_name)
    if (error || !data) {
      toast({ title: "Download failed", description: "The file may be missing, or you may not have access to it.", variant: "destructive" })
      return
    }
    const url = URL.createObjectURL(data)
    const a = Object.assign(document.createElement("a"), { href: url, download: r.original_name })
    a.click()
    URL.revokeObjectURL(url)
  }

  if (rows === null) return <p className="text-sm text-black/60">Loading…</p>

  const isUrgent = (r: Row) => URGENT.includes((r.priority || "").toLowerCase())
  const counts: [Filter, string, number][] = [
    ["all", "All", rows.length],
    ["todo", "To review", rows.filter((r) => !reviewed.has(r.id)).length],
    ["done", "Reviewed by you", rows.filter((r) => reviewed.has(r.id)).length],
    ["urgent", "Urgent", rows.filter(isUrgent).length],
  ]
  const q = query.trim().toLowerCase()
  const shown = rows.filter((r) =>
    (filter === "all" || (filter === "todo" && !reviewed.has(r.id)) || (filter === "done" && reviewed.has(r.id)) || (filter === "urgent" && isUrgent(r))) &&
    (!q || [people.get(r.patient_id)?.name, people.get(r.patient_id)?.short_id, testLabel(r.test_type)].some((s) => s?.toLowerCase().includes(q))))

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-px border border-black/10 bg-black/10 lg:grid-cols-4" role="group" aria-label="Show">
        {counts.map(([key, label, n]) => (
          <button key={key} type="button" onClick={() => setFilter(key)} aria-pressed={filter === key}
            className={`p-5 text-left ${filter === key ? "bg-black text-white" : "bg-white hover:bg-black/[0.03]"}`}>
            <span className={`block font-mono text-[11px] uppercase tracking-widest ${filter === key ? "text-white/70" : "text-black/60"}`}>{label}</span>
            <span className="mt-1 block text-3xl font-bold">{n}</span>
          </button>
        ))}
      </div>

      <div className="relative max-w-xl">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-black/50" aria-hidden="true" />
        <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by patient, Patient ID or test"
          aria-label="Search reports" className="h-12 rounded-none border-black/20 pl-11 focus:border-black" />
      </div>

      {shown.length === 0 ? (
        <p className="border border-dashed border-black/20 p-8 text-sm text-black/60">
          {rows.length === 0 ? "No reports yet. They appear here when a lab uploads one for a patient you're treating." : "No reports match."}
        </p>
      ) : (
        <ul className="divide-y divide-black/10 border-y border-black/10">
          {shown.map((r) => {
            const p = people.get(r.patient_id)
            return (
              <li key={r.id} className="flex flex-wrap items-center gap-x-6 gap-y-3 py-4">
                <Link href={`/doctor-dashboard/reports/${r.id}`} className="group min-w-0 flex-1 basis-64">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-bold group-hover:underline underline-offset-4">{testLabel(r.test_type)}</span>
                    {isUrgent(r) && <span className="border border-red-700 px-1.5 font-mono text-[10px] uppercase text-red-700">{r.priority}</span>}
                  </span>
                  <span className="mt-0.5 block truncate text-sm text-black/70">
                    {p?.name || "Patient"}{p?.short_id ? ` · ${p.short_id}` : ""}
                  </span>
                  <span className="mt-0.5 block font-mono text-xs uppercase text-black/60">
                    {format(parseISO(r.uploaded_at), "d MMM yyyy")}{r.doctor_id && r.doctor_id !== doctorId ? " · sent to another doctor" : ""}
                  </span>
                </Link>
                <span className="flex items-center gap-2 font-mono text-[10px] uppercase">
                  <span className="border border-black/20 px-2 py-0.5">{AI_LABEL[r.ai_status || ""] || "No AI"}</span>
                  <span className={`border px-2 py-0.5 ${reviewed.has(r.id) ? "border-black" : "border-amber-700 text-amber-800"}`}>
                    {reviewed.has(r.id) ? "Reviewed" : "To review"}
                  </span>
                </span>
                <button type="button" onClick={() => download(r)} aria-label={`Download ${r.original_name}`}
                  className="inline-flex h-10 w-10 items-center justify-center border border-black/20 hover:border-black">
                  <Download className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
