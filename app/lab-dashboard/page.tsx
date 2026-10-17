"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { format, isAfter, parseISO, subDays } from "date-fns"
import { ArrowRight, Camera, FlaskConical, Upload } from "lucide-react"
import DashboardShell from "@/components/medical/common/DashboardShell"
import { createClient } from "@/lib/supabase"
import { testLabel } from "@/lib/utils"

type LabUpload = {
  id: string
  test_type: string | null
  priority: string | null
  uploaded_at: string
  ai_status: string | null
  patient_info: { fullName?: string; name?: string } | null
}

const URGENT = ["urgent", "critical", "high"]
const AI_TEXT: Record<string, string> = {
  pending: "Sent to doctor", running: "AI reading", done: "AI reading ready", failed: "AI could not read it", not_applicable: "Sent to doctor",
}

// The lab's home: what was uploaded, what is urgent, and the three things a lab does.
export default function LabDashboard() {
  return (
    <DashboardShell role="lab" label="LABORATORY" title="Lab dashboard" intro="Upload reports for your patients' doctors, and track samples and imaging.">
      {(user) => <LabHome labId={user.id} />}
    </DashboardShell>
  )
}

function LabHome({ labId }: { labId: string }) {
  const [uploads, setUploads] = useState<LabUpload[] | null>(null)
  const [openSamples, setOpenSamples] = useState<number | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.from("reports").select("id, test_type, priority, uploaded_at, ai_status, patient_info")
      .eq("uploaded_by", labId).order("uploaded_at", { ascending: false }).limit(200)
      .then(({ data }: { data: LabUpload[] | null }) => setUploads(data || []))
    supabase.from("lab_samples").select("id", { count: "exact", head: true }).eq("lab_id", labId).neq("status", "completed")
      .then(({ count }: { count: number | null }) => setOpenSamples(count ?? 0))
  }, [labId])

  if (uploads === null) return <p className="text-sm text-black/60">Loading…</p>

  const weekAgo = subDays(new Date(), 7)
  const urgent = uploads.filter((u) => URGENT.includes((u.priority || "").toLowerCase()))
  const stats: [string, number | null, string][] = [
    ["Reports uploaded", uploads.length, "/lab-dashboard/upload"],
    ["In the last 7 days", uploads.filter((u) => isAfter(parseISO(u.uploaded_at), weekAgo)).length, "/lab-dashboard/upload"],
    ["Urgent or high priority", urgent.length, "/lab-dashboard/upload"],
    ["Samples in progress", openSamples, "/lab-dashboard/samples"],
  ]
  const actions = [
    { title: "Upload a report", text: "Send a scan or test result to the patient's doctor.", href: "/lab-dashboard/upload", icon: Upload },
    { title: "Samples", text: "Log blood and urine samples and update their status.", href: "/lab-dashboard/samples", icon: FlaskConical },
    { title: "Imaging", text: "Schedule studies and send finished images to a doctor.", href: "/lab-dashboard/imaging", icon: Camera },
  ]

  return (
    <div className="space-y-12">
      <dl className="grid grid-cols-2 gap-px border border-black/10 bg-black/10 lg:grid-cols-4">
        {stats.map(([label, value, href]) => (
          <Link key={label} href={href} className="bg-white p-6 hover:bg-black/[0.02]">
            <dt className="font-mono text-[11px] uppercase tracking-widest text-black/60">{label}</dt>
            <dd className="mt-2 text-4xl font-bold tracking-tight">{value ?? "–"}</dd>
          </Link>
        ))}
      </dl>

      <div className="grid gap-px border border-black/10 bg-black/10 md:grid-cols-3">
        {actions.map(({ title, text, href, icon: Icon }) => (
          <Link key={href} href={href} className="group flex flex-col bg-white p-6 hover:bg-black hover:text-white">
            <Icon className="h-6 w-6" aria-hidden="true" />
            <span className="mt-6 text-xl font-bold">{title}</span>
            <span className="mt-1 text-sm text-black/60 group-hover:text-white/70">{text}</span>
            <ArrowRight className="mt-6 h-4 w-4" aria-hidden="true" />
          </Link>
        ))}
      </div>

      <div className="grid gap-12 lg:grid-cols-2">
        <UploadList title="Urgent uploads" rows={urgent.slice(0, 5)} empty="No urgent uploads." />
        <UploadList title="Recent uploads" rows={uploads.slice(0, 5)} empty="Nothing uploaded yet." more />
      </div>
    </div>
  )
}

function UploadList({ title, rows, empty, more }: { title: string; rows: LabUpload[]; empty: string; more?: boolean }) {
  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-xl font-bold tracking-tight">{title}</h2>
        {more && rows.length > 0 && (
          <Link href="/lab-dashboard/upload" className="font-mono text-xs uppercase tracking-widest underline underline-offset-4">Upload page</Link>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="border border-dashed border-black/20 p-6 text-sm text-black/60">{empty}</p>
      ) : (
        <ul className="divide-y divide-black/10 border-y border-black/10">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-4">
              <div className="min-w-0">
                <p className="font-bold">{testLabel(r.test_type)}</p>
                <p className="truncate text-sm text-black/70">{r.patient_info?.fullName || r.patient_info?.name || "Patient"}</p>
              </div>
              <div className="text-right font-mono text-xs uppercase text-black/60">
                <p>{format(parseISO(r.uploaded_at), "d MMM yyyy")}</p>
                <p className="mt-1">
                  {URGENT.includes((r.priority || "").toLowerCase()) && <span className="mr-2 border border-red-700 px-1.5 text-red-700">{r.priority}</span>}
                  {AI_TEXT[r.ai_status || ""] || "Sent to doctor"}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
