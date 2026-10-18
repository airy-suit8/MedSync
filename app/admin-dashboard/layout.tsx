import type React from "react"
import DashboardFrame from "@/components/medical/navigation/DashboardFrame"

export default function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardFrame role="admin">{children}</DashboardFrame>
}
