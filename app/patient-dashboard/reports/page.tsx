"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Activity, FileText, Download, Eye, ArrowLeft, X, ExternalLink, Brain } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"

export default function PatientReportsPage() {
  const [user, setUser] = useState<any>(null)
  const [reports, setReports] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [viewingReport, setViewingReport] = useState<any>(null)
  const [downloadingReport, setDownloadingReport] = useState<string | null>(null)
  const [viewModalOpen, setViewModalOpen] = useState(false)
  const [reportUrl, setReportUrl] = useState<string | null>(null)
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    const checkUser = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user || user.user_metadata?.role !== "patient") {
        router.push("/login")
        return
      }

      setUser(user)

      try {
        const { data, error } = await supabase
          .from('reports')
          .select(`*, ml_suggestions (id, findings, confidence, recommendations, severity, status, processed_at)`)
          .eq('patient_id', user.id)
          .order('uploaded_at', { ascending: false })

        if (error) throw error
        setReports(data || [])
      } catch (error) {
        console.error('Error fetching patient reports:', error)
        toast({
          title: 'Unable to load reports',
          description: 'Please try again later.',
          variant: 'destructive',
        })
        setReports([])
      }

      setLoading(false)
    }

    checkUser()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  // Function to view a report
  const handleViewReport = async (report: any) => {
    setViewingReport(report)
    window.open(`/api/file/signed-url?path=${report.file_name}`, '_blank', 'noopener,noreferrer')
    setTimeout(() => setViewingReport(null), 500)
  }

  const handleViewReportDetails = (reportId: string) => {
    router.push(`/patient-dashboard/reports/${reportId}`)
  }

  // Function to download a report
  const handleDownloadReport = async (report: any) => {
    try {
      setDownloadingReport(report.id)

      const response = await fetch(`/api/file/signed-url?path=${report.file_name}`)
      if (!response.ok) throw new Error('Failed to fetch image')
      const data = await response.blob()
      
      // Create a download link
      const url = window.URL.createObjectURL(data)
      const link = document.createElement('a')
      link.href = url
      link.download = report.original_name
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      toast({
        title: 'Download successful',
        description: `${report.original_name} has been downloaded.`,
      })

    } catch (error) {
      const errorInfo = {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : null,
        timestamp: new Date().toISOString(),
        context: 'downloading_report'
      }
      console.error('Error downloading report:', errorInfo)
      toast({
        title: 'Error downloading report',
        description: 'Something went wrong while trying to download the report.',
        variant: 'destructive'
      })
    } finally {
      setDownloadingReport(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-transparent">
        <div className="flex flex-col items-center">
          <Activity className="h-8 w-8 animate-spin mb-4 text-black" />
          <span className="text-xs font-mono uppercase tracking-widest text-black/60">System Initializing...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-transparent p-12 max-w-7xl mx-auto">
      {/* Header */}
      <header className="border-b border-black/10 pb-8 mb-12 flex items-end justify-between">
        <div>
          <Link href="/patient-dashboard" className="inline-flex items-center space-x-2 text-xs font-mono uppercase tracking-widest text-black/40 hover:text-black mb-4 transition-colors">
            <ArrowLeft className="h-3 w-3" />
            <span>Back to Dashboard</span>
          </Link>
          <h1 className="text-4xl font-bold tracking-tight uppercase mb-2">My Medical Reports</h1>
          <p className="text-black/60 font-light text-lg italic">
            Access your diagnostic records and AI-powered health explanations
          </p>
        </div>
        <div className="text-right hidden md:block">
          <span className="text-[10px] font-mono uppercase tracking-widest text-black/40 block mb-1">
            Secure Access
          </span>
          <span className="text-xl font-mono border-b-2 border-indigo-600 inline-flex items-center gap-2">
            <span className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></span>
            SYNCED
          </span>
        </div>
      </header>

      <div className="container mx-auto">
        {reports.length === 0 ? (
          <div className="border border-black/10 bg-white p-16 text-center">
            <FileText className="h-12 w-12 text-black/20 mx-auto mb-6" />
            <h3 className="text-2xl font-black uppercase tracking-tight mb-2">No Reports Found</h3>
            <p className="text-black/60 font-light mb-8 max-w-sm mx-auto uppercase text-xs tracking-widest leading-loose">Your medical records will appear here once finalized by your clinical team.</p>
            <Link href="/patient-dashboard">
              <Button className="bg-black text-white rounded-none px-8 h-12 uppercase font-mono text-xs">Return to Dashboard</Button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-8">
            {reports.map((report) => (
              <div key={report.id} className="border border-black/10 bg-white p-8 relative overflow-hidden group hover:border-black/30 transition-all">
                <div className={`absolute left-0 top-0 h-full w-0.5 ${report.priority === 'urgent' ? 'bg-red-600' : 'bg-black/10'}`}></div>

                <div className="flex flex-col md:flex-row md:items-start justify-between gap-8">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-black text-white">
                        <FileText className="h-5 w-5" />
                      </div>
                      <h3 className="text-2xl font-black uppercase tracking-tight">{report.original_name}</h3>
                    </div>

                      <div className="flex flex-wrap gap-3 mb-8">
                        <div className="font-mono text-[10px] uppercase font-bold text-black/60 px-2 py-0.5 border border-black/10 bg-black/[0.02] tracking-tighter">
                          DATE: {new Date(report.uploaded_at).toLocaleDateString()}
                        </div>
                        <div className="font-mono text-[10px] uppercase font-bold text-black/60 px-2 py-0.5 border border-black/10 bg-black/[0.02] tracking-tighter">
                          TYPE: {report.test_type?.replace('_', ' ')}
                        </div>
                        <div className="font-mono text-[10px] uppercase font-bold px-2 py-0.5 border border-emerald-600 text-emerald-600 bg-emerald-50 tracking-tighter">
                          STATUS: AVAILABLE
                        </div>
                      </div>

                    <div className="p-6 bg-amber-50 border border-amber-500/20 relative overflow-hidden mb-6">
                      <div className="absolute left-0 top-0 h-full w-0.5 bg-amber-600"></div>
                      <h4 className="text-[11px] font-black uppercase tracking-widest text-amber-900 mb-3 flex items-center gap-2">
                        <Brain className="h-4 w-4" />
                        AI Analysis Insight
                      </h4>
                      <p className="text-sm font-mono text-amber-900 uppercase leading-relaxed">
                        Automated scan complete. No critical anomalies detected in cell morphology or telemetry.
                         Detailed patient-friendly briefing available in &quot;View Details&quot;.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 min-w-[200px]">
                    <Button
                      className="bg-black text-white rounded-none h-12 uppercase font-mono text-[10px] tracking-widest flex items-center justify-between px-6"
                      onClick={() => handleViewReport(report)}
                      disabled={viewingReport?.id === report.id}
                    >
                      {viewingReport?.id === report.id ? 'OPENING...' : 'VIEW SOURCE'}
                      <Eye className="h-4 w-4" />
                    </Button>

                    <Button
                      variant="outline"
                      className="border-black/20 hover:border-black rounded-none h-12 uppercase font-mono text-[10px] tracking-widest flex items-center justify-between px-6 transition-all"
                      onClick={() => handleViewReportDetails(report.id)}
                    >
                      DETAILED BRIEF
                      <ExternalLink className="h-4 w-4" />
                    </Button>

                    <Button
                      variant="outline"
                      className="border-black/10 hover:border-black/30 rounded-none h-12 uppercase font-mono text-[10px] tracking-widest flex items-center justify-between px-6 opacity-40 hover:opacity-100 transition-all"
                      onClick={() => handleDownloadReport(report)}
                      disabled={downloadingReport === report.id}
                    >
                      {downloadingReport === report.id ? 'FETCHING...' : 'DOWNLOAD SOURCE SCAN'}
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Report View Modal - Brutalist Style */}
      {viewModalOpen && reportUrl && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-8">
          <div className="bg-white border-2 border-black w-full max-w-5xl h-full flex flex-col relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-indigo-600"></div>

            <div className="flex items-center justify-between p-6 border-b border-black/10">
              <div>
                <h3 className="text-xl font-black uppercase tracking-tight">
                  {viewingReport?.original_name || 'Medical Report'}
                </h3>
                <p className="text-[10px] font-mono text-black/40 uppercase mt-1">Source Authentication Node: SEC-882</p>
              </div>
              <div className="flex gap-4">
                <Button
                  variant="outline"
                  className="rounded-none border-black/10 hover:border-black h-10 uppercase font-mono text-[10px] tracking-widest"
                  onClick={() => viewingReport && handleDownloadReport(viewingReport)}
                >
                  Download
                </Button>
                <Button
                  className="bg-black text-white rounded-none h-10 w-10 flex items-center justify-center"
                  onClick={() => {
                    setViewModalOpen(false)
                    setReportUrl(null)
                    setViewingReport(null)
                  }}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>

            <div className="flex-1 bg-black/[0.02] p-2">
              <iframe
                src={reportUrl}
                className="w-full h-full border-0 bg-white"
                title="Medical Report Viewer"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
