"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { format, parseISO } from "date-fns"
import { FileSignature } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { PRESCRIPTIONS_CHANGED, type Prescription } from "@/lib/prescriptions"

// A patient's prescriptions (optionally only those from one report or consultation),
// each linking to its printable page. Shown to the patient and their doctors.
export default function PrescriptionList({ patientId, reportId, appointmentId, refreshKey = 0, emptyText }: {
  patientId: string
  reportId?: string
  appointmentId?: string
  refreshKey?: number
  emptyText?: string
}) {
  const [rows, setRows] = useState<Prescription[] | null>(null)
  const [changes, setChanges] = useState(0)

  // PrescriptionForm announces new prescriptions so lists elsewhere on the page update.
  useEffect(() => {
    const bump = () => setChanges((n) => n + 1)
    window.addEventListener(PRESCRIPTIONS_CHANGED, bump)
    return () => window.removeEventListener(PRESCRIPTIONS_CHANGED, bump)
  }, [])

  useEffect(() => {
    let query = createClient().from("prescriptions").select("*").eq("patient_id", patientId).order("created_at", { ascending: false })
    if (reportId) query = query.eq("report_id", reportId)
    if (appointmentId) query = query.eq("appointment_id", appointmentId)
    query.then(({ data }: { data: Prescription[] | null }) => setRows(data || []))
  }, [patientId, reportId, appointmentId, refreshKey, changes])

  if (rows === null) return null
  if (rows.length === 0) return emptyText ? <p className="text-sm text-black/60">{emptyText}</p> : null

  return (
    <ul className="divide-y divide-black/10 border-y border-black/10">
      {rows.map((rx) => (
        <li key={rx.id}>
          <Link href={`/prescriptions/${rx.id}`} className="flex items-start justify-between gap-4 py-4 hover:bg-black/[0.02]">
            <span className="flex items-start gap-3">
              <FileSignature className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                <span className="block font-bold">{rx.items.map((i) => i.medicine).join(", ")}</span>
                <span className="block font-mono text-xs uppercase text-black/60">
                  {rx.doctor_name} · {format(parseISO(rx.created_at), "d MMM yyyy")}
                </span>
              </span>
            </span>
            {rx.status === "cancelled" && <span className="border border-red-700 px-2 py-0.5 font-mono text-[10px] uppercase text-red-700">Cancelled</span>}
          </Link>
        </li>
      ))}
    </ul>
  )
}
