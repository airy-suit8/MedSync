import type React from "react"
import DashboardFrame from "@/components/medical/navigation/DashboardFrame"

export default function PatientDashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardFrame role="patient">{children}</DashboardFrame>
}
