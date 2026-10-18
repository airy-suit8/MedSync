"use client"

import DashboardShell from "@/components/medical/common/DashboardShell"
import AccountSettings from "@/components/medical/AccountSettings"

export default function PatientAccountPage() {
  return (
    <DashboardShell role="patient" label="ACCOUNT" title="Account">
      {(user) => <AccountSettings userId={user.id} role="patient" />}
    </DashboardShell>
  )
}
