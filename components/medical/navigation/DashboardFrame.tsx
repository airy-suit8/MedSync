"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Menu } from "lucide-react"
import Sidebar from "@/components/medical/navigation/Sidebar"
import NotificationBell from "@/components/medical/NotificationBell"
import VerificationBanner from "@/components/medical/common/VerificationBanner"
import { createClient } from "@/lib/supabase"

type Role = "doctor" | "patient" | "lab" | "admin"

// Every dashboard page sits in this frame (app/<role>-dashboard/layout.tsx): the sidebar on
// large screens, a top bar with a menu button on phones and tablets. It stays mounted while
// moving between pages.
export default function DashboardFrame({ role, children }: { role: Role; children: React.ReactNode }) {
  const [name, setName] = useState<string>()
  const [menuOpen, setMenuOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    createClient().auth.getSession().then(({ data }: { data: { session: { user: { user_metadata?: { name?: string } } } | null } }) =>
      setName(data.session?.user.user_metadata?.name))
  }, [])
  useEffect(() => setMenuOpen(false), [pathname])
  useEffect(() => {
    if (!menuOpen) return
    const close = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false)
    window.addEventListener("keydown", close)
    return () => window.removeEventListener("keydown", close)
  }, [menuOpen])

  const logout = async () => {
    await createClient().auth.signOut()
    router.push("/")
  }

  return (
    <div className="relative min-h-screen bg-white selection:bg-black selection:text-white">
      <div className="pointer-events-none fixed inset-0 z-0 opacity-[0.03]" aria-hidden="true"
        style={{ backgroundImage: "linear-gradient(to right, black 1px, transparent 1px), linear-gradient(to bottom, black 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
      <div className="relative z-10 flex min-h-screen">
        {menuOpen && <button type="button" aria-label="Close menu" onClick={() => setMenuOpen(false)} className="fixed inset-0 z-40 bg-black/50 lg:hidden" />}
        <Sidebar userRole={role} userName={name} onLogout={logout} mobileOpen={menuOpen} onClose={() => setMenuOpen(false)} />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between bg-black px-4 text-white lg:hidden">
            <span className="text-lg font-bold tracking-tight">MedSync</span>
            <div className="flex items-center gap-1">
              <NotificationBell role={role} />
              <button type="button" onClick={() => setMenuOpen(true)} aria-label="Open menu" aria-expanded={menuOpen}
                className="inline-flex h-10 w-10 items-center justify-center hover:bg-white/10">
                <Menu className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </header>
          {(role === "doctor" || role === "lab") && <VerificationBanner role={role} />}
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>
    </div>
  )
}
