"use client"

import type React from "react"
import DashboardSkeleton from "@/components/medical/common/DashboardSkeleton"
import { useAuthCheck, type UserRole } from "@/hooks/use-auth-check"

// Sign-in check and page header shared by the dashboard pages (the sidebar is in
// DashboardFrame, via each dashboard's layout).
export default function DashboardShell({
  role,
  label,
  title,
  intro,
  children,
}: {
  role: UserRole
  label: string
  title: string
  intro?: string
  children: (user: { id: string; user_metadata?: { name?: string } }) => React.ReactNode
}) {
  const { user, loading } = useAuthCheck(role)

  if (loading || !user) return <DashboardSkeleton />

  return (
    <div className="max-w-7xl mx-auto p-6 lg:p-12">
      <header className="mb-12 border-b border-black/10 pb-8">
        <span className="text-[11px] font-mono uppercase tracking-widest text-black/55">&quot;{label}&quot;</span>
        <h1 className="mt-4 text-3xl sm:text-4xl font-bold tracking-tight uppercase break-words">{title}</h1>
        {intro && <p className="mt-2 max-w-2xl text-lg font-light text-black/60">{intro}</p>}
      </header>
      {children(user)}
    </div>
  )
}
