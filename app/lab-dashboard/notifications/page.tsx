"use client"

import DashboardShell from "@/components/medical/common/DashboardShell"
import NotificationsInbox from "@/components/medical/NotificationsInbox"

export default function LabNotificationsPage() {
  return (
    <DashboardShell role="lab" label="NOTIFICATIONS" title="Notifications">
      {(user) => <NotificationsInbox userId={user.id} role="lab" />}
    </DashboardShell>
  )
}
