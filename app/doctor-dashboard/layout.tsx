import type React from "react"
import DashboardFrame from "@/components/medical/navigation/DashboardFrame"

export default function DoctorDashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardFrame role="doctor">{children}</DashboardFrame>
}
