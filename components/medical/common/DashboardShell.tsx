"use client"

import type React from "react"
import { useRouter } from "next/navigation"
import Sidebar from "@/components/medical/navigation/Sidebar"
import DashboardSkeleton from "@/components/medical/common/DashboardSkeleton"
import { useAuthCheck, type UserRole } from "@/hooks/use-auth-check"
import { createClient } from "@/lib/supabase"

// Sidebar, sign-in check and page header shared by the dashboard pages.
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
  const router = useRouter()

  if (loading || !user) return <DashboardSkeleton />

  const logout = async () => {
    await createClient().auth.signOut()
    router.push("/")
  }

  return (
    <div className="min-h-screen bg-transparent flex">
      <Sidebar userRole={role} userName={user.user_metadata?.name} onLogout={logout} />
      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-6 lg:p-12">
          <header className="mb-12 border-b border-black/10 pb-8">
            <span className="text-[11px] font-mono uppercase tracking-widest text-black/55">&quot;{label}&quot;</span>
            <h1 className="mt-4 text-4xl font-bold tracking-tight uppercase">{title}</h1>
            {intro && <p className="mt-2 max-w-2xl text-lg font-light text-black/60">{intro}</p>}
          </header>
          {children(user)}
        </div>
      </main>
    </div>
  )
}
