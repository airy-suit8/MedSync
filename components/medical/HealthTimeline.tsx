"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { format, parseISO } from "date-fns"
import { CalendarCheck, FileSignature, FileText, Stethoscope, UserPlus } from "lucide-react"
import { createClient } from "@/lib/supabase"

type Entry = { kind: string; ref_id: string; happened_at: string | null; title: string; detail: string | null; doctor_name: string | null }

const ICONS = { report: FileText, review: Stethoscope, prescription: FileSignature, consultation: CalendarCheck, care: UserPlus }

// Everything in a patient's care, newest first (get_patient_timeline: the patient and
// their current doctors). Each entry links to its page for the viewer's role.
export default function HealthTimeline({ patientId, viewer }: { patientId: string; viewer: "patient" | "doctor" }) {
  const [entries, setEntries] = useState<Entry[] | null>(null)

  useEffect(() => {
    createClient().rpc("get_patient_timeline", { p_patient_id: patientId })
      .then(({ data }: { data: Entry[] | null }) => setEntries(data || []))
  }, [patientId])

  const linkFor = (e: Entry) => {
    if (e.kind === "report" || e.kind === "review") return `/${viewer}-dashboard/reports/${e.ref_id}`
    if (e.kind === "prescription") return `/prescriptions/${e.ref_id}`
    if (e.kind === "consultation") return viewer === "patient" ? "/patient-dashboard/video-consultations" : null
    return null
  }

  if (entries === null) return <p className="text-sm text-black/60">Loading…</p>
  if (entries.length === 0) return <p className="border border-dashed border-black/20 p-6 text-sm text-black/60">Nothing here yet.</p>

  return (
    <ol className="relative border-l border-black/20 pl-6">
      {entries.map((e, i) => {
        const Icon = ICONS[e.kind as keyof typeof ICONS] || FileText
        const href = linkFor(e)
        const body = (
          <>
            <p className="font-bold">{e.title}</p>
            <p className="font-mono text-xs uppercase text-black/60">
              {e.happened_at ? format(parseISO(e.happened_at), "d MMM yyyy") : ""}
              {e.doctor_name && e.kind !== "care" ? ` · ${e.doctor_name}` : ""}
            </p>
            {e.detail && <p className="mt-1 line-clamp-2 text-sm text-black/80">{e.detail}</p>}
          </>
        )
        return (
          <li key={`${e.kind}-${e.ref_id}-${i}`} className="relative pb-6">
            <span className="absolute -left-[2.15rem] top-0 flex h-7 w-7 items-center justify-center border border-black bg-white">
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            {href ? <Link href={href} className="block hover:underline underline-offset-4">{body}</Link> : <div>{body}</div>}
          </li>
        )
      })}
    </ol>
  )
}
