"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Bell } from "lucide-react"
import { createClient } from "@/lib/supabase"
import type { Role } from "@/lib/notifications"

// Bell with the unread count, in every dashboard's sidebar and phone top bar; updates live.
export default function NotificationBell({ role }: { role: Role }) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    const supabase = createClient()
    let channel: ReturnType<typeof supabase.channel> | null = null
    let cancelled = false

    const start = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) return
      const refresh = async () => {
        const { count: unread } = await supabase.from("notifications").select("id", { count: "exact", head: true })
          .eq("user_id", user.id).or("is_read.is.null,is_read.eq.false")
        if (!cancelled) setCount(unread ?? 0)
      }
      await refresh()
      await supabase.realtime.setAuth() // join with the user's token, not the anon key
      // unique per bell: the phone top bar and the sidebar each have one
      channel = supabase.channel(`notifications-bell-${user.id}-${Math.random().toString(36).slice(2)}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, refresh)
        .subscribe()
    }
    start()
    return () => {
      cancelled = true
      if (channel) supabase.removeChannel(channel)
    }
  }, [])

  return (
    <Link href={`/${role}-dashboard/notifications`} aria-label={count ? `Notifications, ${count} unread` : "Notifications"}
      className="relative inline-flex h-8 w-8 items-center justify-center text-white/70 hover:bg-white/10 hover:text-white">
      <Bell className="h-4 w-4" aria-hidden="true" />
      {count > 0 && (
        <span aria-hidden="true" className="absolute -right-1 -top-1 min-w-[1.1rem] bg-white px-1 text-center font-mono text-[10px] font-bold leading-[1.1rem] text-black">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  )
}
