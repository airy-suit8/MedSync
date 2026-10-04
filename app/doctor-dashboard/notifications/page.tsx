"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Activity, Bell, ArrowLeft, CheckCircle, Brain, FileText, MessageSquare, X } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { format } from "date-fns"
import { pressable } from "@/lib/utils"

interface Notification {
  id: string
  type: string
  title: string
  message: string
  target_role: string
  data?: any
  is_read: boolean
  created_at: string
}

export default function DoctorNotificationsPage() {
  const [user, setUser] = useState<any>(null)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user || user.user_metadata?.role !== "doctor") {
        router.push("/login")
        return
      }
      
      setUser(user)
      loadNotifications()
      setupRealtimeSubscriptions()
    }
    
    checkUser()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  const loadNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('target_role', 'doctor')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error loading notifications:', error)
      } else {
        setNotifications(data || [])
      }
    } catch (error) {
      console.error('Error loading notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  const setupRealtimeSubscriptions = () => {
    const subscription = supabase
      .channel('doctor_notifications')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `target_role=eq.doctor`
      }, () => {
        loadNotifications()
      })
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }

  const markAsRead = async (notificationId: string) => {
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)

      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      )
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

  const markAllAsRead = async () => {
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('target_role', 'doctor')
        .eq('is_read', false)

      setNotifications(prev => 
        prev.map(n => ({ ...n, is_read: true }))
      )
    } catch (error) {
      console.error('Error marking all notifications as read:', error)
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'ml_suggestion':
        return <Brain className="h-5 w-5" />
      case 'new_report':
        return <FileText className="h-5 w-5" />
      case 'patient_message':
        return <MessageSquare className="h-5 w-5" />
      default:
        return <Bell className="h-5 w-5" />
    }
  }

  const getNotificationBadgeStyle = (type: string) => {
    switch (type) {
      case 'ml_suggestion':
        return 'border-amber-600 text-amber-600 bg-amber-50'
      case 'new_report':
        return 'border-indigo-600 text-indigo-600 bg-indigo-50'
      case 'patient_message':
        return 'border-emerald-600 text-emerald-600 bg-emerald-50'
      default:
        return 'border-black/20 text-black/55 bg-black/[0.02]'
    }
  }

  const handleNotificationAction = (notification: Notification) => {
    markAsRead(notification.id)
    
    if (notification.type === 'ml_suggestion' && notification.data?.suggestion_id) {
      router.push(`/doctor-dashboard/reports`)
    } else if (notification.type === 'new_report') {
      router.push(`/doctor-dashboard/reports`)
    } else if (notification.type === 'patient_message' && notification.data?.patient_id) {
      router.push(`/doctor-dashboard/communication?patient=${notification.data.patient_id}`)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-transparent">
        <div className="flex flex-col items-center">
          <Activity className="h-8 w-8 animate-spin mb-4" />
          <span className="text-xs font-mono uppercase tracking-widest text-black/60">Fetching Alerts...</span>
        </div>
      </div>
    )
  }

  const unreadCount = notifications.filter(n => !n.is_read).length

  return (
    <div className="min-h-screen bg-transparent p-12 max-w-7xl mx-auto">
      {/* Header */}
      <header className="border-b border-black/10 pb-8 mb-12 flex items-end justify-between">
        <div>
          <Link href="/doctor-dashboard" className="inline-flex items-center space-x-2 text-xs font-mono uppercase tracking-widest text-black/55 hover:text-black mb-4 transition-colors">
            <ArrowLeft className="h-3 w-3" />
            <span>Return to Hub</span>
          </Link>
          <h1 className="text-4xl font-bold tracking-tight uppercase mb-2">Notification Center</h1>
          <p className="text-black/60 font-light text-lg italic">
            Synchronized system alerts and clinical status updates
          </p>
        </div>
        <div className="text-right hidden md:block">
          <span className="text-[10px] font-mono uppercase tracking-widest text-black/55 block mb-1">
            Uplink Status
          </span>
          <span className="text-xl font-mono border-b-2 border-indigo-600 inline-flex items-center gap-2">
            <span className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></span>
            ACTIVE_STREAM
          </span>
        </div>
      </header>

      <div className="container mx-auto">
        <div className="flex items-center justify-between mb-8 border-b border-black/10 pb-6">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-black uppercase tracking-tighter">Event Log</h2>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 border border-red-600 text-red-600 bg-red-50 text-[10px] font-mono font-bold uppercase tracking-tighter">
                {unreadCount} UNREAD
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <Button 
              onClick={markAllAsRead}
              variant="outline"
              className="rounded-none border-black hover:bg-black hover:text-white transition-all font-mono uppercase text-[10px] tracking-widest h-10 px-6"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Clear Buffer
            </Button>
          )}
        </div>

        {/* Notifications List */}
        <div className="space-y-4">
          {notifications.map((notification) => (
            <div 
              key={notification.id} 
              className={`border border-black/10 bg-white p-6 relative overflow-hidden group hover:border-black/30 transition-all cursor-pointer ${
                !notification.is_read ? 'shadow-[4px_4px_0px_0px_rgba(0,0,0,0.05)]' : 'opacity-60'
              }`}
              {...pressable(() => handleNotificationAction(notification))}
            >
              {!notification.is_read && (
                <div className="absolute left-0 top-0 h-full w-0.5 bg-indigo-600"></div>
              )}
              
              <div className="flex items-start gap-6">
                <div className={`p-3 border border-black/10 ${!notification.is_read ? 'bg-black text-white' : 'bg-black/5 text-black/55'}`}>
                  {getNotificationIcon(notification.type)}
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-black uppercase tracking-tight">
                        {notification.title}
                      </h3>
                      <span className={`px-2 py-0.5 border text-[9px] font-mono font-bold uppercase tracking-tighter ${getNotificationBadgeStyle(notification.type)}`}>
                        {notification.type.replace('_', ' ')}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-black/55 uppercase">
                      {format(new Date(notification.created_at), 'MMM dd, HH:mm')}
                    </span>
                  </div>
                  
                  <p className="text-sm font-mono text-black/60 uppercase leading-relaxed mb-4">
                    {notification.message}
                  </p>
                  
                  {notification.data && (
                    <div className="flex gap-4 p-3 bg-black/[0.02] border border-black/5 text-[10px] font-mono text-black/55 uppercase">
                      {notification.type === 'ml_suggestion' && (
                        <span>PT_ID: {notification.data.patient_id} <span className="mx-2">|</span> TEST: {notification.data.test_type}</span>
                      )}
                      {notification.type === 'new_report' && (
                        <span>PT_ID: {notification.data.patient_id} <span className="mx-2">|</span> FILE: {notification.data.file_name}</span>
                      )}
                      {notification.type === 'patient_message' && (
                        <span>SENDER: {notification.data.sender_name}</span>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                   {!notification.is_read && (
                     <Button 
                       variant="ghost" 
                       size="sm" 
                       className="rounded-none hover:bg-black/5"
                       onClick={(e) => {
                         e.stopPropagation();
                         markAsRead(notification.id);
                       }}
                     >
                       <X className="h-4 w-4" />
                     </Button>
                   )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {notifications.length === 0 && (
          <div className="border border-black/10 bg-white p-24 text-center">
            <Bell className="h-12 w-12 text-black/10 mx-auto mb-6" />
            <h3 className="text-2xl font-black uppercase tracking-tight mb-2">Queue Clear</h3>
            <p className="text-black/60 font-light max-w-sm mx-auto uppercase text-xs tracking-widest leading-loose">
              No active system alerts detected. Your downlink is clear.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
