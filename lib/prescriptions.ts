export type RxItem = {
  medicine: string
  dose: string | null
  frequency: string | null
  duration: string | null
  instructions: string | null
}

export type Prescription = {
  id: string
  patient_id: string
  doctor_id: string
  report_id: string | null
  appointment_id: string | null
  items: RxItem[]
  diagnosis: string | null
  advice: string | null
  doctor_name: string
  doctor_registration: string | null
  doctor_specialty: string | null
  patient_name: string
  patient_short_id: string | null
  status: "active" | "cancelled"
  created_at: string
}

// Common choices for "how often"; the doctor can also type their own.
export const FREQUENCIES = [
  "Once a day",
  "Twice a day",
  "Three times a day",
  "Four times a day",
  "At night",
  "Every 8 hours",
  "When needed",
]

// Window event fired after a prescription is created or cancelled.
export const PRESCRIPTIONS_CHANGED = "medsync:prescriptions-changed"

export const EMPTY_ITEM: RxItem = { medicine: "", dose: "", frequency: "", duration: "", instructions: "" }

// Rows the doctor left blank are dropped; the server checks and trims the rest.
export function filledItems(items: RxItem[]) {
  return items.filter((i) => i.medicine.trim())
}

export function describeItem(i: RxItem) {
  return [i.dose, i.frequency, i.duration && `for ${i.duration}`].filter(Boolean).join(" · ")
}
