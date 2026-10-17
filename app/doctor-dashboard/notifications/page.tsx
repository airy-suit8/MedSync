"use client"

import DashboardShell from "@/components/medical/common/DashboardShell"
import NotificationsInbox from "@/components/medical/NotificationsInbox"

export default function DoctorNotificationsPage() {
  return (
    <DashboardShell role="doctor" label="NOTIFICATIONS" title="Notifications">
      {(user) => <NotificationsInbox userId={user.id} role="doctor" />}
    </DashboardShell>
  )
}
