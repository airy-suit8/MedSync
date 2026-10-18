"use client"

import DashboardShell from "@/components/medical/common/DashboardShell"
import NotificationsInbox from "@/components/medical/NotificationsInbox"

export default function AdminNotificationsPage() {
  return (
    <DashboardShell role="admin" label="NOTIFICATIONS" title="Notifications">
      {(user) => <NotificationsInbox userId={user.id} role="admin" />}
    </DashboardShell>
  )
}
