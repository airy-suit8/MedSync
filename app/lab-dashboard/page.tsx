"use client"

import { useEffect, useState, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Activity, Upload, FileText, MessageSquare, Microscope, FlaskConical, Camera, ArrowRight, ClipboardList } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Sidebar from "@/components/medical/navigation/Sidebar"
import StatusBadge from "@/components/medical/common/StatusBadge"
import ErrorBoundary from "@/components/error-boundary"
import DashboardSkeleton from "@/components/medical/common/DashboardSkeleton"

interface LabStats {
  pending: number
  completed: number
  urgent: number
  total: number
}

export default function LabDashboard() {
  const [user, setUser] = useState<any>(null)
  const [shortId, setShortId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<LabStats>({ pending: 0, completed: 0, urgent: 0, total: 0 })
  const [recentReports, setRecentReports] = useState<any[]>([])
  const router = useRouter()
  const loadingRef = useRef(false)

  useEffect(() => {
    const checkUser = async () => {
      if (loadingRef.current) return
      loadingRef.current = true

      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user || user.app_metadata?.role !== "lab") {
        router.push("/login")
        return
      }

      setUser(user)
      try {
        const { data: profile } = await supabase.from('profile_directory').select('short_id').eq('id', user.id).maybeSingle()
        setShortId(profile?.short_id || null)

        const { data: reports, error } = await supabase
          .from('reports')
          .select('id, patient_id, patient_info, test_type, original_name, priority, uploaded_at, created_at, ml_suggestions(status)')
          .eq('uploaded_by', user.id)
          .order('uploaded_at', { ascending: false })
        if (error) throw error

        const uploadedReports = (reports || []).map((r: any) => ({
          ...r,
          status: (Array.isArray(r.ml_suggestions) ? r.ml_suggestions[0]?.status : r.ml_suggestions?.status) || 'pending'
        }))
        
        setRecentReports(uploadedReports)
        setStats({
          pending: uploadedReports.filter((report: any) => ['pending', 'pending_review', 'uploaded', 'in_review', 'processing'].includes((report.status || 'pending').toLowerCase())).length,
          completed: uploadedReports.filter((report: any) => ['completed', 'finalized', 'reviewed'].includes((report.status || '').toLowerCase())).length,
          urgent: uploadedReports.filter((report: any) => ['urgent', 'critical', 'high'].includes((report.priority || '').toLowerCase())).length,
          total: uploadedReports.length,
        })
      } catch (e) {
        console.error('Failed to load lab dashboard data:', e)
      }
      setLoading(false)
      loadingRef.current = false
    }

    checkUser()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/")
  }

  if (loading) {
    return <DashboardSkeleton />
  }

  return (
    <ErrorBoundary componentName="Lab Dashboard">
    <div className="min-h-screen bg-transparent flex">
      <Sidebar userRole="lab" userName={user?.user_metadata?.name} onLogout={handleLogout} />

      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-12">
          {/* Header */}
          <div className="mb-12 border-b border-black/10 pb-8 flex items-end justify-between">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <div className="h-2 w-2 bg-emerald-500 rounded-full animate-pulse"></div>
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-black/55">
                  Laboratory Node Active
                </span>
              </div>
              <h1 className="text-5xl font-black tracking-tighter uppercase mb-2">
                Diagnostics Center
              </h1>
              <p className="text-black/60 font-mono text-xs uppercase tracking-widest italic">
                Advanced Specimen Processing & Analytical Uplink
              </p>
            </div>
            {shortId && (
              <div className="text-right">
                <span className="text-[10px] font-mono uppercase tracking-widest text-black/55 block mb-1">
                  Technician Hash
                </span>
                <span className="text-2xl font-mono border-b-2 border-black tracking-tighter">
                  {shortId}
                </span>
              </div>
            )}
          </div>

          {/* Quick Stats Grid - "Deconstructed" with Saturated Accents */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-black/10 border border-black/10 mb-16">
            <div className="bg-white p-8 hover:bg-black/[0.02] transition-all group cursor-pointer relative overflow-hidden">
              <div className="absolute left-0 top-0 h-full w-0.5 bg-cyan-600"></div>
              <div className="flex justify-between items-start mb-6">
                <FlaskConical className="h-6 w-6 text-black/20 group-hover:text-cyan-600 transition-colors" />
                <span className="text-[10px] font-mono uppercase tracking-widest text-black/20">01</span>
              </div>
              <div className="text-4xl font-black mb-1 tracking-tighter">{stats.pending}</div>
              <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-black/55">Pending Tests</div>
            </div>

            <div className="bg-white p-8 hover:bg-black/[0.02] transition-all group cursor-pointer relative overflow-hidden">
              <div className="absolute left-0 top-0 h-full w-0.5 bg-indigo-600"></div>
              <div className="flex justify-between items-start mb-6">
                <Microscope className="h-6 w-6 text-black/20 group-hover:text-indigo-600 transition-colors" />
                <span className="text-[10px] font-mono uppercase tracking-widest text-black/20">02</span>
              </div>
              <div className="text-4xl font-black mb-1 tracking-tighter">{stats.completed}</div>
              <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-black/55">Completed Cycle</div>
            </div>

            <div className="bg-white p-8 hover:bg-black/[0.02] transition-all group cursor-pointer relative overflow-hidden">
              <div className="absolute left-0 top-0 h-full w-0.5 bg-red-600"></div>
              <div className="flex justify-between items-start mb-6">
                <MessageSquare className="h-6 w-6 text-black/20 group-hover:text-red-600 transition-colors" />
                <span className="text-[10px] font-mono uppercase tracking-widest text-black/20">03</span>
              </div>
              <div className="text-4xl font-black mb-1 tracking-tighter">{stats.urgent}</div>
              <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-red-600/60">Urgent Packets</div>
            </div>

            <div className="bg-white p-8 hover:bg-black/[0.02] transition-all group cursor-pointer relative overflow-hidden">
              <div className="absolute left-0 top-0 h-full w-0.5 bg-emerald-600"></div>
              <div className="flex justify-between items-start mb-6">
                <Activity className="h-6 w-6 text-black/20 group-hover:text-emerald-600 transition-colors" />
                <span className="text-[10px] font-mono uppercase tracking-widest text-black/20">04</span>
              </div>
              <div className="text-4xl font-black mb-1 tracking-tighter">{stats.total}</div>
              <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-black/55">Total Uploaded</div>
            </div>
          </div>

          {/* Main Features */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
            {[
              { title: 'Upload Results', desc: 'Securely uplink diagnostic reports to patient records', href: '/lab-dashboard/upload', icon: Upload, accent: 'bg-indigo-600' },
              { title: 'Sample Mgmt', desc: 'Real-time tracking of biological specimens and telemetry', href: '/lab-dashboard/samples', icon: Microscope, accent: 'bg-indigo-600' },
              { title: 'Imaging Center', desc: 'Process high-resolution radiological data packets', href: '/lab-dashboard/imaging', icon: Camera, accent: 'bg-indigo-600' }
            ].map((feature, i) => (
              <div key={i} className="group border border-black/10 bg-white hover:border-black/30 transition-all cursor-pointer p-10 relative overflow-hidden">
                <div className={`absolute bottom-0 left-0 w-full h-0.5 ${feature.accent}`}></div>
                <div className="relative z-10">
                  <div className="mb-8 p-4 bg-black text-white inline-block">
                    <feature.icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-2xl font-black uppercase tracking-tight mb-3">{feature.title}</h3>
                  <p className="text-black/50 mb-10 text-sm font-mono uppercase leading-relaxed">{feature.desc}</p>
                  <Button className="w-full bg-black text-white rounded-none hover:bg-indigo-600 font-mono uppercase text-[10px] tracking-[0.2em] h-14 flex items-center justify-between px-8 transition-all" asChild>
                    <Link href={feature.href}>
                      <span>Establish Link</span>
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Recent Activity & Urgent Items */}
          <div className="grid lg:grid-cols-2 gap-16">
            <div className="border border-black/10 p-10 bg-white relative">
              <div className="absolute top-0 left-0 w-full h-0.5 bg-red-600"></div>
              <div className="flex items-center justify-between mb-10 border-b border-black/10 pb-6">
                <h3 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-3">
                  <span className="h-3 w-3 bg-red-600 rounded-full animate-pulse"></span>
                  Priority Packets
                </h3>
                <span className="text-[10px] font-mono uppercase tracking-widest text-red-600 bg-red-50 px-3 py-1 border border-red-100">Critical Priority</span>
              </div>

              <div className="space-y-6">
                {recentReports.filter((report: any) => ['urgent', 'critical', 'high'].includes((report.priority || '').toLowerCase())).map((item: any) => (
                  <div key={item.id} className="flex items-start gap-6 p-6 border border-black/5 hover:border-black/20 transition-all group">
                    <div className="p-3 bg-black/[0.03] group-hover:bg-black group-hover:text-white transition-colors">
                      <item.icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-black font-mono text-xs text-black/55">#{item.id}</span>
                        <StatusBadge status={item.badge as any} size="sm" />
                      </div>
                      <p className="font-bold text-lg uppercase tracking-tight mb-1">{item.test_type || item.original_name || 'Medical report'}</p>
                      <p className="text-[10px] font-mono text-black/50 uppercase leading-relaxed">{item.status || 'Awaiting review'}</p>
                    </div>
                  </div>
                ))}
                {recentReports.filter((report: any) => ['urgent', 'critical', 'high'].includes((report.priority || '').toLowerCase())).length === 0 && <p className="text-sm font-mono text-black/55">No urgent uploads.</p>}
              </div>
            </div>

            <div className="border border-black/10 p-10 bg-white relative">
              <div className="absolute top-0 left-0 w-full h-0.5 bg-emerald-600"></div>
              <div className="flex items-center justify-between mb-10 border-b border-black/10 pb-6">
                <h3 className="text-2xl font-black uppercase tracking-tighter">Log History</h3>
                <Link href="/lab-dashboard/upload" className="text-[10px] font-mono uppercase tracking-widest border-b-2 border-black hover:border-emerald-600 transition-colors">
                  View Archive
                </Link>
              </div>

              <div className="space-y-6">
                {recentReports.slice(0, 3).map((item: any) => (
                  <div key={item.id} className="flex items-center gap-6 p-6 border border-black/5 hover:border-black/20 transition-all group">
                    <div className="p-3 bg-black text-white">
                      <Upload className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-bold text-lg uppercase tracking-tight">{item.test_type || item.original_name || 'Medical report'}</span>
                        <span className="text-[10px] font-mono text-black/55 uppercase tracking-widest">{item.patient_id}</span>
                      </div>
                      <p className="text-[10px] font-mono text-black/50 uppercase leading-relaxed">Uploaded {item.uploaded_at ? new Date(item.uploaded_at).toLocaleDateString() : 'date unavailable'}</p>
                    </div>
                    <StatusBadge status={item.status || 'pending'} size="sm" />
                  </div>
                ))}
                {recentReports.length === 0 && <p className="text-sm font-mono text-black/55">No reports uploaded yet.</p>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </ErrorBoundary>
  )
}
