"use client"

import type React from "react"
import { useCallback, useEffect, useState } from "react"
import { format, parseISO } from "date-fns"
import { Camera, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import DictationButton from "@/components/medical/DictationButton"
import { createClient } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import { VERDICTS, type Review, type Verdict } from "@/lib/review"

const LABEL = "font-mono text-[11px] uppercase tracking-widest text-black/60"
const FIELD = "rounded-none border-black/20 focus:border-black placeholder:text-black/55"

type OtherReview = Review & { doctor_name: string; private_note: string | null; image_url: string | null }

// The doctor's review of a report: a verdict on the AI reading, a note the patient sees,
// an optional photo of a handwritten note, and a private note only the patient's doctors
// see. Saved through submit_report_review, which also tells the patient. Every doctor
// treating the patient can add their own review (a second opinion).
export default function ReportReviewPanel({ reportId, doctorId, hasAi, children }: {
  reportId: string
  doctorId: string
  hasAi: boolean
  children?: React.ReactNode
}) {
  // With no AI reading, "reviewed" is the only verdict; preselect it so Save works before load() finishes.
  const [verdict, setVerdict] = useState<Verdict | "">(hasAi ? "" : "reviewed")
  const [patientNote, setPatientNote] = useState("")
  const [privateNote, setPrivateNote] = useState("")
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [savedImagePath, setSavedImagePath] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [others, setOthers] = useState<OtherReview[]>([])
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: reviews } = await supabase
      .from("report_reviews")
      .select("id, doctor_id, verdict, patient_note, note_image_path, updated_at")
      .eq("report_id", reportId)
    const rows = (reviews || []) as Review[]
    const ids = rows.map((r) => r.id)
    const doctorIds = [...new Set(rows.map((r) => r.doctor_id))]
    const [{ data: privates }, { data: doctors }] = await Promise.all([
      ids.length ? supabase.from("report_review_private_notes").select("review_id, note").in("review_id", ids) : Promise.resolve({ data: [] }),
      doctorIds.length ? supabase.from("profile_directory").select("id, name").in("id", doctorIds) : Promise.resolve({ data: [] }),
    ])
    const privateById = new Map<string, string>((privates || []).map((p: { review_id: string; note: string }) => [p.review_id, p.note]))
    const nameById = new Map<string, string | null>((doctors || []).map((d: { id: string; name: string | null }) => [d.id, d.name]))

    const mine = rows.find((r) => r.doctor_id === doctorId)
    if (mine) {
      setVerdict(mine.verdict)
      setPatientNote(mine.patient_note || "")
      setPrivateNote(privateById.get(mine.id) || "")
      setSavedImagePath(mine.note_image_path)
      setSavedAt(mine.updated_at)
    } else if (!hasAi) {
      setVerdict("reviewed")
    }

    const otherRows = rows.filter((r) => r.doctor_id !== doctorId)
    setOthers(await Promise.all(otherRows.map(async (r) => ({
      ...r,
      doctor_name: nameById.get(r.doctor_id) || "Another doctor",
      private_note: privateById.get(r.id) || null,
      image_url: r.note_image_path
        ? (await supabase.storage.from("review-notes").createSignedUrl(r.note_image_path, 3600)).data?.signedUrl || null
        : null,
    }))))
  }, [reportId, doctorId, hasAi])

  useEffect(() => { load() }, [load])

  // Show the saved photo of my own note.
  useEffect(() => {
    if (photo || !savedImagePath) return
    createClient().storage.from("review-notes").createSignedUrl(savedImagePath, 3600)
      .then(({ data }: { data: { signedUrl: string } | null }) => setPhotoPreview(data?.signedUrl || null))
  }, [savedImagePath, photo])

  const pickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "Photo too large", description: "Use a photo under 10 MB.", variant: "destructive" })
      return
    }
    setPhoto(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!verdict) {
      toast({ title: "Choose a verdict", variant: "destructive" })
      return
    }
    setSaving(true)
    const supabase = createClient()
    let imagePath = savedImagePath
    if (photo) {
      const ext = (photo.name.split(".").pop() || "jpg").toLowerCase()
      imagePath = `${reportId}/${doctorId}-${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from("review-notes").upload(imagePath, photo, { contentType: photo.type })
      if (uploadError) {
        setSaving(false)
        toast({ title: "Could not upload the photo", description: uploadError.message, variant: "destructive" })
        return
      }
    }
    const { error } = await supabase.rpc("submit_report_review", {
      p_report_id: reportId,
      p_verdict: verdict,
      p_patient_note: patientNote,
      p_private_note: privateNote,
      p_note_image_path: imagePath,
    })
    setSaving(false)
    if (error) {
      toast({ title: "Could not save the review", description: error.message, variant: "destructive" })
      return
    }
    setPhoto(null)
    setSavedImagePath(imagePath)
    setSavedAt(new Date().toISOString())
    toast({ title: "Review saved", description: "The patient has been told and can now read your note." })
  }

  const verdictChoices: Verdict[] = hasAi ? ["agree", "disagree", "unclear"] : ["reviewed"]

  return (
    <section aria-labelledby="review-heading" className="border border-black">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black px-6 py-4">
        <h2 id="review-heading" className="text-xl font-bold uppercase">Your review</h2>
        {savedAt && <span className="font-mono text-[11px] uppercase tracking-widest text-black/60">Saved {format(parseISO(savedAt), "d MMM yyyy, HH:mm")}</span>}
      </div>

      <form onSubmit={save} className="space-y-6 p-6">
        <fieldset>
          <legend className={`${LABEL} mb-3`}>{hasAi ? "The AI reading is" : "No AI reading for this report"}</legend>
          <div className={`grid gap-px border border-black/10 bg-black/10 ${verdictChoices.length > 1 ? "sm:grid-cols-3" : ""}`}>
            {verdictChoices.map((v) => (
              <label key={v} className="cursor-pointer bg-white p-4 text-sm font-bold uppercase tracking-wide transition-colors hover:bg-black/[0.03] has-[:checked]:bg-black has-[:checked]:text-white has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-black">
                <input type="radio" name="verdict" value={v} checked={verdict === v} onChange={() => setVerdict(v)} className="sr-only" />
                {VERDICTS[v].doctor}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="patient-note" className={LABEL}>Note for the patient</Label>
            <DictationButton label="note for the patient" onText={(t) => setPatientNote((n) => (n ? `${n} ${t}` : t))} />
          </div>
          <Textarea id="patient-note" value={patientNote} onChange={(e) => setPatientNote(e.target.value)} maxLength={4000} rows={5}
            placeholder="What this result means for them and what to do next. Plain language: the patient reads this."
            className={FIELD} />
        </div>

        <div className="space-y-2">
          <span className={LABEL}>Photo of a handwritten note (optional)</span>
          {photoPreview ? (
            <div className="relative inline-block border border-black/10">
              {/* eslint-disable-next-line @next/next/no-img-element -- local preview or signed URL */}
              <img src={photoPreview} alt="Handwritten note" className="max-h-64 w-auto" />
              {photo && (
                <button type="button" onClick={() => { setPhoto(null); setPhotoPreview(null) }} aria-label="Remove photo"
                  className="absolute right-1 top-1 bg-black p-1 text-white">
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              )}
            </div>
          ) : null}
          <div>
            <label className="inline-flex cursor-pointer items-center gap-2 border border-black/30 px-4 py-2 font-mono text-[11px] uppercase tracking-widest hover:border-black has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-black">
              <Camera className="h-4 w-4" aria-hidden="true" />
              {photoPreview ? "Replace photo" : "Take or upload a photo"}
              <input type="file" accept="image/jpeg,image/png,image/webp,image/heic" capture="environment" onChange={pickPhoto} className="sr-only" />
            </label>
          </div>
          <p className="text-xs text-black/60">The patient sees this photo with your note.</p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="private-note" className={LABEL}>Private note for other doctors</Label>
            <DictationButton label="private note" onText={(t) => setPrivateNote((n) => (n ? `${n} ${t}` : t))} />
          </div>
          <Textarea id="private-note" value={privateNote} onChange={(e) => setPrivateNote(e.target.value)} maxLength={4000} rows={3}
            placeholder="Clinical remarks for the patient's other doctors. The patient does not see this."
            className={FIELD} />
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-black/10 pt-6">
          <Button type="submit" disabled={saving} className="h-12 rounded-none bg-black px-8 text-white hover:bg-black/90 font-mono text-xs uppercase tracking-widest">
            {saving ? "Saving…" : savedAt ? "Update review" : "Save review"}
          </Button>
          {children}
        </div>
      </form>

      {others.length > 0 && (
        <div className="border-t border-black">
          <h3 className="px-6 pt-5 font-mono text-[11px] uppercase tracking-widest text-black/60">Other doctors&apos; reviews</h3>
          <ul className="divide-y divide-black/10">
            {others.map((r) => (
              <li key={r.id} className="space-y-2 px-6 py-5">
                <p className="font-bold">{r.doctor_name} <span className="font-normal text-black/60">· {VERDICTS[r.verdict].doctor}</span></p>
                {r.patient_note && <p className="text-sm"><span className="text-black/60">To the patient: </span>{r.patient_note}</p>}
                {r.private_note && <p className="text-sm"><span className="text-black/60">Private: </span>{r.private_note}</p>}
                {r.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
                  <img src={r.image_url} alt={`Handwritten note from ${r.doctor_name}`} className="max-h-48 border border-black/10" />
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
