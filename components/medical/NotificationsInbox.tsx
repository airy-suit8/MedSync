"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { formatDistanceToNow, parseISO } from "date-fns"
import { Bell, CheckCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase"
import { notificationLink, type AppNotification, type Role } from "@/lib/notifications"

// A user's notifications, newest first, updating live. Opening one marks it read and goes
// to the page it is about.
export default function NotificationsInbox({ userId, role }: { userId: string; role: Role }) {
  const [items, setItems] = useState<AppNotification[] | null>(null)
  const router = useRouter()

  const load = useCallback(async () => {
    const { data } = await createClient().from("notifications")
      .select("id, title, message, notification_type, is_read, related_id, related_type, action_url, created_at")
      .eq("user_id", userId).order("created_at", { ascending: false }).limit(100)
    setItems(data || [])
  }, [userId])

  useEffect(() => {
    load()
    const supabase = createClient()
    const channel = supabase.channel(`notifications-inbox-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId, load])

  const markRead = async (ids: string[]) => {
    if (!ids.length) return
    setItems((rows) => rows?.map((n) => (ids.includes(n.id) ? { ...n, is_read: true } : n)) || null)
    await createClient().from("notifications").update({ is_read: true }).in("id", ids)
  }

  const open = async (n: AppNotification) => {
    await markRead([n.id])
    const href = notificationLink(n, role)
    if (href) router.push(href)
  }

  if (items === null) return <p className="text-sm text-black/60">Loading…</p>
  const unread = items.filter((n) => !n.is_read)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="font-mono text-xs uppercase tracking-widest text-black/60">{unread.length} unread</p>
        {unread.length > 0 && (
          <Button variant="outline" onClick={() => markRead(unread.map((n) => n.id))} className="rounded-none border-black font-mono text-xs uppercase tracking-widest">
            <CheckCheck className="mr-2 h-4 w-4" aria-hidden="true" />Mark all read
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <p className="flex items-center gap-3 border border-dashed border-black/20 p-8 text-sm text-black/60">
          <Bell className="h-4 w-4" aria-hidden="true" />Nothing yet. You&apos;ll be told here about reports, reviews, prescriptions and requests.
        </p>
      ) : (
        <ul className="divide-y divide-black/10 border-y border-black/10">
          {items.map((n) => {
            const href = notificationLink(n, role)
            return (
              <li key={n.id}>
                <button type="button" onClick={() => open(n)}
                  className={`flex w-full items-start gap-4 px-2 py-4 text-left hover:bg-black/[0.03] ${n.is_read ? "text-black/60" : ""}`}>
                  <span aria-hidden="true" className={`mt-2 h-2 w-2 shrink-0 rounded-full ${n.is_read ? "bg-transparent" : "bg-black"}`} />
                  <span className="flex-1">
                    <span className="block font-bold">{n.title}{!n.is_read && <span className="sr-only"> (unread)</span>}</span>
                    <span className="block text-sm">{n.message}</span>
                    <span className="mt-1 block font-mono text-[11px] uppercase tracking-widest text-black/60">
                      {formatDistanceToNow(parseISO(n.created_at), { addSuffix: true })}{href ? " · Open" : ""}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
