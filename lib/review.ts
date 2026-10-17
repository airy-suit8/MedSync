export type Verdict = "agree" | "disagree" | "unclear" | "reviewed"

// Wording for a doctor's verdict on a report, as the doctor picks it and as the patient
// reads it. "reviewed" is the only choice when the report has no AI reading.
export const VERDICTS: Record<Verdict, { doctor: string; patient: string }> = {
  agree: { doctor: "Agree with the AI", patient: "Your doctor agrees with the AI reading." },
  disagree: { doctor: "Disagree with the AI", patient: "Your doctor does not agree with the AI reading." },
  unclear: { doctor: "Can't tell yet", patient: "Your doctor needs more information before deciding." },
  reviewed: { doctor: "Reviewed", patient: "Your doctor has reviewed this report." },
}

export type Review = {
  id: string
  doctor_id: string
  verdict: Verdict
  patient_note: string | null
  note_image_path: string | null
  updated_at: string
}
