"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Activity, FileText, Search, ArrowLeft, Eye, Download, MessageSquare, Brain, AlertTriangle, CheckCircle, Clock } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import FilePreview from "@/components/file-preview"

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
  const [searchTerm, setSearchTerm] = useState("")
  const [loading, setLoading] = useState(true)
  const [selectedReport, setSelectedReport] = useState<Report | null>(null)
  const [showReportModal, setShowReportModal] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const checkUser = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user || user.user_metadata?.role !== "doctor") {
        router.push("/login")
        return
      }
      
      setUser(user)
      
      // Fetch reports with ML suggestions
      const { data: reportsData, error } = await supabase
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
        .order('uploaded_at', { ascending: false })
      
      if (error) {
        console.error('Error loading reports:', error)
        // Load demo data as fallback
        loadDemoReports()
        setLoading(false)
        return
      }
      
      // Transform data to include ML suggestions
      const transformedReports = (reportsData || []).map((report: any) => ({
        ...report,
        ml_suggestion: report.ml_suggestions?.[0] || null
      }))
      
      if (transformedReports.length === 0) {
        // Load demo data if no reports found
        loadDemoReports()
      } else {
        setReports(transformedReports)
      }
      
      setLoading(false)
    }
    
    checkUser()
  }, [router])

  const loadDemoReports = () => {
    const demoReports: Report[] = [
      {
        id: 'demo-report-1',
        patient_id: '38',
        test_type: 'chest_xray',
        original_name: 'chest_xray_patient_38.jpg',
        file_name: 'demo-chest-xray-1.jpg',
        uploaded_at: new Date().toISOString(),
        priority: 'urgent',
        user_name: 'John Doe',
        ml_suggestion: {
          id: 'demo-ml-1',
          findings: 'AI analysis detected potential abnormalities in the right lung field. There appears to be a small opacity that may require further investigation.',
          confidence: 0.87,
          recommendations: 'Recommend follow-up CT scan to rule out any underlying pathology. Consider consultation with a radiologist for detailed review.',
          severity: 'moderate',
          status: 'pending_review',
          processed_at: new Date().toISOString()
        }
      },
      {
        id: 'demo-report-2',
        patient_id: '42',
        test_type: 'blood_work',
        original_name: 'blood_work_patient_42.pdf',
        file_name: 'demo-blood-work-1.pdf',
        uploaded_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        priority: 'normal',
        user_name: 'Sarah Smith',
        ml_suggestion: {
          id: 'demo-ml-2',
          findings: 'Blood work analysis shows normal ranges for all tested parameters. No significant abnormalities detected.',
          confidence: 0.95,
          recommendations: 'Continue with current treatment plan. No immediate action required.',
          severity: 'mild',
          status: 'accepted',
          processed_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        }
      },
      {
        id: 'demo-report-3',
        patient_id: '45',
        test_type: 'mri_brain',
        original_name: 'mri_brain_patient_45.dcm',
        file_name: 'demo-mri-brain-1.dcm',
        uploaded_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        priority: 'critical',
        user_name: 'Mike Johnson',
        ml_suggestion: {
          id: 'demo-ml-3',
          findings: 'Critical findings detected: Possible mass lesion in the left temporal lobe. Immediate attention required.',
          confidence: 0.92,
          recommendations: 'URGENT: Immediate consultation with neurosurgeon recommended. Consider emergency imaging follow-up.',
          severity: 'critical',
          status: 'pending_review',
          processed_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
        }
      }
    ]
    setReports(demoReports)
  }

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
      
      alert(statusMessages[status as keyof typeof statusMessages] || 'Status updated successfully')
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
        console.error('Error updating ML suggestion:', error)
        alert('Failed to update status. Please try again.')
        return
      }

      console.log('Successfully updated ML suggestion status')

      // Refresh reports
      const { data: reportsData, error: refreshError } = await supabase
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
        .order('uploaded_at', { ascending: false })

      if (refreshError) {
        console.error('Error refreshing reports:', refreshError)
      } else {
        const transformedReports = (reportsData || []).map((report: any) => ({
          ...report,
          ml_suggestion: report.ml_suggestions?.[0] || null
        }))
        
        setReports(transformedReports)
        
        // Show success message
        const statusMessages = {
          'accepted': 'Analysis accepted successfully',
          'reviewed': 'Analysis marked as reviewed',
          'rejected': 'Analysis rejected'
        }
        
        alert(statusMessages[status as keyof typeof statusMessages] || 'Status updated successfully')
      }
    } catch (error) {
      console.error('Error in handleUpdateMLStatus:', error)
      alert('An error occurred while updating the status. Please try again.')
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
      alert('This is demo data. In a real application, the file would be downloaded from storage.')
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
      console.error('Error downloading report:', err)
      alert('Failed to download report. The file may not exist or you may not have permission to access it.')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center">
        <div className="text-center">
          <Activity className="h-8 w-8 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading patient management...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/doctor-dashboard" className="flex items-center space-x-2 text-blue-600 hover:text-blue-700">
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Dashboard</span>
            </Link>
          </div>
          <div className="flex items-center space-x-2">
            <Image src="/medi.png" alt="MedSync Logo" width={32} height={32} />
            <span className="text-2xl font-bold text-gray-900">MedSync</span>
            <Badge className="bg-blue-100 text-blue-800">Doctor Portal</Badge>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Patient Management & Report Review</h1>
          <p className="text-gray-600">Manage your patient roster and review lab results with AI-powered analysis</p>
        </div>

        {/* Search and Stats */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <div className="md:col-span-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search patients and reports by name, test type, or patient ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <div className="md:col-span-1">
            <Card className="border-blue-100">
              <CardContent className="p-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{reports.length}</div>
                  <p className="text-sm text-gray-600">Total Patients & Reports</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* AI Analysis Summary */}
        <div className="grid md:grid-cols-4 gap-4 mb-6">
          <Card className="border-purple-100">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Brain className="h-5 w-5 text-purple-600" />
                <div>
                  <div className="text-lg font-bold text-purple-600">
                    {reports.filter(r => r.ml_suggestion).length}
                  </div>
                  <p className="text-xs text-gray-600">AI Analyzed</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-green-100">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div>
                  <div className="text-lg font-bold text-green-600">
                    {reports.filter(r => r.ml_suggestion?.status === 'accepted').length}
                  </div>
                  <p className="text-xs text-gray-600">Accepted</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-yellow-100">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Clock className="h-5 w-5 text-yellow-600" />
                <div>
                  <div className="text-lg font-bold text-yellow-600">
                    {reports.filter(r => r.ml_suggestion?.status === 'pending_review').length}
                  </div>
                  <p className="text-xs text-gray-600">Pending Review</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-red-100">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <div>
                  <div className="text-lg font-bold text-red-600">
                    {reports.filter(r => r.ml_suggestion?.severity === 'critical' || r.ml_suggestion?.severity === 'severe').length}
                  </div>
                  <p className="text-xs text-gray-600">High Priority</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Reports List */}
        <div className="grid gap-6">
          {filteredReports.map((report) => (
            <Card key={report.id} className="border-blue-100 hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <FileText className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{report.test_type?.replace('_', ' ').toUpperCase()}</CardTitle>
                      <CardDescription>
                        Patient: {report.user_name || report.patient_id} • Uploaded: {new Date(report.uploaded_at).toLocaleDateString()}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge className={getPriorityColor(report.priority)}>
                      {report.priority}
                    </Badge>
                    {report.ml_suggestion && (
                      <Badge className="bg-purple-100 text-purple-800 flex items-center space-x-1">
                        <Brain className="h-3 w-3" />
                        <span>AI Analyzed</span>
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-4 mb-4">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm font-medium text-gray-900">Patient ID</p>
                    <p className="text-sm text-gray-600">{report.patient_id}</p>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm font-medium text-blue-900">File Name</p>
                    <p className="text-sm text-blue-600">{report.original_name}</p>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg">
                    <p className="text-sm font-medium text-green-900">Status</p>
                    <p className="text-sm text-green-600">
                      {report.ml_suggestion ? 'AI Analysis Complete' : 'Ready for review'}
                    </p>
                  </div>
                </div>
                
                {/* ML Suggestion Preview */}
                {report.ml_suggestion && (
                  <div className="p-3 bg-purple-50 rounded-lg mb-4 border border-purple-200">
                    <div className="flex items-center space-x-2 mb-2">
                      <Brain className="h-4 w-4 text-purple-600" />
                      <p className="text-sm font-medium text-purple-900">AI Analysis Preview</p>
                      <Badge className={getSeverityColor(report.ml_suggestion.severity)}>
                        {report.ml_suggestion.severity}
                      </Badge>
                    </div>
                    
                    {/* Enhanced Findings Display */}
                    <div className="space-y-2">
                      <div className="p-2 bg-white rounded border">
                        <p className="text-sm font-semibold text-purple-900 mb-1">🔍 AI Findings:</p>
                        <p className="text-sm text-purple-800 leading-relaxed">
                          {report.ml_suggestion.findings}
                        </p>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium text-purple-900">Confidence:</span>
                          <div className="flex items-center space-x-1">
                            <div className="w-16 bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-purple-600 h-2 rounded-full" 
                                style={{ width: `${(report.ml_suggestion.confidence * 100)}%` }}
                              ></div>
                            </div>
                            <span className="text-sm text-purple-700 font-medium">
                              {(report.ml_suggestion.confidence * 100).toFixed(1)}%
                            </span>
                          </div>
                        </div>
                        
                        {/* Quick Status Indicator */}
                        <div className="flex items-center space-x-1">
                          {getStatusIcon(report.ml_suggestion.status)}
                          <span className="text-xs text-gray-600 capitalize">
                            {report.ml_suggestion.status.replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {report.notes && (
                  <div className="p-3 bg-yellow-50 rounded-lg mb-4">
                    <p className="text-sm font-medium text-yellow-900">Notes</p>
                    <p className="text-sm text-yellow-800">{report.notes}</p>
                  </div>
                )}
                
                <div className="flex space-x-2">
                  <Button 
                    size="sm" 
                    className="bg-blue-600 hover:bg-blue-700"
                    onClick={() => handleViewReport(report)}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    View Report
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleDownloadReport(report)}>
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredReports.length === 0 && (
          <Card className="text-center py-12">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Reports Found</h3>
            <p className="text-gray-600">Try adjusting your search criteria or check back later for new reports.</p>
          </Card>
        )}
      </div>

      {/* Report Detail Modal */}
      <Dialog open={showReportModal} onOpenChange={setShowReportModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <FileText className="h-5 w-5 text-blue-600" />
              <span>Report Details</span>
            </DialogTitle>
            <DialogDescription>
              Review the uploaded report and AI analysis
            </DialogDescription>
          </DialogHeader>
          
          {selectedReport && (
            <div className="space-y-6">
              {/* Report Information */}
              <Card>
                <CardHeader>
                  <CardTitle>Report Information</CardTitle>
                </CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Patient ID</p>
                    <p className="text-sm text-gray-600">{selectedReport.patient_id}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Test Type</p>
                    <p className="text-sm text-gray-600">{selectedReport.test_type?.replace('_', ' ').toUpperCase()}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">File Name</p>
                    <p className="text-sm text-gray-600">{selectedReport.original_name}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Upload Date</p>
                    <p className="text-sm text-gray-600">{new Date(selectedReport.uploaded_at).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Priority</p>
                    <Badge className={getPriorityColor(selectedReport.priority)}>
                      {selectedReport.priority}
                    </Badge>
                  </div>
                  {selectedReport.notes && (
                    <div className="md:col-span-2">
                      <p className="text-sm font-medium text-gray-900">Notes</p>
                      <p className="text-sm text-gray-600">{selectedReport.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* AI Analysis */}
              {selectedReport.ml_suggestion && (
                <Card className="border-purple-200">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Brain className="h-5 w-5 text-purple-600" />
                      <span>AI Analysis Results</span>
                      <Badge className={getSeverityColor(selectedReport.ml_suggestion.severity)}>
                        {selectedReport.ml_suggestion.severity}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Primary Findings */}
                    <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                      <div className="flex items-center space-x-2 mb-3">
                        <span className="text-lg">🔍</span>
                        <h4 className="font-semibold text-purple-900">AI Detection Results</h4>
                      </div>
                      <p className="text-purple-800 leading-relaxed font-medium">
                        {selectedReport.ml_suggestion.findings}
                      </p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium text-gray-900 mb-2">Confidence Level</p>
                        <div className="flex items-center space-x-3">
                          <div className="flex-1 bg-gray-200 rounded-full h-3">
                            <div 
                              className="bg-purple-600 h-3 rounded-full transition-all duration-300" 
                              style={{ width: `${(selectedReport.ml_suggestion.confidence * 100)}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-semibold text-purple-700 min-w-[60px]">
                            {(selectedReport.ml_suggestion.confidence * 100).toFixed(1)}%
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 mt-1">
                          {selectedReport.ml_suggestion.confidence > 0.8 ? 'High confidence' : 
                           selectedReport.ml_suggestion.confidence > 0.6 ? 'Medium confidence' : 
                           selectedReport.ml_suggestion.confidence > 0.4 ? 'Low confidence' : 'Very low confidence'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 mb-2">Severity Assessment</p>
                        <Badge className={`${getSeverityColor(selectedReport.ml_suggestion.severity)} text-sm px-3 py-1`}>
                          {selectedReport.ml_suggestion.severity.toUpperCase()}
                        </Badge>
                        <p className="text-xs text-gray-600 mt-1">
                          {selectedReport.ml_suggestion.severity === 'critical' ? 'Immediate attention required' :
                           selectedReport.ml_suggestion.severity === 'severe' ? 'Urgent medical review needed' :
                           selectedReport.ml_suggestion.severity === 'moderate' ? 'Follow-up recommended' :
                           selectedReport.ml_suggestion.severity === 'mild' ? 'Monitor and observe' : 'Normal findings'}
                        </p>
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-medium text-gray-900 mb-2">AI Recommendations</p>
                      <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <p className="text-blue-800 leading-relaxed">
                          {selectedReport.ml_suggestion.recommendations}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2 pt-4 border-t">
                      <span className="text-sm font-medium text-gray-900">Review Status:</span>
                      <div className="flex items-center space-x-1">
                        {getStatusIcon(selectedReport.ml_suggestion.status)}
                        <span className="text-sm text-gray-600 capitalize">
                          {selectedReport.ml_suggestion.status.replace('_', ' ')}
                        </span>
                      </div>
                    </div>

                    {/* Review Actions */}
                    <div className="flex space-x-2 pt-4">
                      <Button 
                        size="sm" 
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => handleUpdateMLStatus(selectedReport.ml_suggestion.id, 'accepted')}
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Accept Analysis
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleUpdateMLStatus(selectedReport.ml_suggestion.id, 'reviewed')}
                      >
                        <Clock className="h-4 w-4 mr-2" />
                        Mark Reviewed
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="text-red-600 border-red-200 hover:bg-red-50"
                        onClick={() => handleUpdateMLStatus(selectedReport.ml_suggestion.id, 'rejected')}
                      >
                        <AlertTriangle className="h-4 w-4 mr-2" />
                        Reject Analysis
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Report Image/File Preview */}
              <Card>
                <CardHeader>
                  <CardTitle>Report File</CardTitle>
                </CardHeader>
                <CardContent>
                  <FilePreview 
                    fileName={selectedReport.file_name}
                    originalName={selectedReport.original_name}
                    patientId={selectedReport.patient_id}
                  />
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
} 