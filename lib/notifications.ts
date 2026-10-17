export type Role = "doctor" | "patient" | "lab"

export type AppNotification = {
  id: string
  title: string
  message: string
  notification_type: string
  is_read: boolean | null
  related_id: string | null
  related_type: string | null
  action_url: string | null
  created_at: string
}

// Where a notification opens. New notifications store action_url; older ones only have
// what they refer to, so fall back to that, and never send a user into another role's
// dashboard or off the site.
export function notificationLink(n: AppNotification, role: Role): string | null {
  const url = n.action_url
  if (url && url.startsWith("/") && !url.startsWith("//")) {
    const area = url.split("/")[1]
    if (!area.endsWith("-dashboard") || area === `${role}-dashboard`) return url
  }
  if (!n.related_id) return null
  switch (n.related_type) {
    case "report":
      return role === "lab" ? null : `/${role}-dashboard/reports/${n.related_id}`
    case "ml_suggestion":
      return role === "doctor" ? "/doctor-dashboard/reports" : null
    case "prescription":
      return `/prescriptions/${n.related_id}`
    case "appointment":
      return role === "doctor" ? "/doctor-dashboard/patients" : role === "patient" ? "/patient-dashboard/doctors" : null
    default:
      return null
  }
}
