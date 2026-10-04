"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Activity, FileText, Search, ArrowLeft, Eye, Download, MessageSquare, Brain, AlertTriangle, CheckCircle, Clock, ExternalLink } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import FilePreview from "@/components/file-preview"
import { useToast } from "@/hooks/use-toast"

interface Report {
  id: string
  patient_id: string
  test_type: string
  original_name: string
  file_name: string
  uploaded_at: string
  priority: string
  notes?: string
  user_name?: string
  ml_suggestion?: any
}

export default function DoctorPatientManagementPage() {
  const [user, setUser] = useState<any>(null)
  const [reports, setReports] = useState<Report[]>([])
  const [assignedPatients, setAssignedPatients] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [loading, setLoading] = useState(true)
  const [selectedReport, setSelectedReport] = useState<Report | null>(null)
  const [showReportModal, setShowReportModal] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    const checkUser = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user || user.user_metadata?.role !== "doctor") {
        router.push("/login")
        return
      }
      
      setUser(user)
      console.log('Loading reports for doctor...')
      
      // Get doctor's short ID for filtering
      let doctorShortId: string | null = null
      try {
        const { data: shortIdData } = await supabase
          .from('profile_directory')
          .select('short_id')
          .eq('id', user.id)
          .maybeSingle()
        doctorShortId = shortIdData?.short_id || null
      } catch (shortIdError) {
        console.warn('Could not fetch doctor short ID:', shortIdError)
      }

      // Fetch reports for this doctor only (simplified - no joins)
      const { data: reportsData, error } = await supabase
        .from('reports')
        .select('*')
        .order('uploaded_at', { ascending: false })
      
      // Filter reports on client-side to match doctor
      let filteredReports = reportsData || []
      if (reportsData) {
        filteredReports = reportsData.filter((report: any) => 
          report.doctor_id === user.id || 
          (doctorShortId && report.doctor_id === doctorShortId)
        )
      }
      
      if (error) {
        const errorDetails = {
          message: error?.message || 'Unknown error',
          details: error?.details || null,
          hint: error?.hint || null,
          code: error?.code || null,
          timestamp: new Date().toISOString(),
          context: 'loading_doctor_reports'
        }
        console.error('Error loading reports:', errorDetails)
        console.error('Full error object:', JSON.stringify(error, null, 2))
        setReports([])
        setLoading(false)
        return
      }
      
      console.log('Reports from database:', reportsData?.length || 0)
      console.log('Filtered reports for doctor:', filteredReports.length)
      
      // Load assigned patients first so we can map their names
      let patientMap = new Map()
      try {
        const { data: patientsData } = await supabase.rpc('get_doctor_patients_bulletproof', { doctor_uuid: user.id })
        if (patientsData) {
          console.log('Assigned patients:', patientsData.length)
          setAssignedPatients(patientsData)
          // Add assigned patients to map
          patientsData.forEach((p: any) => patientMap.set(p.patient_id, p.patient_name))
        }
      } catch (patientsError) {
        console.warn('Could not load assigned patients:', patientsError)
        setAssignedPatients([])
      }

      // Also fetch names from profile_directory to catch patients who uploaded reports but aren't assigned
      const patientIds = Array.from(new Set(filteredReports.map((r: any) => r.patient_id).filter(Boolean)))
      if (patientIds.length > 0) {
        try {
          const { data: directoryProfiles } = await supabase
            .from('profile_directory')
            .select('id, name')
            .in('id', patientIds as string[])
            
          if (directoryProfiles) {
            directoryProfiles.forEach((p: any) => {
              if (p.name) patientMap.set(p.id, p.name)
            })
          }
        } catch (dirErr) {
          console.warn('Could not load profile directory:', dirErr)
        }
      }

      // Fetch ML suggestions separately to avoid join issues
      const { data: mlSuggestions } = await supabase
        .from('ml_suggestions')
        .select('*')
      
      // Transform data to include ML suggestions and patient names
      const transformedReports = filteredReports.map((report: any) => {
        const mlSuggestion = mlSuggestions?.find((ml: any) => ml.report_id === report.id) || null
        if (mlSuggestion) {
          console.log(`Report ${report.id}: ML suggestion exists`)
        }
        return {
          ...report,
          user_name: report.user_name || report.patient_name || patientMap.get(report.patient_id) || 'Unknown Patient',
          ml_suggestion: mlSuggestion
        }
      })
      
      console.log('Setting reports from database:', transformedReports.length)
      setReports(transformedReports)
      
      setLoading(false)
    }
    
    checkUser()
  }, [router])



  const filteredReports = reports.filter(report =>
    report.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    report.test_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    report.patient_id?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800'
      case 'urgent': return 'bg-orange-100 text-orange-800'
      default: return 'bg-green-100 text-green-800'
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800'
      case 'severe': return 'bg-orange-100 text-orange-800'
      case 'moderate': return 'bg-yellow-100 text-yellow-800'
      case 'mild': return 'bg-blue-100 text-blue-800'
      default: return 'bg-green-100 text-green-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending_review': return <Clock className="h-4 w-4 text-yellow-600" />
      case 'reviewed': return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'accepted': return <CheckCircle className="h-4 w-4 text-blue-600" />
      case 'rejected': return <AlertTriangle className="h-4 w-4 text-red-600" />
      default: return <Clock className="h-4 w-4 text-gray-600" />
    }
  }

  const handleViewReport = (report: Report) => {
    setSelectedReport(report)
    setShowReportModal(true)
  }

  const handleViewReportDetails = (reportId: string) => {
    router.push(`/doctor-dashboard/reports/${reportId}`)
  }

  const handleUpdateMLStatus = async (suggestionId: string, status: string, notes?: string) => {
    if (!suggestionId) {
      console.error('No suggestion ID provided')
      return
    }

    // Check if this is demo data
    if (suggestionId.startsWith('demo-ml-')) {
      // Update demo data locally
      setReports(prev => prev.map(report => {
        if (report.ml_suggestion?.id === suggestionId) {
          return {
            ...report,
            ml_suggestion: {
              ...report.ml_suggestion,
              status,
              reviewed_at: new Date().toISOString(),
              doctor_notes: notes
            }
          }
        }
        return report
      }))
      
      // Show success message
      const statusMessages = {
        'accepted': 'Analysis accepted successfully',
        'reviewed': 'Analysis marked as reviewed',
        'rejected': 'Analysis rejected'
      }
      
      toast({
        title: "Status updated",
        description: statusMessages[status as keyof typeof statusMessages] || 'Status updated successfully',
      })
      return
    }

    const supabase = createClient()
    
    try {
      console.log('Updating ML suggestion:', suggestionId, 'to status:', status)
      
      const { error } = await supabase
        .from('ml_suggestions')
        .update({
          status,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          doctor_notes: notes
        })
        .eq('id', suggestionId)

      if (error) {
        const errorDetails = {
          message: error?.message || 'Unknown error',
          details: error?.details || null,
          hint: error?.hint || null,
          code: error?.code || null,
          timestamp: new Date().toISOString(),
          context: 'updating_ml_suggestion',
          suggestionId
        }
        console.error('Error updating ML suggestion:', errorDetails)
        toast({
          title: "Update failed",
          description: "Failed to update status. Please try again.",
          variant: "destructive",
        })
        return
      }

      console.log('Successfully updated ML suggestion status')
      // Optimistically update local state for immediate UI feedback
      setReports(prev => prev.map(r => {
        if (r.ml_suggestion?.id === suggestionId) {
          return {
            ...r,
            ml_suggestion: {
              ...r.ml_suggestion,
              status,
              reviewed_at: new Date().toISOString(),
              doctor_notes: notes
            }
          }
        }
        return r
      }))

      // Background refresh to stay in sync with DB (scoped to this doctor)
      try {
        const { data: reportsData } = await supabase
          .from('reports')
          .select(`
            *,
            ml_suggestions (
              id,
              findings,
              confidence,
              recommendations,
              severity,
              status,
              processed_at
            )
          `)
          .eq('doctor_id', user.id)
          .order('uploaded_at', { ascending: false })
        if (reportsData) {
          const transformedReports = (reportsData || []).map((report: any) => ({
            ...report,
            ml_suggestion: report.ml_suggestions?.[0] || null
          }))
          setReports(transformedReports)
        }
      } catch (refreshError) {
        console.warn('Background refresh failed:', refreshError)
      }

      // Success notice
      const statusMessages = {
        'accepted': 'Analysis accepted successfully',
        'reviewed': 'Analysis marked as reviewed',
        'rejected': 'Analysis rejected'
      }
      toast({
        title: "Status updated",
        description: statusMessages[status as keyof typeof statusMessages] || 'Status updated successfully',
      })
    } catch (error) {
      const errorInfo = {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : null,
        timestamp: new Date().toISOString(),
        context: 'handleUpdateMLStatus',
        suggestionId,
        status
      }
      console.error('Error in handleUpdateMLStatus:', errorInfo)
      toast({
        title: "Update error",
        description: "An error occurred while updating the status. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleContactPatient = (patientId: string) => {
    if (!patientId) {
      console.error('No patient ID provided')
      return
    }
    
    setShowReportModal(false)
    // Navigate to communication page with patient pre-selected
    router.push(`/doctor-dashboard/communication?patient=${patientId}`)
  }

  const handleDownloadReport = async (report: Report) => {
    // Check if this is demo data
    if (report.id.startsWith('demo-report-')) {
      toast({
        title: "Demo data",
        description: "This is demo data. In a real application, the file would be downloaded from storage.",
      })
      return
    }

    try {
      const supabase = createClient()
      const { data, error } = await supabase.storage
        .from('reports')
        .download(report.file_name)

      if (error) {
        throw error
      }

      // Create download link
      const url = window.URL.createObjectURL(data)
      const link = document.createElement('a')
      link.href = url
      link.download = report.original_name
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (err: any) {
      const errorInfo = {
        message: err?.message || 'Unknown error',
        stack: err?.stack || null,
        timestamp: new Date().toISOString(),
        context: 'downloading_doctor_report',
        reportId: report.id
      }
      console.error('Error downloading report:', errorInfo)
      toast({
        title: "Download failed",
        description: "Failed to download report. The file may not exist or you may not have permission.",
        variant: "destructive",
      })
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-transparent">
        <div className="flex flex-col items-center">
          <Activity className="h-8 w-8 animate-spin mb-4" />
          <span className="text-xs font-mono uppercase tracking-widest text-black/60">Loading Records...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-transparent p-12 max-w-7xl mx-auto">
      {/* Header */}
      <header className="border-b border-black/10 pb-8 mb-12 flex items-end justify-between">
        <div>
          <Link href="/doctor-dashboard" className="inline-flex items-center space-x-2 text-xs font-mono uppercase tracking-widest text-black/55 hover:text-black mb-4 transition-colors">
            <ArrowLeft className="h-3 w-3" />
            <span>Back to Dashboard</span>
          </Link>
          <h1 className="text-4xl font-bold tracking-tight uppercase mb-2">Patient Records</h1>
          <p className="text-black/60 font-light text-lg">
            Manage your patient roster and review lab results with AI-powered analysis
          </p>
        </div>
        <div className="text-right hidden md:block">
          <span className="text-[10px] font-mono uppercase tracking-widest text-black/55 block mb-1">
            Portal Status
          </span>
          <span className="text-xl font-mono border-b border-black inline-flex items-center gap-2">
            <span className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></span>
            ACTIVE
          </span>
        </div>
      </header>

      {/* Assigned Patients Summary */}
      {assignedPatients.length > 0 && (
        <div className="mb-12 border border-black/10 p-6 bg-white">
          <h2 className="text-xl font-bold uppercase mb-6 flex items-center gap-2">
            <span className="h-2 w-2 bg-black rounded-full"></span>
            Assigned Patients ({assignedPatients.length})
          </h2>
          <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-4">
            {assignedPatients.slice(0, 8).map((patient, index) => (
              <div key={index} className="flex items-center space-x-3 p-3 border border-black/5 hover:border-black/20 hover:bg-black/[0.02] transition-colors">
                <div className="w-10 h-10 bg-black text-white flex items-center justify-center font-bold font-mono">
                  {patient.patient_name?.charAt(0) || 'P'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold uppercase truncate">
                    {patient.patient_name || 'Unknown Patient'}
                  </p>
                  <p className="text-[10px] font-mono text-black/55 uppercase">
                    ID: {patient.patient_short_id || 'N/A'}
                  </p>
                </div>
                <span className="text-[10px] font-mono bg-black/5 px-2 py-1">
                  {patient.total_reports || 0} REPs
                </span>
              </div>
            ))}
          </div>
          {assignedPatients.length > 8 && (
            <p className="text-[10px] font-mono text-black/55 uppercase mt-4">
              + {assignedPatients.length - 8} additional patients
            </p>
          )}
        </div>
      )}

      {/* Search and Stats */}
      <div className="grid md:grid-cols-4 gap-6 mb-12">
        <div className="md:col-span-3">
          <div className="relative h-full flex items-center">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-black/55 h-5 w-5" />
            <Input
              placeholder="SEARCH PATIENTS AND REPORTS..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-14 pl-12 pr-4 bg-white border border-black/10 focus:border-black focus:outline-none font-mono text-sm placeholder:text-black/55 transition-colors uppercase rounded-none"
            />
          </div>
        </div>
        <div className="md:col-span-1">
          <div className="bg-white border border-black/10 p-4 h-14 flex items-center justify-between">
             <span className="text-xs font-mono uppercase text-black/60">Total Records</span>
             <span className="text-2xl font-bold">{reports.length}</span>
          </div>
        </div>
      </div>

      {/* AI Analysis Summary */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-px bg-black/10 border border-black/10 mb-12">
        <div className="bg-white p-6">
          <div className="flex items-center space-x-3 mb-2">
            <Brain className="h-5 w-5 text-black" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-black/60">AI Analyzed</span>
          </div>
          <div className="text-3xl font-bold">
            {reports.filter(r => r.ml_suggestion).length}
          </div>
        </div>
        
        <div className="bg-white p-6">
          <div className="flex items-center space-x-3 mb-2">
            <CheckCircle className="h-5 w-5 text-black" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-black/60">Accepted</span>
          </div>
          <div className="text-3xl font-bold">
            {reports.filter(r => r.ml_suggestion?.status === 'accepted').length}
          </div>
        </div>
        
        <div className="bg-white p-6">
          <div className="flex items-center space-x-3 mb-2">
            <Clock className="h-5 w-5 text-black" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-black/60">Pending</span>
          </div>
          <div className="text-3xl font-bold">
            {reports.filter(r => r.ml_suggestion?.status === 'pending_review').length}
          </div>
        </div>
        
        <div className="bg-white p-6 border-b-4 border-red-500">
          <div className="flex items-center space-x-3 mb-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-red-600">High Priority</span>
          </div>
          <div className="text-3xl font-bold text-red-600">
            {reports.filter(r => r.ml_suggestion?.severity === 'critical' || r.ml_suggestion?.severity === 'severe').length}
          </div>
        </div>
      </div>

      {/* Reports List */}
      <div className="space-y-6">
        {/* Debug Info */}
        <div className="p-4 border border-black/5 bg-black/[0.02] text-xs font-mono text-black/55">
          <strong className="uppercase">Debug:</strong> Loaded {reports.length} reports. 
          {reports.length > 0 && ` Initial ID: ${reports[0].id}`}
        </div>
        
        {filteredReports.map((report) => (
          <div key={report.id} className="border border-black/10 bg-white hover:border-black/30 transition-colors">
            <div className="p-6 border-b border-black/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-black text-white flex items-center justify-center">
                  <FileText className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold uppercase tracking-tight">{report.test_type?.replace('_', ' ')}</h3>
                  <p className="text-sm font-mono text-black/60 uppercase">
                    PT: {report.user_name || report.patient_id} <span className="mx-2">|</span> UPL: {new Date(report.uploaded_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {(report.priority === 'urgent' || report.priority === 'critical') && (
                  <span className={`px-2 py-0.5 text-xs font-mono uppercase font-bold border tracking-tighter ${
                    report.priority === 'urgent' || report.priority === 'critical' ? 'border-red-600 text-red-600 bg-red-50' : 
                    'border-black/10 text-black/55 bg-black/[0.02]'
                  }`}>
                    {report.priority}
                  </span>
                )}
                {report.ml_suggestion && (
                  <span className="px-3 py-1 text-xs font-mono uppercase font-bold border border-black bg-black text-white flex items-center space-x-2">
                    <Brain className="h-3.5 w-3.5" />
                    <span>AI Scanned</span>
                  </span>
                )}
              </div>
            </div>
            
            <div className="p-6">
              <div className="grid md:grid-cols-3 gap-px bg-black/5 border border-black/5 mb-6">
                <div className="p-4 bg-white">
                  <p className="text-[11px] font-mono uppercase tracking-widest text-black/55 mb-1">Patient ID</p>
                  <p className="font-mono text-sm truncate">{report.patient_id}</p>
                </div>
                <div className="p-4 bg-white">
                  <p className="text-[11px] font-mono uppercase tracking-widest text-black/55 mb-1">File Source</p>
                  <p className="font-mono text-sm truncate">{report.original_name}</p>
                </div>
                <div className="p-4 bg-white">
                  <p className="text-[11px] font-mono uppercase tracking-widest text-black/55 mb-1">Review Status</p>
                  <p className="font-bold text-sm uppercase">
                    {report.ml_suggestion ? 'AI Complete' : 'Pending'}
                  </p>
                </div>
              </div>
              
              {/* ML Suggestion Preview */}
              {report.ml_suggestion && (
                <div className="p-6 border border-black/10 bg-black/[0.02] mb-6">
                  <div className="flex items-center justify-between mb-4 pb-4 border-b border-black/10">
                    <div className="flex items-center space-x-3">
                      <Brain className="h-5 w-5" />
                      <span className="font-bold uppercase tracking-widest text-sm">AI Analysis Overview</span>
                    </div>
                    <span className={`px-2 py-0.5 text-xs font-mono font-bold uppercase border tracking-tighter ${
                      report.ml_suggestion.severity === 'critical' || report.ml_suggestion.severity === 'severe' ? 'border-red-600 text-red-600 bg-red-50' : 
                      'border-black/20 text-black/60 bg-black/[0.02]'
                    }`}>
                      {report.ml_suggestion.severity}
                    </span>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="p-4 bg-white border border-black/5">
                      <p className="text-[11px] font-mono uppercase text-black/55 mb-2">Findings Summary</p>
                      <p className="text-sm leading-relaxed">
                        {report.ml_suggestion.findings}
                      </p>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex items-center space-x-3 w-full sm:w-1/2">
                        <span className="text-[11px] font-mono uppercase text-black/55 w-24">Confidence</span>
                        <div className="flex-1 border border-black/10 h-2 bg-white">
                          <div 
                            className="bg-black h-full" 
                            style={{ width: `${(report.ml_suggestion.confidence * 100)}%` }}
                          ></div>
                        </div>
                        <span className="text-xs font-mono font-bold w-12 text-right">
                          {(report.ml_suggestion.confidence * 100).toFixed(1)}%
                        </span>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <span className="text-[11px] font-mono uppercase text-black/55">Status:</span>
                        <span className="text-xs font-mono font-bold uppercase px-2 py-0.5 bg-black/[0.02] border border-black/10 tracking-tighter">
                          {report.ml_suggestion.status.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {report.notes && (
                <div className="p-4 border border-black/10 mb-6 bg-white">
                  <p className="text-[10px] font-mono uppercase text-black/55 mb-1">Physician Notes</p>
                  <p className="text-sm font-mono">{report.notes}</p>
                </div>
              )}
              
              <div className="flex flex-wrap gap-4 mt-6 border-t border-black/10 pt-6">
                <Button
                  onClick={() => {
                    handleViewReportDetails(report.id)
                  }}
                  className="bg-black hover:bg-black/80 text-white border border-black rounded-none font-mono uppercase text-xs h-10 px-6 flex items-center"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Full Details
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleDownloadReport(report)}
                  className="bg-transparent border-black/20 text-black hover:border-black hover:bg-transparent rounded-none font-mono uppercase text-xs h-10 px-6 flex items-center"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                {report.ml_suggestion?.status === 'pending_review' && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => handleUpdateMLStatus(report.ml_suggestion.id, 'accepted')}
                      className="border-green-600 text-green-700 hover:bg-green-50 rounded-none font-mono uppercase text-xs h-10 px-6 flex items-center"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Approve AI
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleUpdateMLStatus(report.ml_suggestion.id, 'rejected')}
                      className="border-red-600 text-red-700 hover:bg-red-50 rounded-none font-mono uppercase text-xs h-10 px-6 flex items-center"
                    >
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      Reject AI
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}

        {filteredReports.length === 0 && (
          <div className="text-center py-20 border border-black/10 bg-white">
            <FileText className="h-12 w-12 text-black/20 mx-auto mb-4" />
            <h3 className="text-xl font-bold uppercase mb-2">No Reports Found</h3>
            <p className="text-black/60 font-light mb-8">Try adjusting your search criteria.</p>
            
            <div className="max-w-md mx-auto p-6 border border-black/10 text-left bg-black/[0.02]">
              <h4 className="font-bold text-sm uppercase mb-4 border-b border-black/10 pb-2">Record Requirements</h4>
              <ul className="text-xs font-mono text-black/60 space-y-2 list-none">
                <li className="flex items-start"><span className="mr-2">-</span> Lab uploads with your Doctor ID</li>
                <li className="flex items-start"><span className="mr-2">-</span> Assigned patient matching</li>
                <li className="flex items-start"><span className="mr-2">-</span> Processed ML analysis ready</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Report Detail Modal */}
      <Dialog open={showReportModal} onOpenChange={setShowReportModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto border border-black/10 rounded-none bg-white p-0 shadow-2xl">
          <div className="p-6 border-b border-black/10 bg-black/[0.02] sticky top-0 z-10 flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl font-bold uppercase flex items-center gap-2">
                <FileText className="h-6 w-6" />
                Report Details
              </DialogTitle>
              <DialogDescription className="text-xs font-mono mt-1 text-black/60 uppercase">
                ID: {selectedReport?.id}
              </DialogDescription>
            </div>
          </div>
          
          {selectedReport && (
            <div className="p-8 space-y-12">
              {/* Report Information */}
              <div>
                <h3 className="text-lg font-bold uppercase mb-4 pb-2 border-b border-black/10">Metadata</h3>
                <div className="grid md:grid-cols-2 gap-px bg-black/10 border border-black/10">
                  <div className="p-4 bg-white">
                    <p className="text-[10px] font-mono uppercase text-black/55 mb-1">Patient ID</p>
                    <p className="text-sm font-mono">{selectedReport.patient_id}</p>
                  </div>
                  <div className="p-4 bg-white">
                    <p className="text-[10px] font-mono uppercase text-black/55 mb-1">Test Type</p>
                    <p className="text-sm font-bold uppercase">{selectedReport.test_type?.replace('_', ' ')}</p>
                  </div>
                  <div className="p-4 bg-white">
                    <p className="text-[10px] font-mono uppercase text-black/55 mb-1">Source File</p>
                    <p className="text-sm font-mono truncate">{selectedReport.original_name}</p>
                  </div>
                  <div className="p-4 bg-white">
                    <p className="text-[10px] font-mono uppercase text-black/55 mb-1">Upload Date</p>
                    <p className="text-sm font-mono">{new Date(selectedReport.uploaded_at).toLocaleString()}</p>
                  </div>
                  <div className="p-4 bg-white">
                    <p className="text-[10px] font-mono uppercase text-black/55 mb-1">Priority</p>
                    <span className={`px-2 py-0.5 text-[10px] font-mono uppercase font-bold border ${selectedReport.priority === 'urgent' || selectedReport.priority === 'critical' ? 'border-red-500 text-red-600 bg-red-50' : 'border-black text-black'}`}>
                      {selectedReport.priority}
                    </span>
                  </div>
                  {selectedReport.notes && (
                    <div className="p-4 bg-white md:col-span-2">
                      <p className="text-[10px] font-mono uppercase text-black/55 mb-1">Notes</p>
                      <p className="text-sm font-mono">{selectedReport.notes}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* AI Analysis */}
              {selectedReport.ml_suggestion && (
                <div>
                  <h3 className="text-lg font-bold uppercase mb-4 pb-2 border-b border-black/10 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Brain className="h-5 w-5" />
                      <span>Machine Analysis</span>
                    </div>
                    <span className={`px-2 py-1 text-[10px] font-mono border ${selectedReport.ml_suggestion.severity === 'critical' ? 'bg-red-600 text-white border-red-600' : 'border-black'}`}>
                      {selectedReport.ml_suggestion.severity}
                    </span>
                  </h3>
                  
                  <div className="space-y-6">
                    <div className="p-6 bg-black/[0.02] border border-black/10">
                      <div className="flex items-center space-x-2 mb-4 pb-2 border-b border-black/5">
                        <span className="text-sm font-bold uppercase tracking-widest">Findings</span>
                      </div>
                      <p className="text-sm leading-relaxed font-medium">
                        {selectedReport.ml_suggestion.findings}
                      </p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="p-6 border border-black/10">
                        <p className="text-[10px] font-mono uppercase text-black/55 mb-4">Confidence Metric</p>
                        <div className="flex items-center space-x-4">
                          <div className="flex-1 bg-black/5 h-2">
                            <div 
                              className="bg-black h-2 transition-all duration-300" 
                              style={{ width: `${(selectedReport.ml_suggestion.confidence * 100)}%` }}
                            ></div>
                          </div>
                          <span className="text-lg font-bold font-mono">
                            {(selectedReport.ml_suggestion.confidence * 100).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      
                      <div className="p-6 border border-black/10">
                        <p className="text-[10px] font-mono uppercase text-black/55 mb-2">Severity Impact</p>
                        <p className="text-sm font-bold uppercase mt-2">
                          {selectedReport.ml_suggestion.severity === 'critical' ? 'Immediate Action' :
                           selectedReport.ml_suggestion.severity === 'severe' ? 'Urgent Review' :
                           selectedReport.ml_suggestion.severity === 'moderate' ? 'Follow-up Reqd' :
                           selectedReport.ml_suggestion.severity === 'mild' ? 'Monitor' : 'Normal'}
                        </p>
                      </div>
                    </div>

                    <div className="p-6 border border-black/10">
                      <p className="text-[10px] font-mono uppercase text-black/55 mb-4 pb-2 border-b border-black/5">Recommendations</p>
                      <p className="text-sm leading-relaxed font-mono">
                        {selectedReport.ml_suggestion.recommendations}
                      </p>
                    </div>
                    
                    <div className="flex items-center space-x-4 pt-4 border-t border-black/10">
                      <span className="text-[10px] font-mono uppercase text-black/55">Status:</span>
                      <span className="text-sm font-bold uppercase px-3 py-1 border border-black flex items-center gap-2">
                        {selectedReport.ml_suggestion.status.replace('_', ' ')}
                      </span>
                    </div>

                    {/* Review Actions */}
                    <div className="flex flex-wrap gap-4 pt-6">
                      <Button 
                        className="bg-black hover:bg-black/80 text-white rounded-none font-mono uppercase text-xs h-12 px-6"
                        onClick={() => handleUpdateMLStatus(selectedReport.ml_suggestion.id, 'accepted')}
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Accept
                      </Button>
                      <Button 
                        variant="outline"
                        className="border-black rounded-none font-mono uppercase text-xs h-12 px-6"
                        onClick={() => handleUpdateMLStatus(selectedReport.ml_suggestion.id, 'reviewed')}
                      >
                        <Clock className="h-4 w-4 mr-2" />
                        Mark Reviewed
                      </Button>
                      <Button 
                        variant="outline"
                        className="border-red-600 text-red-600 hover:bg-red-50 rounded-none font-mono uppercase text-xs h-12 px-6"
                        onClick={() => handleUpdateMLStatus(selectedReport.ml_suggestion.id, 'rejected')}
                      >
                        <AlertTriangle className="h-4 w-4 mr-2" />
                        Reject
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Report Image/File Preview */}
              <div>
                 <h3 className="text-lg font-bold uppercase mb-4 pb-2 border-b border-black/10">Source Material</h3>
                 <div className="border border-black/10 bg-black/[0.02] p-2">
                   <FilePreview 
                     fileName={selectedReport.file_name}
                     originalName={selectedReport.original_name}
                     patientId={selectedReport.patient_id}
                   />
                 </div>
              </div>
              
              <div className="flex justify-end pt-6 border-t border-black/10">
                <Button
                  variant="outline"
                  onClick={() => setShowReportModal(false)}
                  className="rounded-none font-mono uppercase text-xs border-black/20 hover:border-black h-12 px-8"
                >
                  Close
                </Button>
              </div>

            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
} 
