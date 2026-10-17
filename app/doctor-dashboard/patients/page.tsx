"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { format, parseISO } from "date-fns"
import { Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import DashboardShell from "@/components/medical/common/DashboardShell"
import ConsultationRequests from "@/components/medical/ConsultationRequests"
import EndCareButton from "@/components/medical/EndCareButton"
import { createClient } from "@/lib/supabase"

type Patient = {
  patient_id: string
  patient_short_id: string | null
  patient_name: string
  assigned_at: string | null
  total_reports: number
}

export default function DoctorPatientsPage() {
  return (
    <DashboardShell
      role="doctor"
      label="MY PATIENTS"
      title="Patients"
      intro="Patients you're looking after. New patients reach you through a consultation request, or you can schedule one with their Patient ID."
    >
      {(user) => <Patients doctorId={user.id} />}
    </DashboardShell>
  )
}

function Patients({ doctorId }: { doctorId: string }) {
  const [patients, setPatients] = useState<Patient[]>([])
  const [query, setQuery] = useState("")

  const load = useCallback(async () => {
    const { data } = await createClient().rpc("get_doctor_patients_bulletproof", { doctor_uuid: doctorId })
    setPatients(data || [])
  }, [doctorId])

  useEffect(() => { load() }, [load])

  // Doctors search only their own patients, by name or Patient ID.
  const q = query.trim().toLowerCase()
  const results = patients.filter((p) =>
    !q || p.patient_name.toLowerCase().includes(q) || (p.patient_short_id || "").toLowerCase().includes(q))

  return (
    <div className="space-y-12">
      <ConsultationRequests doctorId={doctorId} onAnswered={load} />

      <section aria-labelledby="patient-list">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <h2 id="patient-list" className="text-xl font-bold tracking-tight">Your patients ({patients.length})</h2>
          <Button variant="outline" asChild className="rounded-none border-black font-mono text-xs uppercase tracking-widest">
            <Link href="/doctor-dashboard/schedule">Schedule with a Patient ID</Link>
          </Button>
        </div>

        <div className="relative mb-6 max-w-xl">
          <Label htmlFor="patient-search" className="sr-only">Search your patients</Label>
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-black/55" aria-hidden="true" />
          <Input
            id="patient-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or Patient ID"
            className="h-12 rounded-none border-black/20 pl-11 focus:border-black"
          />
        </div>

        {patients.length === 0 ? (
          <p className="border border-dashed border-black/20 p-6 text-sm text-black/60">
            No patients yet. When a patient sends you a request, it appears above.
          </p>
        ) : results.length === 0 ? (
          <p className="text-sm text-black/60">None of your patients match “{query}”.</p>
        ) : (
          <ul className="divide-y divide-black/10 border-y border-black/10">
            {results.map((p) => (
              <li key={p.patient_id} className="flex flex-col gap-4 py-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <Link href={`/doctor-dashboard/patients/${p.patient_id}`} className="font-bold hover:underline underline-offset-4">{p.patient_name}</Link>
                  <p className="font-mono text-xs text-black/60 tabular-nums">
                    {p.patient_short_id && `ID ${p.patient_short_id}`}
                    {p.assigned_at && ` · since ${format(parseISO(p.assigned_at), "d MMM yyyy")}`}
                    {` · ${p.total_reports} ${Number(p.total_reports) === 1 ? "report" : "reports"}`}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="ghost" asChild className="rounded-none font-mono text-xs uppercase tracking-widest">
                    <Link href={`/doctor-dashboard/communication?patient=${p.patient_id}`}>Message</Link>
                  </Button>
                  <Button variant="ghost" asChild className="rounded-none font-mono text-xs uppercase tracking-widest">
                    <Link href={`/doctor-dashboard/patients/${p.patient_id}`}>Open record</Link>
                  </Button>
                  <EndCareButton otherId={p.patient_id} otherName={p.patient_name} role="doctor" onEnded={load} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
