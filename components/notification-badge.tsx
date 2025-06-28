"use client"

import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Bell } from "lucide-react"
import { createClient } from "@/lib/supabase"

interface NotificationBadgeProps {
  userId: string
  role: string
}

export default function NotificationBadge({ userId, role }: NotificationBadgeProps) {
  const [unreadCount, setUnreadCount] = useState(0)
  const supabase = createClient()

  useEffect(() => {
    if (!userId) return

    // Load initial unread count
    loadUnreadCount()

    // Subscribe to new notifications
    const subscription = supabase
      .channel('notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `target_role=eq.${role}`
      }, () => {
        loadUnreadCount()
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'notifications',
        filter: `target_role=eq.${role}`
      }, () => {
        loadUnreadCount()
      })
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [userId, role])

  const loadUnreadCount = async () => {
    try {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('target_role', role)
        .eq('is_read', false)

      setUnreadCount(count || 0)
    } catch (error) {
      console.error('Error loading unread notifications:', error)
    }
  }

  if (unreadCount === 0) {
    return null
  }

  return (
    <div className="relative">
      <Bell className="h-5 w-5 text-gray-600" />
      <Badge 
        className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs bg-red-500 text-white"
      >
        {unreadCount > 99 ? '99+' : unreadCount}
      </Badge>
    </div>
  )
} 