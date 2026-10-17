"use client"

import { useEffect, useState } from "react"
import { Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import { doctorsOfPatient, submitReport, type LinkedDoctor } from "@/lib/submit-report"

const LABEL = "font-mono text-[11px] uppercase tracking-widest text-black/60"
const SELECT = "h-11 w-full border border-black/20 bg-white px-3 text-sm focus:border-black focus:outline-none"

type Study = { id: string; patient_id: string; patient_name: string; study_type: string; body_part: string; priority: string; notes?: string; file_paths?: string[] }

// Imaging studies used to stay with the lab: no doctor or AI ever saw them. This sends one
// of a study's images to one of the patient's doctors through the normal report path
// (doctor notified, AI reading for X-ray/MRI, doctor's review, patient sees the result).
export function testTypeForStudy(studyType: string) {
  const t = studyType.toLowerCase()
  if (t.includes("x-ray") || t.includes("xray")) return "x_ray"
  if (t.includes("mri")) return "mri"
  if (t.includes("ct")) return "ct_scan"
  if (t.includes("ultra")) return "ultrasound"
  return "other"
}

export default function SendStudyToDoctor({ study, labId, open, onOpenChange }: {
  study: Study | null
  labId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [doctors, setDoctors] = useState<LinkedDoctor[] | null>(null)
  const [doctorId, setDoctorId] = useState("")
  const [imagePath, setImagePath] = useState("")
  const [runAi, setRunAi] = useState(true)
  const [sending, setSending] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (!open || !study) return
    setDoctors(null)
    setDoctorId("")
    setImagePath(study.file_paths?.[0] || "")
    doctorsOfPatient(study.patient_id)
      .then((list) => { setDoctors(list); if (list.length === 1) setDoctorId(list[0].id) })
      .catch((err) => { setDoctors([]); toast({ title: "Could not load the patient's doctors", description: err.message, variant: "destructive" }) })
  }, [open, study, toast])

  if (!study) return null
  const testType = testTypeForStudy(study.study_type)

  const send = async () => {
    if (!doctorId || !imagePath) return
    setSending(true)
    try {
      const { data: blob, error } = await createClient().storage.from("imaging").download(imagePath)
      if (error || !blob) throw new Error(error?.message || "The image could not be read")
      const file = new File([blob], imagePath.split("/").pop() || "scan", { type: blob.type })
      const priority = study.priority === "critical" ? "critical" : study.priority === "high" ? "urgent" : "normal"
      await submitReport({
        file, patientId: study.patient_id, doctorId, testType, priority, labId,
        notes: [`${study.study_type} – ${study.body_part}`, study.notes].filter(Boolean).join(". "),
        runAi: runAi && (testType === "x_ray" || testType === "mri"),
      })
      toast({ title: "Sent to the doctor", description: "They have been told and will review it." })
      onOpenChange(false)
    } catch (err) {
      toast({ title: "Could not send the study", description: (err as Error).message, variant: "destructive" })
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-none border-black">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold uppercase">Send to doctor</DialogTitle>
          <DialogDescription>{study.patient_name} · {study.study_type} – {study.body_part}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="send-doctor" className={LABEL}>Doctor</Label>
            {doctors && doctors.length === 0 ? (
              <p className="border border-dashed border-black/20 p-4 text-sm text-black/70">
                This patient has no doctor yet. They can find one under My Doctors, or a doctor can add them with their Patient ID.
              </p>
            ) : (
              <select id="send-doctor" value={doctorId} onChange={(e) => setDoctorId(e.target.value)} disabled={!doctors} className={SELECT}>
                <option value="">{doctors ? "Choose one of the patient's doctors" : "Loading…"}</option>
                {(doctors || []).map((d) => <option key={d.id} value={d.id}>{d.name || "Doctor"}{d.specialty ? ` · ${d.specialty}` : ""}</option>)}
              </select>
            )}
          </div>

          {(study.file_paths?.length || 0) > 1 && (
            <div className="space-y-2">
              <Label htmlFor="send-image" className={LABEL}>Image</Label>
              <select id="send-image" value={imagePath} onChange={(e) => setImagePath(e.target.value)} className={SELECT}>
                {study.file_paths!.map((p, i) => <option key={p} value={p}>Image {i + 1} · {p.split("/").pop()}</option>)}
              </select>
            </div>
          )}

          {(testType === "x_ray" || testType === "mri") && (
            <label className="flex items-center gap-3 text-sm">
              <input type="checkbox" checked={runAi} onChange={(e) => setRunAi(e.target.checked)} className="h-4 w-4 accent-black" />
              Get an AI first reading
            </label>
          )}

          <Button onClick={send} disabled={sending || !doctorId || !imagePath} className="h-12 w-full rounded-none bg-black text-white hover:bg-black/90 font-mono text-xs uppercase tracking-widest">
            <Send className="mr-2 h-4 w-4" aria-hidden="true" />
            {sending ? "Sending…" : "Send"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
