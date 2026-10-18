// What the admin pages work with (supabase/migrations/20261020120000_admin_and_invites.sql).
// Admins see account details and counts, never reports, notes or prescriptions.

export type Account = {
  id: string
  name: string | null
  email: string | null
  role: "patient" | "doctor" | "lab" | "admin"
  short_id: string | null
  verified: boolean
  license_number: string | null
  medical_council: string | null
  qualification: string | null
  specialty: string | null
  verification_note: string | null
  verification_reviewed_at: string | null
  email_confirmed: boolean
  created_at: string | null
  last_sign_in_at: string | null
  invite_code: string | null
}

export type Overview = {
  patients: number; doctors: number; labs: number; pending: number; turned_down: number
  unconfirmed: number; reports_week: number; ai_failed_week: number; open_invites: number
}

export type SignupCode = {
  code: string
  role: "doctor" | "lab"
  email: string | null
  note: string | null
  created_at: string
  expires_at: string
  used_at: string | null
  used_by_name: string | null
  used_by_email: string | null
  revoked_at: string | null
}

// Doctors and labs need verifying; patients and admins are simply active.
export type AccountStatus = "verified" | "pending" | "turned_down" | "active"

export function accountStatus(a: Pick<Account, "role" | "verified" | "verification_reviewed_at">): AccountStatus {
  if (a.role !== "doctor" && a.role !== "lab") return "active"
  if (a.verified) return "verified"
  return a.verification_reviewed_at ? "turned_down" : "pending"
}

export const STATUS_LABEL: Record<AccountStatus, string> = {
  verified: "Verified", pending: "Waiting for approval", turned_down: "Turned down", active: "Active",
}

export type CodeStatus = "open" | "used" | "expired" | "revoked"

export function codeStatus(c: Pick<SignupCode, "used_at" | "revoked_at" | "expires_at">, now = new Date()): CodeStatus {
  if (c.used_at) return "used"
  if (c.revoked_at) return "revoked"
  return new Date(c.expires_at) <= now ? "expired" : "open"
}

// The public register an admin checks a doctor's number against.
export const NMC_REGISTER_URL = "https://www.nmc.org.in/information-desk/indian-medical-register/"
