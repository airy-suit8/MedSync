"use client"

import type React from "react"
import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { format, parseISO } from "date-fns"
import { CheckCircle, Search, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import DashboardShell from "@/components/medical/common/DashboardShell"
import { createClient } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import { UUID_REGEX } from "@/lib/constants"
import { TEST_TYPES, testLabel } from "@/lib/utils"
import { doctorsOfPatient, submitReport, type LinkedDoctor } from "@/lib/submit-report"

const LABEL = "font-mono text-[11px] uppercase tracking-widest text-black/60"
const FIELD = "h-12 rounded-none border-black/20 focus:border-black"
const SELECT = "h-12 w-full border border-black/20 bg-white px-3 text-sm focus:border-black focus:outline-none"

const AI_STATUS: Record<string, string> = {
  pending: "Sending to doctor", running: "AI reading", done: "AI reading ready",
  failed: "AI could not read it", not_applicable: "Sent to doctor",
}

type Patient = { id: string; name: string | null; short_id: string | null }
type Recent = { id: string; patient_id: string; test_type: string; uploaded_at: string; ai_status: string }

export default function LabUploadPage() {
  return (
    <DashboardShell role="lab" label="UPLOAD" title="Upload a report"
      intro="Find the patient, pick which of their doctors it is for, and attach the file. The doctor is told straight away; scans and blood or urine reports also get an AI reading.">
      {(user) => <UploadForm labId={user.id} />}
    </DashboardShell>
  )
}

function UploadForm({ labId }: { labId: string }) {
  const [patientQuery, setPatientQuery] = useState("")
  const [patient, setPatient] = useState<Patient | null>(null)
  const [doctors, setDoctors] = useState<LinkedDoctor[]>([])
  const [looking, setLooking] = useState(false)
  const [doctorId, setDoctorId] = useState("")
  const [testType, setTestType] = useState("")
  const [priority, setPriority] = useState("normal")
  const [notes, setNotes] = useState("")
  const [runAi, setRunAi] = useState(true)
  const [file, setFile] = useState<File | null>(null)
  const [fileKey, setFileKey] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const [recent, setRecent] = useState<Recent[]>([])
  const [names, setNames] = useState<Map<string, string>>(new Map())
  const { toast } = useToast()

  const loadRecent = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase.from("reports").select("id, patient_id, test_type, uploaded_at, ai_status")
      .eq("uploaded_by", labId).order("uploaded_at", { ascending: false }).limit(6)
    const rows = (data || []) as Recent[]
    setRecent(rows)
    const ids = [...new Set(rows.map((r) => r.patient_id))]
    if (ids.length) {
      const { data: people } = await supabase.from("profile_directory").select("id, name").in("id", ids)
      setNames(new Map((people || []).map((p: { id: string; name: string | null }) => [p.id, p.name || "Patient"])))
    }
  }, [labId])

  useEffect(() => { loadRecent() }, [loadRecent])

  const findPatient = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const id = patientQuery.trim()
    if (!id) return
    setLooking(true)
    setPatient(null)
    setDoctors([])
    setDoctorId("")
    const supabase = createClient()
    let query = supabase.from("profile_directory").select("id, name, short_id").eq("role", "patient")
    query = UUID_REGEX.test(id) ? query.eq("id", id) : query.ilike("short_id", id)
    const { data, error } = await query.maybeSingle()
    if (error || !data) {
      setLooking(false)
      toast({ title: "Patient not found", description: "Check the Patient ID on their dashboard.", variant: "destructive" })
      return
    }
    try {
      const list = await doctorsOfPatient(data.id)
      setPatient(data)
      setDoctors(list)
      if (list.length === 1) setDoctorId(list[0].id)
    } catch (err) {
      toast({ title: "Could not load the patient's doctors", description: (err as Error).message, variant: "destructive" })
    } finally {
      setLooking(false)
    }
  }

  const upload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!patient || !doctorId || !testType || !file) {
      toast({ title: "Fill in the patient, doctor, test and file", variant: "destructive" })
      return
    }
    setUploading(true)
    try {
      const aiAvailable = TEST_TYPES.find((t) => t.value === testType)?.ai ?? false
      const { aiStatus } = await submitReport({ file, patientId: patient.id, doctorId, testType, priority, notes, runAi: runAi && aiAvailable, labId })
      const doctor = doctors.find((d) => d.id === doctorId)
      setDone(`${doctor?.name || "The doctor"} has been told.${aiStatus === "running" ? " The AI reading will be ready in a minute or two; you can leave this page." : ""}`)
      setFile(null)
      setFileKey((k) => k + 1) // clears the file input
      setNotes("")
      loadRecent()
    } catch (err) {
      toast({ title: "Upload failed", description: (err as Error).message, variant: "destructive" })
    } finally {
      setUploading(false)
    }
  }

  const aiAvailable = TEST_TYPES.find((t) => t.value === testType)?.ai

  return (
    <div className="grid gap-12 lg:grid-cols-12">
      <div className="space-y-8 lg:col-span-7">
        {done && (
          <div role="status" className="flex items-start gap-3 border border-black p-5">
            <CheckCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-bold">Report uploaded</p>
              <p className="text-sm text-black/70">{done}</p>
            </div>
          </div>
        )}

        <form onSubmit={findPatient} className="space-y-2">
          <Label htmlFor="patient-id" className={LABEL}>1. Patient ID</Label>
          <div className="flex gap-2">
            <Input id="patient-id" value={patientQuery} onChange={(e) => setPatientQuery(e.target.value)}
              placeholder="ENTER SHORT ID / UUID" className={`${FIELD} font-mono`} />
            <Button type="submit" disabled={looking || !patientQuery.trim()} className="h-12 rounded-none bg-black px-6 text-white hover:bg-black/90 font-mono text-xs uppercase tracking-widest">
              <Search className="mr-2 h-4 w-4" aria-hidden="true" />{looking ? "Finding…" : "Find"}
            </Button>
          </div>
          {patient && <p className="text-sm">Patient: <strong>{patient.name || "Unnamed"}</strong> <span className="font-mono text-black/60">({patient.short_id})</span></p>}
        </form>

        <form onSubmit={upload} className="space-y-8">
          <div className="space-y-2">
            <Label htmlFor="doctor" className={LABEL}>2. For which doctor</Label>
            {patient && doctors.length === 0 ? (
              <p className="border border-dashed border-black/20 p-4 text-sm text-black/70">
                This patient has no doctor yet. They can find one under My Doctors, or a doctor can add them with their Patient ID.
              </p>
            ) : (
              <select id="doctor" value={doctorId} onChange={(e) => setDoctorId(e.target.value)} disabled={!patient} className={SELECT}>
                <option value="">{patient ? "Choose one of the patient's doctors" : "Find the patient first"}</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>{d.name || "Doctor"}{d.specialty ? ` · ${d.specialty}` : ""}</option>
                ))}
              </select>
            )}
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="test-type" className={LABEL}>3. Test</Label>
              <select id="test-type" value={testType} onChange={(e) => setTestType(e.target.value)} className={SELECT}>
                <option value="">Choose the test</option>
                {TEST_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="priority" className={LABEL}>Priority</Label>
              <select id="priority" value={priority} onChange={(e) => setPriority(e.target.value)} className={SELECT}>
                <option value="normal">Normal</option>
                <option value="urgent">Urgent</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="report-file" className={LABEL}>4. File</Label>
            <Input key={fileKey} id="report-file" type="file" accept=".pdf,.jpg,.jpeg,.png,.dcm,.dicom"
              onChange={(e) => setFile(e.target.files?.[0] || null)} className="h-auto rounded-none border-black/20 py-3" />
            <p className="text-xs text-black/60">PDF, JPEG, PNG or DICOM, up to 10 MB.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes" className={LABEL}>Notes for the doctor (optional)</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} rows={3}
              className="rounded-none border-black/20 focus:border-black" />
          </div>

          <label className="flex items-start gap-3 text-sm">
            <input id="mlEnabled" type="checkbox" checked={runAi} onChange={(e) => setRunAi(e.target.checked)} className="mt-1 h-4 w-4 accent-black" />
            <span>
              Get an AI first reading
              <span className="block text-xs text-black/60">
                {testType && !aiAvailable ? "There is no AI for this test; the doctor reviews it directly." : "For X-ray, MRI, blood and urine reports. The doctor reviews it before the patient sees anything."}
              </span>
            </span>
          </label>

          <Button type="submit" disabled={uploading} className="h-14 w-full rounded-none bg-black text-white hover:bg-black/90 font-mono text-sm uppercase tracking-widest">
            <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
            {uploading ? "Uploading…" : "Upload report"}
          </Button>
        </form>
      </div>

      <aside className="lg:col-span-5">
        <h2 className="mb-4 font-mono text-[11px] uppercase tracking-widest text-black/60">Your recent uploads</h2>
        {recent.length === 0 ? (
          <p className="border border-dashed border-black/20 p-6 text-sm text-black/60">Nothing uploaded yet.</p>
        ) : (
          <ul className="divide-y divide-black/10 border-y border-black/10">
            {recent.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-4 py-4">
                <div>
                  <p className="font-bold">{names.get(r.patient_id) || "Patient"}</p>
                  <p className="font-mono text-xs uppercase text-black/60">
                    {testLabel(r.test_type)} · {format(parseISO(r.uploaded_at), "d MMM, HH:mm")}
                  </p>
                </div>
                <span className="border border-black/20 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider">{AI_STATUS[r.ai_status] || r.ai_status}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-6 text-sm text-black/60">
          Scans from the <Link href="/lab-dashboard/imaging" className="underline underline-offset-4">Imaging</Link> page can be sent to a doctor the same way.
        </p>
      </aside>
    </div>
  )
}
