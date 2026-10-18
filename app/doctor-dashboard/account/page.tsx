"use client"

import DashboardShell from "@/components/medical/common/DashboardShell"
import AccountSettings from "@/components/medical/AccountSettings"

export default function DoctorAccountPage() {
  return (
    <DashboardShell role="doctor" label="ACCOUNT" title="Account">
      {(user) => <AccountSettings userId={user.id} role="doctor" />}
    </DashboardShell>
  )
}
