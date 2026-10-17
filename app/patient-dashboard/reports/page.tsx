"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Activity, FileText, Download, Eye, X, ExternalLink, Brain } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"
import { format, parseISO } from "date-fns"
import { testLabel } from "@/lib/utils"

export default function PatientReportsPage() {
  const [user, setUser] = useState<any>(null)
  const [reports, setReports] = useState<any[]>([])
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set())
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

      if (!user || user.app_metadata?.role !== "patient") {
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
        // Which reports a doctor has reviewed (reviews are only for the patient's own reports).
        const { data: reviewRows } = await supabase.from('report_reviews').select('report_id')
        setReviewedIds(new Set((reviewRows || []).map((r: { report_id: string }) => r.report_id)))
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
    <div className="min-h-screen bg-transparent p-6 lg:p-12 max-w-7xl mx-auto">
      <header className="border-b border-black/10 pb-8 mb-12">
        <span className="text-[11px] font-mono uppercase tracking-widest text-black/55">&quot;MY REPORTS&quot;</span>
        <h1 className="mt-4 text-3xl sm:text-4xl font-bold tracking-tight uppercase">My reports</h1>
        <p className="mt-2 max-w-2xl text-lg font-light text-black/60">
          Your test results. Your doctor reviews each one before you see the AI&apos;s reading.
        </p>
      </header>

      <div className="container mx-auto">
        {reports.length === 0 ? (
          <div className="border border-black/10 bg-white p-16 text-center">
            <FileText className="h-12 w-12 text-black/20 mx-auto mb-6" />
            <h3 className="text-2xl font-black uppercase tracking-tight mb-2">No Reports Found</h3>
            <p className="text-black/60 font-light mb-8 max-w-sm mx-auto uppercase text-xs tracking-widest leading-loose">Your medical records will appear here once finalized by your clinical team.</p>
            <Button className="bg-black text-white rounded-none px-8 h-12 uppercase font-mono text-xs" asChild>
              <Link href="/patient-dashboard">Return to Dashboard</Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-8">
            {reports.map((report) => (
              <div key={report.id} className="border border-black/10 bg-white p-6 sm:p-8 relative overflow-hidden group hover:border-black/30 transition-all">
                <div className={`absolute left-0 top-0 h-full w-0.5 ${report.priority === 'urgent' ? 'bg-red-600' : 'bg-black/10'}`}></div>

                <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 md:gap-8">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-black text-white">
                        <FileText className="h-5 w-5" />
                      </div>
                      <h3 className="text-2xl font-black uppercase tracking-tight">{testLabel(report.test_type)}</h3>
                    </div>

                      <div className="flex flex-wrap gap-3 mb-8">
                        <div className="font-mono text-[10px] uppercase font-bold text-black/60 px-2 py-0.5 border border-black/10 bg-black/[0.02] tracking-tighter">
                          {format(parseISO(report.uploaded_at), "d MMM yyyy")}
                        </div>
                        <div className="font-mono text-[10px] uppercase font-bold px-2 py-0.5 border border-black tracking-tighter">
                          {reviewedIds.has(report.id) ? 'REVIEWED BY YOUR DOCTOR' : 'AWAITING DOCTOR REVIEW'}
                        </div>
                      </div>

                    <p className="mb-6 flex items-start gap-2 text-sm text-black/70">
                      <Brain className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
                      {reviewedIds.has(report.id)
                        ? "Your doctor has reviewed this report. Open it to read their notes and the AI's first reading."
                        : "Your doctor is reviewing this report. You'll be notified when their notes are ready."}
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 md:min-w-[200px]">
                    <Button
                      className="bg-black text-white rounded-none h-12 uppercase font-mono text-[10px] tracking-widest flex items-center justify-between px-6"
                      onClick={() => handleViewReportDetails(report.id)}
                    >
                      Open report
                      <ExternalLink className="h-4 w-4" />
                    </Button>

                    <Button
                      variant="outline"
                      className="border-black/20 hover:border-black rounded-none h-12 uppercase font-mono text-[10px] tracking-widest flex items-center justify-between px-6 transition-all"
                      onClick={() => handleViewReport(report)}
                      disabled={viewingReport?.id === report.id}
                    >
                      {viewingReport?.id === report.id ? 'Opening…' : 'View file'}
                      <Eye className="h-4 w-4" />
                    </Button>

                    <Button
                      variant="outline"
                      className="border-black/20 hover:border-black rounded-none h-12 uppercase font-mono text-[10px] tracking-widest flex items-center justify-between px-6 transition-all"
                      onClick={() => handleDownloadReport(report)}
                      disabled={downloadingReport === report.id}
                    >
                      {downloadingReport === report.id ? 'Downloading…' : 'Download'}
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
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-8">
          <div className="bg-white border-2 border-black w-full max-w-5xl h-full flex flex-col relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-indigo-600"></div>

            <div className="flex items-center justify-between p-6 border-b border-black/10">
              <div>
                <h3 className="text-xl font-black uppercase tracking-tight">
                  {testLabel(viewingReport?.test_type)}
                </h3>
                <p className="text-[10px] font-mono text-black/55 uppercase mt-1">{viewingReport?.original_name}</p>
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
