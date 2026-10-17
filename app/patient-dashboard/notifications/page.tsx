"use client"

import DashboardShell from "@/components/medical/common/DashboardShell"
import NotificationsInbox from "@/components/medical/NotificationsInbox"

export default function PatientNotificationsPage() {
  return (
    <DashboardShell role="patient" label="NOTIFICATIONS" title="Notifications">
      {(user) => <NotificationsInbox userId={user.id} role="patient" />}
    </DashboardShell>
  )
}
