"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Users, FileText, Calendar, Brain,
  AlertCircle, ArrowRight, Video, Clock,
  Sparkles
} from "lucide-react"
import { createClient } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import Link from "next/link"
import { format, parseISO } from "date-fns"
import Sidebar from "@/components/medical/navigation/Sidebar"
import { useAuthCheck } from "@/hooks/use-auth-check"
import ErrorBoundary from "@/components/error-boundary"
import { pressable } from "@/lib/utils"
import DashboardSkeleton from "@/components/medical/common/DashboardSkeleton"
import ConsultationRequests from "@/components/medical/ConsultationRequests"

interface UrgentReview {
  id: string
  patient_name: string
  report_type: string
  description: string
  priority: 'urgent' | 'high' | 'normal'
  created_at: string
  status: string
}

interface AIInsight {
  id: string
  type: string
  title: string
  description: string
  created_at: string
  priority: string
}

interface Appointment {
  id: string
  patient_name: string
  appointment_date: string
  start_time: string
  end_time: string
  consultation_type: string
  status: string
  notes?: string
}

interface DoctorStats {
  activePatients: number
  pendingReviews: number
  consultations: number
  aiInsights: number
}

const PENDING_REVIEW_STATUSES = ['pending', 'pending_review', 'uploaded', 'in_review']

export default function DoctorDashboard() {
  const { user, shortId, loading: authLoading } = useAuthCheck("doctor")
  const [dataLoading, setDataLoading] = useState(true)
  const [urgentReviews, setUrgentReviews] = useState<UrgentReview[]>([])
  const [todayAppointments, setTodayAppointments] = useState<Appointment[]>([])
  const [aiInsights, setAiInsights] = useState<AIInsight[]>([])
  const [stats, setStats] = useState<DoctorStats>({
    activePatients: 0,
    pendingReviews: 0,
    consultations: 0,
    aiInsights: 0
  })
  const [selectedReview, setSelectedReview] = useState<UrgentReview | null>(null)
  const [selectedInsight, setSelectedInsight] = useState<AIInsight | null>(null)
  const router = useRouter()

  useEffect(() => {
    if (!authLoading && user) {
      loadDashboardData(user.id)
    }
  }, [authLoading, user])

  const loadDashboardData = async (authUserId: string) => {
    const supabase = createClient()
    setDataLoading(true)
    try {
      const today = format(new Date(), 'yyyy-MM-dd')

      // Today's appointments, the doctor's reports and pending AI insights don't depend
      // on each other, so they load in one round trip.
      const [{ data: appts }, { data: reports }, suggestionsResult] = await Promise.all([
        supabase
          .from('appointments')
          .select('*')
          .eq('doctor_id', authUserId)
          .eq('appointment_date', today)
          .neq('status', 'requested') // unanswered requests are listed in ConsultationRequests
          .order('start_time', { ascending: true }),
        supabase
          .from('reports')
          .select('*')
          .eq('doctor_id', authUserId)
          .order('created_at', { ascending: false }),
        supabase
          .from('ml_suggestions')
          .select('id, test_type, findings, confidence, severity, processed_at')
          .eq('status', 'pending_review')
          .order('processed_at', { ascending: false })
          .limit(5),
      ])

      setTodayAppointments(appts || [])

      // 4. Keep only truly pending reports for dashboard review widgets
      const pendingReports = (reports || []).filter((report: any) =>
        PENDING_REVIEW_STATUSES.includes((report.status || 'pending').toLowerCase())
      )

      // 5. Calculate Stats
      // Active patients = unique patients from appointments + reports
      const patientIds = new Set([
        ...(appts?.map((a: any) => a.patient_id) || []),
        ...(reports?.map((r: any) => r.patient_id) || [])
      ].filter(Boolean))

      // Fetch patient profiles for mapping names (using profile_directory view)
      const patientIdArray = Array.from(patientIds)
      const { data: profiles } = await supabase
        .from('profile_directory')
        .select('id, name')
        .in('id', patientIdArray.length > 0 ? patientIdArray : ['dummy'])

      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p.name]))

      setStats({
        activePatients: patientIds.size,
        pendingReviews: pendingReports.length,
        consultations: appts?.length || 0,
        aiInsights: 0 // Placeholder until AI insights table exists
      })

      const reviews = pendingReports.slice(0, 8).map((report: any) => ({
        id: report.id,
        patient_name: profileMap.get(report.patient_id) || report.patient_name || 'Unknown Patient',
        report_type: report.report_type || report.test_type || 'Medical Report',
        description: report.description || 'Report requires review',
        priority: (report.priority as any) || 'normal',
        created_at: report.created_at || report.uploaded_at,
        status: report.status || 'pending'
      })) || []
      
      setUrgentReviews(reviews)

      // Real AI insights from the ml_suggestions query above
      try {
        const { data: suggestions, error: suggestionsError } = suggestionsResult
        if (suggestionsError) throw suggestionsError

        if (suggestions && suggestions.length > 0) {
          setAiInsights(suggestions.map((s: any) => ({
            id: s.id,
            type: s.test_type || 'analysis',
            title: `${(s.test_type || 'scan').toUpperCase()} Analysis — ${Math.round((s.confidence || 0) * 100)}% confidence`,
            description: s.findings || 'Analysis complete. Review recommended.',
            created_at: s.processed_at || today,
            priority: s.severity === 'critical' || s.severity === 'severe' ? 'high' : 'normal',
          })))
          setStats(prev => ({ ...prev, aiInsights: suggestions.length }))
        } else {
          setAiInsights([])
        }
      } catch (insightErr) {
        console.warn('Could not fetch AI insights:', insightErr)
        setAiInsights([])
      }

    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setDataLoading(false)
    }
  }


  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/")
  }

  if (authLoading || dataLoading) {
    return <DashboardSkeleton />
  }

  const urgentCount = urgentReviews.filter(r => r.priority === 'urgent').length
  const greeting = new Date().getHours() < 12 ? 'Good Morning' : new Date().getHours() < 18 ? 'Good Afternoon' : 'Good Evening'

  return (
    <ErrorBoundary componentName="Doctor Dashboard">
    <div className="min-h-screen bg-transparent flex">
      <Sidebar userRole="doctor" userName={user?.user_metadata?.name} onLogout={handleLogout} />

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
              <h1 className="text-4xl font-bold tracking-tight mb-2 uppercase">
                {greeting}, Dr. {user?.user_metadata?.name?.split(' ').pop()}
              </h1>
              <p className="text-black/60 font-light text-lg">
                {format(new Date(), 'EEEE, MMMM d, yyyy')} <span className="mx-2">•</span> {stats.consultations} {stats.consultations === 1 ? 'appointment' : 'appointments'} today
              </p>
            </div>
            {shortId && (
              <div className="text-right">
                <span className="text-[10px] font-mono uppercase tracking-widest text-black/55 block mb-1">
                  Physician ID
                </span>
                <span className="text-xl font-mono border-b border-black">
                  {shortId}
                </span>
              </div>
            )}
          </div>

          {/* Urgent Alert */}
          {urgentCount > 0 && (
            <div className="border border-red-500/30 p-8 bg-red-50 mb-16 flex items-start gap-6 relative overflow-hidden">
              <div className="absolute bottom-0 left-0 w-full h-0.5 bg-red-600"></div>
              <div className="p-3 bg-red-600 text-white inline-block">
                 <AlertCircle className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-red-900 mb-2 uppercase tracking-tight">
                  Urgent: {urgentCount} {urgentCount === 1 ? 'Report Requires' : 'Reports Require'} Immediate Attention
                </h2>
                <div className="space-y-2 mb-6">
                  {urgentReviews.filter(r => r.priority === 'urgent').slice(0, 2).map((review) => (
                    <div key={review.id} className="flex items-start text-red-800 font-mono text-sm">
                      <span className="mr-2 mt-1 font-bold">»</span>
                      <span><strong>{review.patient_name}</strong> : {review.report_type} : {review.description}</span>
                    </div>
                  ))}
                </div>
                <Button
                  onClick={() => router.push('/doctor-dashboard/reports')}
                  className="bg-red-600 hover:bg-red-700 text-white rounded-none font-mono uppercase text-xs h-12 flex items-center justify-between px-8 w-full max-w-md border border-red-700"
                >
                  <div className="flex items-center">
                    <FileText className="mr-2 h-4 w-4" />
                    <span>Review Urgent Reports Now</span>
                  </div>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {user && <ConsultationRequests doctorId={user.id} />}

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-black/10 border border-black/10 mb-16">
            <div className="bg-white p-6 hover:bg-black/[0.02] transition-colors group cursor-pointer relative" {...pressable(() => router.push('/doctor-dashboard/reports'))}>
              <div className="flex justify-between items-start mb-4">
                <Users className="h-5 w-5 text-black/55 group-hover:text-black transition-colors" />
                <span className="text-[10px] font-mono uppercase tracking-widest text-black/55">01</span>
              </div>
              <div className="text-3xl font-bold mb-1">{stats.activePatients}</div>
              <div className="text-xs font-mono uppercase tracking-wider text-black/60">Active Patients</div>
              <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600"></div>
            </div>

            <div className="bg-white p-6 hover:bg-black/[0.02] transition-colors group cursor-pointer relative" {...pressable(() => router.push('/doctor-dashboard/reports'))}>
              <div className="flex justify-between items-start mb-4">
                <FileText className="h-5 w-5 text-black/55 group-hover:text-black transition-colors" />
                <span className="text-[10px] font-mono uppercase tracking-widest text-black/55">02</span>
              </div>
              <div className="text-3xl font-bold mb-1">{stats.pendingReviews}</div>
              <div className="text-xs font-mono uppercase tracking-wider text-black/60">Pending Reports</div>
              <div className="absolute bottom-0 left-0 w-full h-0.5 bg-red-600"></div>
            </div>

            <div className="bg-white p-6 hover:bg-black/[0.02] transition-colors group cursor-pointer relative" {...pressable(() => router.push('/doctor-dashboard/consultations'))}>
              <div className="flex justify-between items-start mb-4">
                <Video className="h-5 w-5 text-black/55 group-hover:text-black transition-colors" />
                <span className="text-[10px] font-mono uppercase tracking-widest text-black/55">03</span>
              </div>
              <div className="text-3xl font-bold mb-1">{stats.consultations}</div>
              <div className="text-xs font-mono uppercase tracking-wider text-black/60">Consultations</div>
              <div className="absolute bottom-0 left-0 w-full h-0.5 bg-cyan-600"></div>
            </div>

            <div className="bg-white p-6 hover:bg-black/[0.02] transition-colors group cursor-pointer relative" {...pressable(() => router.push('/doctor-dashboard/ai-assistant'))}>
              <div className="flex justify-between items-start mb-4">
                <Brain className="h-5 w-5 text-black/55 group-hover:text-black transition-colors" />
                <span className="text-[10px] font-mono uppercase tracking-widest text-black/55">04</span>
              </div>
              <div className="text-3xl font-bold mb-1">{stats.aiInsights}</div>
              <div className="text-xs font-mono uppercase tracking-wider text-black/60">AI Insights</div>
              <div className="absolute bottom-0 left-0 w-full h-0.5 bg-amber-600"></div>
            </div>
          </div>

          {/* Quick Actions (Main Features) */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
            {[
              {
                icon: Video,
                title: 'Consultation',
                desc: 'Begin video call with patient',
                href: '/doctor-dashboard/consultations',
                color: 'bg-cyan-600'
              },
              {
                icon: FileText,
                title: 'View Reports',
                desc: 'Review patient medical reports',
                href: '/doctor-dashboard/reports',
                color: 'bg-red-600'
              },
              {
                icon: Brain,
                title: 'AI Assistant',
                desc: 'Get diagnostic suggestions',
                href: '/doctor-dashboard/ai-assistant',
                color: 'bg-amber-600'
              },
              {
                icon: Calendar,
                title: 'Schedule',
                desc: 'Manage appointments & time',
                href: '/doctor-dashboard/schedule',
                color: 'bg-indigo-600'
              }
            ].map((action, idx) => (
              <div key={idx} className="group border border-black/10 bg-white hover:border-black/30 transition-all cursor-pointer p-6 relative overflow-hidden flex flex-col justify-between">
                <div className={`absolute left-0 top-0 h-full w-0.5 ${action.color}`}></div>
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                  <action.icon className="h-24 w-24" />
                </div>
                <div className="relative z-10 mb-8">
                  <div className="mb-6 p-2 bg-black text-white inline-block group-hover:scale-105 transition-transform">
                    <action.icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-xl font-bold mb-2 uppercase tracking-tight">{action.title}</h3>
                  <p className="text-black/60 font-light text-sm">{action.desc}</p>
                </div>
                <Button className="w-full bg-black text-white rounded-none hover:bg-black/80 font-mono uppercase text-xs h-10 flex items-center justify-between px-4" asChild>
                  <Link href={action.href} className="relative z-10 mt-auto">
                    <span>Access Now</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </Button>
              </div>
            ))}
          </div>

          {/* Main Content Grid: Today's Schedule + Pending Reviews */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left: Today's Schedule */}
            <div className="lg:col-span-2 space-y-6">
              <div className="border border-black/10 p-6 bg-white">
                <div className="flex items-center justify-between mb-6 border-b border-black/10 pb-4">
                  <h3 className="text-xl font-bold uppercase flex items-center gap-2">
                    <span className="h-2 w-2 bg-black rounded-full"></span>
                     Today&apos;s Appointments
                  </h3>
                  <span className="text-[10px] font-mono uppercase border border-black/10 bg-black/5 px-2 py-1">
                    {stats.consultations} scheduled
                  </span>
                </div>
                
                {todayAppointments.length > 0 ? (
                  <div className="space-y-4">
                    {todayAppointments.slice(0, 5).map((apt) => (
                      <div key={apt.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border border-black/5 hover:bg-black/[0.02] transition-colors group">
                        <div className="flex items-center gap-4 flex-1 mb-4 sm:mb-0">
                          <div className="bg-black/5 p-3 text-black">
                            <Clock className="h-5 w-5 mb-1 mx-auto" />
                            <div className="font-mono text-xs font-bold whitespace-nowrap">
                              {apt.start_time.substring(0, 5)}
                            </div>
                          </div>
                          <div>
                            <div className="font-bold text-lg mb-1 uppercase">{apt.patient_name}</div>
                            <div className="text-sm text-black/60 uppercase">{apt.consultation_type} Consultation</div>
                            <div className="text-xs font-mono mt-1 text-black/55 uppercase">
                              {apt.status === 'confirmed' ? 'Ready' : apt.status}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 w-full sm:w-auto">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="flex-1 sm:flex-none border-black/20 rounded-none font-mono uppercase text-xs"
                            onClick={() => router.push(`/doctor-dashboard/reports?patient=${apt.id}`)}
                          >
                            Chart
                          </Button>
                          <Button 
                            size="sm" 
                            className="flex-1 sm:flex-none bg-black text-white rounded-none hover:bg-black/80 font-mono uppercase text-xs"
                            onClick={() => router.push('/doctor-dashboard/consultations')}
                          >
                            Join Video
                          </Button>
                        </div>
                      </div>
                    ))}
                    <Button
                      variant="ghost"
                      className="w-full mt-2 rounded-none font-mono uppercase text-xs border border-transparent hover:border-black/10 text-black/60 hover:text-black flex justify-between px-4"
                      onClick={() => router.push('/doctor-dashboard/schedule')}
                    >
                      <span>View Full Schedule</span>
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-12 border border-black/5">
                    <Calendar className="h-12 w-12 text-black/20 mx-auto mb-4" />
                    <p className="text-black/60 font-mono uppercase text-sm mb-4">No appointments scheduled</p>
                    <Button
                      variant="outline"
                      className="rounded-none font-mono uppercase text-xs border-black/20"
                      onClick={() => router.push('/doctor-dashboard/schedule')}
                    >
                      View Schedule
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Pending Reviews & AI Insights */}
            <div className="space-y-6">
              
              {/* Pending Reviews */}
              <div className="border border-black/10 p-6 bg-white">
                <div className="flex items-center justify-between mb-6 border-b border-black/10 pb-4">
                  <h3 className="text-xl font-bold uppercase">Pending Reviews</h3>
                  <Link href="/doctor-dashboard/reports" className="text-xs font-mono uppercase tracking-widest border-b border-black hover:pb-0.5">
                    View All
                  </Link>
                </div>
                
                <div className="space-y-4">
                  {urgentReviews.slice(0, 4).map((review) => (
                    <div
                      key={review.id}
                      className="flex items-start justify-between p-4 border border-black/5 hover:bg-black/[0.02] cursor-pointer transition-colors group"
                      {...pressable(() => setSelectedReview(review))}
                    >
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-sm">{review.patient_name}</span>
                          <span className={`text-xs font-mono font-bold uppercase px-2 py-0.5 border tracking-tighter ${
                            review.priority === 'urgent' ? 'border-red-600 text-red-600 bg-red-50' : 
                            'border-amber-600 text-amber-600 bg-amber-50'
                          }`}>
                            {review.priority}
                          </span>
                        </div>
                        <p className="text-xs text-black/60 mb-1">{review.report_type}</p>
                        <p className="text-[11px] font-mono text-black/55">{format(parseISO(review.created_at), 'MMM d, yyyy')}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 ml-3 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  ))}
                  {urgentReviews.length === 0 && (
                     <div className="text-center py-8 text-black/55 font-mono text-xs uppercase">No pending reviews</div>
                  )}
                </div>
              </div>

              {/* AI Insights */}
              {aiInsights.length > 0 && (
                <div className="border border-black/10 p-6 bg-white">
                  <div className="flex items-center justify-between mb-6 border-b border-black/10 pb-4">
                    <h3 className="text-xl font-bold uppercase flex items-center gap-2">
                      <Sparkles className="h-4 w-4" />
                      AI Insights
                    </h3>
                  </div>
                  <div className="space-y-4">
                    {aiInsights.slice(0, 2).map((insight) => (
                      <div
                        key={insight.id}
                        className="p-4 border border-black/5 hover:bg-black/[0.02] cursor-pointer transition-colors"
                        {...pressable(() => setSelectedInsight(insight))}
                      >
                        <div className="flex items-start gap-2 mb-2">
                          <Brain className="h-4 w-4 mt-0.5 text-black/55" />
                          <h4 className="font-bold text-sm">{insight.title}</h4>
                        </div>
                        <p className="text-xs text-black/60 line-clamp-2">{insight.description}</p>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      className="w-full rounded-none font-mono uppercase text-xs border-black/10 mt-4"
                      onClick={() => router.push('/doctor-dashboard/ai-assistant')}
                    >
                      View All Suggestions
                    </Button>
                  </div>
                </div>
              )}
              
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <Dialog open={!!selectedReview} onOpenChange={() => setSelectedReview(null)}>
        <DialogContent className="sm:max-w-lg border border-black/10 rounded-none bg-white p-0 shadow-2xl">
          <div className="p-6 border-b border-black/10">
            <DialogTitle className="text-2xl font-bold uppercase mb-2">Report Review</DialogTitle>
            <DialogDescription className="text-sm font-mono text-black/60">
              {selectedReview?.patient_name} • <span className={`uppercase font-bold ${selectedReview?.priority === 'urgent' ? 'text-red-600' : 'text-yellow-600'}`}>{selectedReview?.priority}</span> PRIORITY
            </DialogDescription>
          </div>
          <div className="p-6 space-y-6">
            <div className="border border-black/5 p-4 bg-black/[0.02]">
              <p className="text-[11px] font-mono uppercase tracking-widest text-black/55 mb-1">Report Type</p>
              <p className="text-lg font-bold">{selectedReview?.report_type}</p>
            </div>
            <div className="border border-black/5 p-4 bg-black/[0.02]">
              <p className="text-[11px] font-mono uppercase tracking-widest text-black/55 mb-1">Description</p>
              <p className="text-sm">{selectedReview?.description}</p>
            </div>
            <div className="border border-black/5 p-4 bg-black/[0.02]">
              <p className="text-[11px] font-mono uppercase tracking-widest text-black/55 mb-1">Date</p>
              <p className="text-sm font-mono">
                {selectedReview ? format(parseISO(selectedReview.created_at), 'MMMM d, yyyy') : ''}
              </p>
            </div>
            <div className="flex gap-4 pt-4">
              <Button
                className="flex-1 bg-black hover:bg-black/80 text-white rounded-none font-mono uppercase text-xs h-12"
                onClick={() => selectedReview && router.push(`/doctor-dashboard/reports?review=${selectedReview.id}`)}
              >
                Open Full Report
              </Button>
              <Button
                variant="outline"
                className="flex-1 rounded-none border-black/20 font-mono uppercase text-xs h-12"
                onClick={() => setSelectedReview(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedInsight} onOpenChange={() => setSelectedInsight(null)}>
        <DialogContent className="sm:max-w-lg border border-black/10 rounded-none bg-white p-0 shadow-2xl">
          <div className="p-6 border-b border-black/10">
            <DialogTitle className="text-2xl font-bold uppercase flex items-center gap-2 mb-2">
              <Brain className="h-6 w-6" />
              AI Insight
            </DialogTitle>
            <DialogDescription className="text-sm font-mono text-black/60">
              GENERATED {selectedInsight ? format(parseISO(selectedInsight.created_at), 'MMMM d, yyyy').toUpperCase() : ''}
            </DialogDescription>
          </div>
          <div className="p-6">
            <div className="border border-black/5 p-6 bg-black/[0.02] mb-6">
              <h3 className="font-bold text-xl mb-4">{selectedInsight?.title}</h3>
              <p className="text-black/80 leading-relaxed text-sm">{selectedInsight?.description}</p>
            </div>
            <div className="flex gap-4">
              <Button
                className="flex-1 bg-black hover:bg-black/80 text-white rounded-none font-mono uppercase text-xs h-12"
                onClick={() => selectedInsight && router.push(`/doctor-dashboard/ai-assistant?insight=${selectedInsight.id}`)}
              >
                View Full Analysis
              </Button>
              <Button
                variant="outline"
                className="flex-1 rounded-none border-black/20 font-mono uppercase text-xs h-12"
                onClick={() => setSelectedInsight(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
    </ErrorBoundary>
  )
}
