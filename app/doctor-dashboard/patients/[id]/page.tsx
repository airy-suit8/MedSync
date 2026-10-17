"use client"

import { use, useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { differenceInYears, format, parseISO } from "date-fns"
import { AlertTriangle, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import DashboardShell from "@/components/medical/common/DashboardShell"
import EndCareButton from "@/components/medical/EndCareButton"
import HealthTimeline from "@/components/medical/HealthTimeline"
import PrescriptionForm from "@/components/medical/PrescriptionForm"
import PrescriptionList from "@/components/medical/PrescriptionList"
import { createClient } from "@/lib/supabase"

type Record = {
  id: string; name: string | null; short_id: string | null; email: string | null; phone: string | null; address: string | null
  date_of_birth: string | null; gender: string | null; blood_type: string | null; height_cm: number | null; weight_kg: number | null
  allergies: string | null; current_medications: string | null; chronic_conditions: string | null; emergency_contact: string | null
}
type ReportRow = { id: string; test_type: string; uploaded_at: string; ai_status: string; doctor_id: string | null }

const AI_LABEL: { [k: string]: string } = { pending: "Waiting", running: "AI reading", done: "AI read", failed: "AI failed", not_applicable: "No AI" }

export default function PatientRecordPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <DashboardShell role="doctor" label="PATIENT RECORD" title="Patient record">
      {(user) => <PatientRecord patientId={id} doctorId={user.id} />}
    </DashboardShell>
  )
}

function PatientRecord({ patientId, doctorId }: { patientId: string; doctorId: string }) {
  const [record, setRecord] = useState<Record | null | undefined>(undefined)
  const [reports, setReports] = useState<ReportRow[]>([])
  const [reviewed, setReviewed] = useState<Set<string>>(new Set())
  const router = useRouter()

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase.rpc("get_patient_record", { p_patient_id: patientId })
    const row = Array.isArray(data) ? data[0] : data
    setRecord(row || null)
    if (!row) return
    const { data: reportRows } = await supabase.from("reports").select("id, test_type, uploaded_at, ai_status, doctor_id")
      .eq("patient_id", patientId).order("uploaded_at", { ascending: false })
    setReports(reportRows || [])
    const ids = (reportRows || []).map((r: ReportRow) => r.id)
    if (ids.length) {
      const { data: reviews } = await supabase.from("report_reviews").select("report_id").in("report_id", ids)
      setReviewed(new Set((reviews || []).map((r: { report_id: string }) => r.report_id)))
    }
  }, [patientId])

  useEffect(() => { load() }, [load])

  if (record === undefined) return <p className="text-sm text-black/60">Loading…</p>
  if (record === null) {
    return (
      <div className="max-w-xl border border-black p-8">
        <p className="font-bold">You are not treating this patient.</p>
        <p className="mt-2 text-sm text-black/70">Patients reach you through a consultation request, or you can schedule one with their Patient ID.</p>
        <Button asChild variant="outline" className="mt-6 rounded-none border-black font-mono text-xs uppercase tracking-widest">
          <Link href="/doctor-dashboard/patients"><ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />My patients</Link>
        </Button>
      </div>
    )
  }

  const name = record.name || "Patient"
  const age = record.date_of_birth ? differenceInYears(new Date(), parseISO(record.date_of_birth)) : null
  const facts: [string, string | null][] = [
    ["Age", age !== null ? `${age}` : null],
    ["Gender", record.gender ? record.gender.replace(/_/g, " ") : null],
    ["Blood group", record.blood_type],
    ["Height", record.height_cm ? `${record.height_cm} cm` : null],
    ["Weight", record.weight_kg ? `${record.weight_kg} kg` : null],
    ["Phone", record.phone],
    ["Emergency contact", record.emergency_contact],
  ]

  return (
    <div className="space-y-12">
      <div className="flex flex-col gap-6 border-b border-black/10 pb-8 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link href="/doctor-dashboard/patients" className="mb-3 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-black/60 hover:text-black">
            <ArrowLeft className="h-3 w-3" aria-hidden="true" />My patients
          </Link>
          <h2 className="text-3xl font-bold">{name}</h2>
          <p className="font-mono text-xs uppercase text-black/60">Patient ID {record.short_id}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PrescriptionForm patientId={patientId} patientName={name} />
          <Button asChild variant="ghost" className="h-12 rounded-none font-mono text-xs uppercase tracking-widest">
            <Link href={`/doctor-dashboard/communication?patient=${patientId}`}>Message</Link>
          </Button>
          <EndCareButton otherId={patientId} otherName={name} role="doctor" onEnded={() => router.push("/doctor-dashboard/patients")} />
        </div>
      </div>

      <div className="grid gap-12 lg:grid-cols-12">
        <section aria-labelledby="health" className="space-y-6 lg:col-span-5">
          <h2 id="health" className="text-xl font-bold tracking-tight">Health profile</h2>
          <div className={`border p-5 ${record.allergies && !/^none$/i.test(record.allergies.trim()) ? "border-red-700" : "border-black/20"}`}>
            <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-black/60">
              {record.allergies && !/^none$/i.test(record.allergies.trim()) && <AlertTriangle className="h-3.5 w-3.5 text-red-700" aria-hidden="true" />}
              Allergies
            </p>
            <p className="mt-1">{record.allergies || "Not given by the patient"}</p>
          </div>
          <dl className="space-y-4">
            <div>
              <dt className="font-mono text-[11px] uppercase tracking-widest text-black/60">Current medicines</dt>
              <dd className="mt-1">{record.current_medications || "Not given"}</dd>
            </div>
            <div>
              <dt className="font-mono text-[11px] uppercase tracking-widest text-black/60">Long-term conditions</dt>
              <dd className="mt-1">{record.chronic_conditions || "Not given"}</dd>
            </div>
          </dl>
          <dl className="grid grid-cols-2 gap-px border border-black/10 bg-black/10">
            {facts.map(([label, value]) => (
              <div key={label} className="bg-white p-4">
                <dt className="font-mono text-[11px] uppercase tracking-widest text-black/60">{label}</dt>
                <dd className="mt-1 font-medium">{value || "—"}</dd>
              </div>
            ))}
          </dl>
        </section>

        <div className="space-y-12 lg:col-span-7">
          <section aria-labelledby="reports" className="space-y-4">
            <h2 id="reports" className="text-xl font-bold tracking-tight">Reports ({reports.length})</h2>
            {reports.length === 0 ? (
              <p className="text-sm text-black/60">No reports yet.</p>
            ) : (
              <ul className="divide-y divide-black/10 border-y border-black/10">
                {reports.map((r) => (
                  <li key={r.id}>
                    <Link href={`/doctor-dashboard/reports/${r.id}`} className="flex items-center justify-between gap-4 py-4 hover:bg-black/[0.02]">
                      <span>
                        <span className="block font-bold capitalize">{r.test_type.replace(/_/g, " ")}</span>
                        <span className="block font-mono text-xs uppercase text-black/60">
                          {format(parseISO(r.uploaded_at), "d MMM yyyy")}{r.doctor_id && r.doctor_id !== doctorId ? " · sent to another doctor" : ""}
                        </span>
                      </span>
                      <span className="flex gap-2 font-mono text-[10px] uppercase">
                        <span className="border border-black/20 px-2 py-0.5">{AI_LABEL[r.ai_status] || r.ai_status}</span>
                        <span className={`border px-2 py-0.5 ${reviewed.has(r.id) ? "border-black" : "border-amber-700 text-amber-800"}`}>
                          {reviewed.has(r.id) ? "Reviewed" : "To review"}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="rx" className="space-y-4">
            <h2 id="rx" className="text-xl font-bold tracking-tight">Prescriptions</h2>
            <PrescriptionList patientId={patientId} emptyText="No prescriptions yet." />
          </section>
        </div>
      </div>

      <section aria-labelledby="timeline" className="space-y-6">
        <h2 id="timeline" className="text-xl font-bold tracking-tight">Timeline</h2>
        <HealthTimeline patientId={patientId} viewer="doctor" />
      </section>
    </div>
  )
}
