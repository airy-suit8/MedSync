"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { format, parseISO } from "date-fns"
import { CalendarCheck, FileSignature, FileText, Stethoscope, UserPlus } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { testLabel } from "@/lib/utils"

type Entry = { kind: string; ref_id: string; happened_at: string | null; title: string; detail: string | null; doctor_name: string | null }

const ICONS = { report: FileText, review: Stethoscope, prescription: FileSignature, consultation: CalendarCheck, care: UserPlus }

// The database writes "X Ray report reviewed"; show the test's proper name ("X-ray report reviewed").
const tidy = (e: Entry) =>
  e.kind === "report" || e.kind === "review" ? e.title.replace(/^(.*?) report( reviewed)?$/, (_, t, r) => `${testLabel(t)} report${r || ""}`) : e.title

// Everything in a patient's care, newest first, grouped by day (get_patient_timeline: the
// patient and their current doctors). Each entry links to its page for the viewer's role.
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

  const days: { day: string; items: Entry[] }[] = []
  for (const e of entries) {
    const day = e.happened_at ? format(parseISO(e.happened_at), "d MMM yyyy") : "Undated"
    if (days[days.length - 1]?.day !== day) days.push({ day, items: [] })
    days[days.length - 1].items.push(e)
  }

  return (
    <ol className="max-w-3xl">
      {days.map(({ day, items }, d) => (
        <li key={day} className="grid gap-x-8 sm:grid-cols-[7rem_1fr]">
          <h3 className="pb-3 font-mono text-xs uppercase tracking-widest text-black/60 sm:pb-0 sm:pt-1.5 sm:text-right">{day}</h3>
          <ol className={`ml-3.5 border-l border-black/20 sm:ml-0 ${d === days.length - 1 ? "pb-0" : "pb-8"}`}>
            {items.map((e, i) => {
              const Icon = ICONS[e.kind as keyof typeof ICONS] || FileText
              const href = linkFor(e)
              const showDoctor = e.doctor_name && e.kind !== "care"
              const body = (
                <>
                  <p className="font-bold leading-snug">{tidy(e)}</p>
                  {showDoctor && <p className="mt-0.5 font-mono text-xs uppercase text-black/60">{e.doctor_name}</p>}
                  {e.detail && <p className="mt-1.5 line-clamp-2 text-sm text-black/80">{e.detail}</p>}
                </>
              )
              return (
                <li key={`${e.kind}-${e.ref_id}-${i}`} className={`relative pl-8 ${i === items.length - 1 ? "" : "pb-6"}`}>
                  <span className="absolute left-0 top-0 flex h-7 w-7 -translate-x-1/2 items-center justify-center border border-black bg-white">
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  <div className="pt-0.5">
                    {href ? <Link href={href} className="block hover:underline underline-offset-4">{body}</Link> : body}
                  </div>
                </li>
              )
            })}
          </ol>
        </li>
      ))}
    </ol>
  )
}
