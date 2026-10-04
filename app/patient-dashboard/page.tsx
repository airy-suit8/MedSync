"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Activity, FileText, MessageSquare, Calendar, Brain, Video, ArrowRight } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { format, parseISO } from "date-fns"
import Sidebar from "@/components/medical/navigation/Sidebar"
import StatusBadge from "@/components/medical/common/StatusBadge"
import { useAuthCheck } from "@/hooks/use-auth-check"
import ErrorBoundary from "@/components/error-boundary"
import { pressable } from "@/lib/utils"
import DashboardSkeleton from "@/components/medical/common/DashboardSkeleton"
import AppointmentRequests from "@/components/medical/AppointmentRequests"

interface PatientActivity {
  id: string
  type: 'appointment' | 'report' | 'message' | 'ai_chat'
  title: string
  description: string
  date: string
  status: string
  icon: string
}

interface PatientStats {
  recentReports: number
  upcomingAppointments: number
  unreadMessages: number
}

export default function PatientDashboard() {
  const { user, shortId, loading: authLoading } = useAuthCheck("patient")
  const [dataLoading, setDataLoading] = useState(true)
  const [recentActivity, setRecentActivity] = useState<PatientActivity[]>([])
  const [stats, setStats] = useState<PatientStats>({
    recentReports: 0,
    upcomingAppointments: 0,
    unreadMessages: 0
  })
  const router = useRouter()

  useEffect(() => {
    if (!authLoading && user) {
      loadPatientData(user.id)
    }
  }, [authLoading, user])

  const loadPatientData = async (patientId: string) => {
    const supabase = createClient()
    setDataLoading(true)

    try {
      // Upcoming appointments, recent reports and recent messages load in one round trip.
      const today = format(new Date(), 'yyyy-MM-dd')
      const [{ data: appointments }, { data: reports }, { data: messages }] = await Promise.all([
        supabase
          .from('appointments')
          .select('*')
          .eq('patient_id', patientId)
          .gte('appointment_date', today)
          .order('appointment_date', { ascending: true }),
        supabase
          .from('reports')
          .select('*')
          .eq('patient_id', patientId)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('messages')
          .select('*')
          .or(`sender_id.eq.${patientId},receiver_id.eq.${patientId}`)
          .order('created_at', { ascending: false })
          .limit(10),
      ])

      // 5. Map Activity
      const activities: PatientActivity[] = []

      if (appointments) {
        appointments.forEach((apt: any) => {
          activities.push({
            id: apt.id,
            type: 'appointment',
            title: apt.appointment_type || 'Consultation',
            description: `Scheduled with ${apt.doctor_name || 'Doctor'}`,
            date: apt.appointment_date,
            status: apt.status || 'scheduled',
            icon: 'calendar'
          })
        })
      }

      if (reports) {
        reports.forEach((report: any) => {
          activities.push({
            id: report.id,
            type: 'report',
            title: report.test_type || 'Medical Report',
            description: 'New results available',
            date: report.created_at || report.uploaded_at,
            status: 'completed',
            icon: 'file-text'
          })
        })
      }

      // Sort activities by date descending
      activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      setRecentActivity(activities.slice(0, 5))

      setStats({
        recentReports: reports?.length || 0,
        upcomingAppointments: appointments?.length || 0,
        unreadMessages: messages?.filter((m: any) => m.read === false).length || 0,
      })

    } catch (error) {
      console.error('Error loading patient dashboard data:', error)
    } finally {
      setDataLoading(false)
    }
  }


  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/")
  }

  const getActivityIcon = (icon: string) => {
    switch (icon) {
      case 'file-text': return <FileText className="h-4 w-4" />
      case 'message': return <MessageSquare className="h-4 w-4" />
      case 'calendar': return <Calendar className="h-4 w-4" />
      case 'brain': return <Brain className="h-4 w-4" />
      default: return <Activity className="h-4 w-4" />
    }
  }

  if (authLoading || dataLoading) {
    return <DashboardSkeleton />
  }

  return (
    <ErrorBoundary componentName="Patient Dashboard">
    <div className="min-h-screen bg-transparent flex">
      <Sidebar userRole="patient" userName={user?.user_metadata?.name} onLogout={handleLogout} />

      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-12">
          {/* Header */}
          <div className="mb-12 border-b border-black/10 pb-8 flex items-end justify-between">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-black/55">
                  System Online
                </span>
              </div>
              <h1 className="text-4xl font-bold tracking-tight mb-2">
                HELLO, {user?.user_metadata?.name?.split(' ')[0].toUpperCase() || 'PATIENT'}
              </h1>
              <p className="text-black/60 font-light text-lg">
                Personal Health Command Center
              </p>
            </div>
            {shortId && (
              <div className="text-right">
                <span className="text-[10px] font-mono uppercase tracking-widest text-black/55 block mb-1">
                  Patient ID
                </span>
                <span className="text-xl font-mono border-b border-black">
                  {shortId}
                </span>
              </div>
            )}
          </div>

          {user && <AppointmentRequests patientId={user.id} />}

          {/* Stats Grid - "Deconstructed" */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-black/10 border border-black/10 mb-16">
            <div className="bg-white p-6 hover:bg-black/[0.02] transition-colors group cursor-pointer relative" {...pressable(() => router.push('/patient-dashboard/reports'))}>
              <div className="flex justify-between items-start mb-4">
                <FileText className="h-5 w-5 text-black/55 group-hover:text-black transition-colors" />
                <span className="text-[10px] font-mono uppercase tracking-widest text-black/55">01</span>
              </div>
              <div className="text-3xl font-bold mb-1">{stats.recentReports}</div>
              <div className="text-xs font-mono uppercase tracking-wider text-black/60">Recent Reports</div>
              <div className="absolute bottom-0 left-0 w-full h-0.5 bg-red-600"></div>
            </div>

            <div className="bg-white p-6 hover:bg-black/[0.02] transition-colors group cursor-pointer relative" {...pressable(() => router.push('/patient-dashboard/video-consultations'))}>
              <div className="flex justify-between items-start mb-4">
                <Calendar className="h-5 w-5 text-black/55 group-hover:text-black transition-colors" />
                <span className="text-[10px] font-mono uppercase tracking-widest text-black/55">02</span>
              </div>
              <div className="text-3xl font-bold mb-1">{stats.upcomingAppointments}</div>
              <div className="text-xs font-mono uppercase tracking-wider text-black/60">Upcoming Visits</div>
              <div className="absolute bottom-0 left-0 w-full h-0.5 bg-cyan-600"></div>
            </div>

            <div className="bg-white p-6 hover:bg-black/[0.02] transition-colors group cursor-pointer relative" {...pressable(() => router.push('/patient-dashboard/chat'))}>
              <div className="flex justify-between items-start mb-4">
                <MessageSquare className="h-5 w-5 text-black/55 group-hover:text-black transition-colors" />
                <span className="text-[10px] font-mono uppercase tracking-widest text-black/55">03</span>
              </div>
              <div className="text-3xl font-bold mb-1">{stats.unreadMessages}</div>
              <div className="text-xs font-mono uppercase tracking-wider text-black/60">Unread Messages</div>
              <div className="absolute bottom-0 left-0 w-full h-0.5 bg-slate-900"></div>
            </div>

          </div>

          {/* Main Content Areas */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">

            {/* Column 1 & 2: Featured + Actions */}
            <div className="lg:col-span-2 space-y-12">

              {/* AI Assistant Banner */}
              <div className="border border-black p-1 relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-full h-0.5 bg-amber-600 z-20"></div>
                <div className="bg-black text-white p-8 lg:p-12 relative z-10 transition-transform duration-500 group-hover:scale-[0.99]">
                  <div className="absolute top-4 right-4 text-xs font-mono border border-white/20 px-2 py-1">
                    AI ENABLED
                  </div>
                  <Brain className="h-12 w-12 mb-6" />
                  <h2 className="text-3xl font-bold mb-4">Personal Health Assistant</h2>
                  <p className="text-white/60 max-w-lg mb-8 font-light">
                    Get instant answers about your health, understand your reports, and receive personalized guidance.
                  </p>
                  <Button
                    onClick={() => router.push('/patient-dashboard/ai-assistant')}
                    className="bg-white text-black hover:bg-white/90 rounded-none h-12 px-8 font-mono uppercase tracking-widest text-xs flex items-center space-x-4"
                  >
                    <span>Start Chat</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Activity Table */}
              <div>
                <div className="flex items-center justify-between mb-6 border-b border-black/10 pb-2">
                  <h3 className="text-xl font-bold tracking-tight">Recent Activity</h3>
                  <Link href="/patient-dashboard/reports" className="text-xs font-mono uppercase tracking-widest border-b border-black hover:pb-0.5 transition-all">
                    View History
                  </Link>
                </div>

                <div className="border-t border-black/10">
                  {recentActivity.map((activity) => (
                    <div key={activity.id}
                      className="flex items-center justify-between py-4 border-b border-black/10 group hover:bg-black/[0.02] cursor-pointer transition-colors px-2">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-black/5">
                          {getActivityIcon(activity.icon)}
                        </div>
                        <div>
                          <div className="flex items-center space-x-3 mb-1">
                            <span className="font-bold">{activity.title}</span>
                            <StatusBadge status={activity.status as any} size="sm" />
                          </div>
                          <span className="text-sm text-black/50">{activity.description}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-mono text-black/55 block mb-1">
                          {format(parseISO(activity.date), 'MMM dd')}
                        </span>
                      </div>
                    </div>
                  ))}
                  {recentActivity.length === 0 && (
                    <div className="py-8 text-center text-black/55 font-mono text-xs uppercase">
                      No recent activity recorded.
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Column 3: Telehealth & Quick Actions */}
            <div className="space-y-12">
              {/* Telehealth Card */}
              <div className="border border-black/10 p-6 bg-white">
                <div className="mb-6 flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-black/55">
                    Telehealth
                  </span>
                  <Video className="h-4 w-4 text-black/55" />
                </div>
                <h3 className="text-xl font-bold mb-2">Video Consultations</h3>
                <p className="text-sm text-black/60 mb-6 font-light">
                  Connect with your doctors remotely from the comfort of your home.
                </p>
                <Button
                  onClick={() => router.push('/patient-dashboard/video-consultations')}
                  className="w-full bg-black text-white rounded-none h-12 font-mono uppercase tracking-widest text-xs flex items-center justify-between px-4 group"
                >
                  <span>Join Session</span>
                  <ArrowRight className="h-4 w-4 opacity-50 group-hover:translate-x-1 transition-transform" />
                </Button>
              </div>

              {/* Quick Actions List */}
              <div className="border border-black/10 p-6 bg-white">
                <div className="mb-6">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-black/55">
                    Quick Access
                  </span>
                </div>
                <div className="space-y-2">
                  {[
                    { label: 'My Reports', href: '/patient-dashboard/reports', icon: FileText },
                    { label: 'Messages', href: '/patient-dashboard/chat', icon: MessageSquare },
                    { label: 'Appointments', href: '/patient-dashboard/video-consultations', icon: Calendar },
                  ].map((action) => (
                    <button
                      key={action.label}
                      onClick={() => router.push(action.href)}
                      className="w-full flex items-center justify-between p-4 border border-transparent hover:border-black/10 hover:bg-black/[0.02] transition-all group text-left"
                    >
                      <div className="flex items-center space-x-3">
                        <action.icon className="h-4 w-4 text-black/55 group-hover:text-black" />
                        <span className="text-sm font-medium">{action.label}</span>
                      </div>
                      <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
    </ErrorBoundary>
  )
}
