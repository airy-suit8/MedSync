// ========================================
// SHARED CONSTANTS
// ========================================

// UUID validation regex pattern
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// Common validation functions
export const isValidUUID = (id: string): boolean => UUID_REGEX.test(id)

// Where a doctor is registered: their State Medical Council, or the NMC's National Medical
// Register. Named by state, as patients and doctors refer to them.
export const MEDICAL_COUNCILS = [
  "National Medical Register (NMC)",
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Delhi", "Goa", "Gujarat",
  "Haryana", "Himachal Pradesh", "Jammu & Kashmir", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh",
  "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim",
  "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
]

// Where people reach the MedSync team (privacy requests, complaints, closed accounts).
export const CONTACT_EMAIL = "reach.medsync@gmail.com"

// The deployment's own address, for link previews, robots.txt and the sitemap. Set NEXT_PUBLIC_SITE_URL
// for a custom domain; on Vercel it falls back to the project's production domain.
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")
