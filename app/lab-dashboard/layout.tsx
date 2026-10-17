import type React from "react"
import DashboardFrame from "@/components/medical/navigation/DashboardFrame"

export default function LabDashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardFrame role="lab">{children}</DashboardFrame>
}
