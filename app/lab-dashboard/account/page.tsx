"use client"

import DashboardShell from "@/components/medical/common/DashboardShell"
import AccountSettings from "@/components/medical/AccountSettings"

export default function LabAccountPage() {
  return (
    <DashboardShell role="lab" label="ACCOUNT" title="Account">
      {(user) => <AccountSettings userId={user.id} role="lab" />}
    </DashboardShell>
  )
}
