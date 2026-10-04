import Image from 'next/image'
import { verifySession } from '@/lib/api-utils'
import { Report } from '@/lib/types'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import BBoxAnalysisViewer from '@/components/medical/bbox-analysis-viewer'
import { ArrowLeft, Download } from 'lucide-react'
import { PrintButton } from '@/components/ui/print-button'
import ClinicalNotice from "@/components/medical/common/ClinicalNotice"

async function getReport(id: string): Promise<{ report: Report | null, mlSuggestion: any }> {
  const { supabase, user } = await verifySession()
  if (!user) return { report: null, mlSuggestion: null }
  
  // Get the report
  const { data: report, error: reportError } = await supabase
    .from('reports')
    .select('*')
    .eq('id', id)
    .single()
    
  if (reportError) {
    console.error('Error fetching report:', reportError)
    return { report: null, mlSuggestion: null }
  }

  // Audit Log
  if (user?.id) {
    await supabase.from('audit_logs').insert({
      actor_id: user.id,
      patient_id: report.patient_id,
      action: 'view',
      resource_type: 'reports',
      resource_id: id,
      details: { viewer_role: 'doctor' }
    })
  }

  // Get the ML suggestion for this report
  const { data: mlSuggestion, error: mlError } = await supabase
    .from('ml_suggestions')
    .select('*')
    .eq('report_id', id)
    .order('processed_at', { ascending: false })
    .limit(1)
    .single()

  if (mlError && mlError.code !== 'PGRST116') { // PGRST116 is "not found"
    console.error('Error fetching ML suggestion:', mlError)
  }

  return { 
    report, 
    mlSuggestion: mlSuggestion || null 
  }
}

export default async function ReportDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { report, mlSuggestion } = await getReport(id)
  
  if (!report) {
    return (
      <div className="container mx-auto p-6">
        <h1 className="text-2xl font-semibold text-center">Report not found</h1>
        <div className="text-center mt-4">
          <Link href="/doctor-dashboard/reports">
            <Button>Back to Reports</Button>
          </Link>
        </div>
      </div>
    )
  }

  // Get ML analysis results - prioritize ml_suggestions over reports.result
  let findings = 'No findings available'
  let confidence = 0
  let recommendations = 'No recommendations available'
  let severity = 'Unknown'
  let status = 'Unknown'
  let reportResultDetails: any = null

  if (mlSuggestion) {
    // Use ML suggestion data
    findings = mlSuggestion.findings || 'No findings available'
    confidence = mlSuggestion.confidence || 0
    recommendations = mlSuggestion.recommendations || 'No recommendations available'
    severity = mlSuggestion.severity || 'Unknown'
    status = mlSuggestion.status || 'Unknown'
  } else if (report.result) {
    // Fallback to reports.result (backward compatibility)
    const result = report.result
    findings = result.findings || 'No findings available'
    confidence = result.confidence || 0
    recommendations = result.recommendations || 'No recommendations available'
    severity = result.severity || 'Unknown'
  }
  reportResultDetails = (report.result as any)?.details || null

  // Extract and clean patient information
  const patientInfo = (report.patient_info as any) || {}
  
  // Helper function to clean up placeholder values
  const cleanValue = (value: any, defaultValue: string = 'Not provided') => {
    if (!value || value === 'Unknown' || value === 'Not specified' || value === 'Not provided' || value === 'Not applicable') {
      return defaultValue
    }
    return value
  }

  // Extract patient details with proper fallbacks
  const patientId = report.patient_id || patientInfo.patientId || 'Unknown'
  const fullName = cleanValue(patientInfo.fullName, 'Not provided')
  const dateOfBirth = cleanValue(patientInfo.dateOfBirth, 'Not provided')
  const age = cleanValue(patientInfo.age, 'Not provided')
  const gender = cleanValue(patientInfo.gender, 'Not specified')
  const phoneNumber = cleanValue(patientInfo.phoneNumber, 'Not provided')
  const address = cleanValue(patientInfo.address, 'Not provided')
  
  // Only show relevant fields based on test type
  const testType = report.test_type || patientInfo.testType || 'Unknown'
  const normalizedTestType = testType.toLowerCase()
  const isEyeTest = testType.toLowerCase().includes('eye') || testType.toLowerCase().includes('retina')
  const isXrayTest =
    normalizedTestType.includes('xray') ||
    normalizedTestType.includes('x_ray') ||
    normalizedTestType.includes('x-ray') ||
    normalizedTestType.includes('bone')
  const eyeSide = isEyeTest ? cleanValue(patientInfo.eyeSide, 'Not specified') : null
  
  // Medical history (only show if not "None" or placeholder)
  const familyHistory = cleanValue(patientInfo.familyHistoryOfCancer, undefined)
  const previousDiagnosis = cleanValue(patientInfo.previousDiagnosis, undefined)
  const ongoingTreatments = cleanValue(patientInfo.ongoingTreatments, undefined)
  
  // Timestamps
  const recordCreated = patientInfo.recordCreated ? new Date(patientInfo.recordCreated).toLocaleDateString() : 'Not available'
  const lastUpdated = patientInfo.lastUpdated ? new Date(patientInfo.lastUpdated).toLocaleDateString() : 'Not available'

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending_review': return 'border-amber-600 text-amber-600 bg-amber-50'
      case 'reviewed': return 'border-emerald-600 text-emerald-600 bg-emerald-50'
      case 'accepted': return 'border-indigo-600 text-indigo-600 bg-indigo-50'
      case 'rejected': return 'border-red-600 text-red-600 bg-red-50'
      default: return 'border-black/20 text-black/40 bg-black/[0.02]'
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'border-red-600 text-red-600 bg-red-50 font-black'
      case 'severe': return 'border-red-500 text-red-500 bg-red-50 font-bold'
      case 'moderate': return 'border-amber-600 text-amber-600 bg-amber-50'
      case 'mild':
      case 'none': return 'border-emerald-600 text-emerald-600 bg-emerald-50'
      default: return 'border-black/20 text-black/40 bg-black/[0.02]'
    }
  }

  return (
    <div className="min-h-screen bg-transparent p-6 md:p-12 max-w-[1600px] mx-auto">
      <header className="border-b border-black/10 pb-6 mb-8 flex-shrink-0 flex items-end justify-between">
        <div>
          <Link href="/doctor-dashboard/reports" className="inline-flex items-center space-x-2 text-xs font-mono uppercase tracking-widest text-black/40 hover:text-black mb-4 transition-colors">
            <ArrowLeft className="h-3 w-3" />
            <span>Back to Reports</span>
          </Link>
          <div className="flex items-center gap-4">
            <h1 className="text-4xl font-bold tracking-tight uppercase">Medical Report Analysis</h1>
          </div>
          <p className="text-sm font-mono text-black/60 uppercase mt-2">
            AI-powered analysis for medical imaging
          </p>
        </div>
        <div className="text-right hidden md:block">
          <span className="text-[10px] font-mono uppercase tracking-widest text-black/40 block mb-3">
            System Status
          </span>
          <span className="text-xl font-mono border-b border-black inline-flex items-center gap-2 mb-6">
            <span className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></span>
            ACTIVE
          </span>
          <PrintButton className="print:hidden w-full bg-black text-white hover:bg-black/80 rounded-none uppercase font-mono text-[10px] tracking-widest flex items-center justify-center h-10" />
        </div>
      </header>
      
      <div className="grid lg:grid-cols-12 gap-12">
        {/* Left Column - Image & Bounding Box */}
        <div className="lg:col-span-5 space-y-12">
          {/* Original Image */}
          {(report.original_image_url || report.file_name) && (
            <div>
              <div className="flex items-center gap-3 border-b border-black/10 pb-4 mb-6">
                <div className="h-2 w-2 bg-black rounded-full"></div>
                <h2 className="text-xl font-bold uppercase">Source Scan</h2>
              </div>
              <div className="border border-black p-4 bg-white relative">
                <span className="absolute top-0 right-0 bg-black text-white px-2 py-1 text-[10px] font-mono uppercase">Original</span>
                <div className="flex justify-center mt-4">
                  <img
                    src={`/api/file/signed-url?path=${report.original_image_url || report.file_name}`}
                    alt="Medical scan"
                    className="w-full object-contain max-h-[500px]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* BBox Viewer (if X-ray) */}
          {isXrayTest && (report.original_image_url || report.file_name) && (
            <div>
              <div className="flex items-center gap-3 border-b border-black/10 pb-4 mb-6">
                <div className="h-2 w-2 bg-black rounded-full"></div>
                <h2 className="text-xl font-bold uppercase">Bounding Box Details</h2>
              </div>
              <div className="border border-black p-4 bg-white relative">
                <span className="absolute top-0 right-0 bg-black text-white px-2 py-1 text-[10px] font-mono uppercase">AI Processed</span>
                <div className="mt-4">
                  <BBoxAnalysisViewer
                    imageUrl={`/api/file/signed-url?path=${report.original_image_url || report.file_name}`}
                    details={reportResultDetails}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Data & Results */}
        <div className="lg:col-span-7 space-y-12">
          
          {/* AI Analysis Results */}
          <div>
            <div className="flex items-center gap-3 border-b border-black/10 pb-4 mb-6 justify-between">
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 bg-black rounded-full"></div>
                <h2 className="text-xl font-bold uppercase">Machine Analysis</h2>
              </div>
              {mlSuggestion && (
                <div className="flex space-x-2">
                  {reportResultDetails?.uncertain && (
                    <span className="px-2 py-0.5 border border-black bg-black/[0.02] text-xs font-mono font-bold uppercase">
                      UNCERTAIN
                    </span>
                  )}
                  <span className={`px-2 py-0.5 border text-xs font-mono font-bold uppercase tracking-tighter ${getStatusColor(status)}`}>
                    {status.replace('_', ' ')}
                  </span>
                  <span className={`px-2 py-0.5 border text-xs font-mono font-bold uppercase tracking-tighter ${getSeverityColor(severity)}`}>
                    {severity}
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-6">
              <ClinicalNotice>Model output is unvalidated decision support; confirm clinically.</ClinicalNotice>
              <div className="border border-black/10 bg-black/[0.02] p-6">
                <h3 className="font-bold text-sm uppercase mb-2 border-b border-black/5 pb-2">Findings</h3>
                <p className="font-mono text-sm leading-relaxed">{findings}</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="border border-black/10 p-4 bg-white text-center">
                  <h4 className="text-[11px] font-mono uppercase text-black/40 mb-2">Confidence Score</h4>
                  <p className="text-3xl font-bold font-mono">{(confidence * 100).toFixed(1)}%</p>
                </div>
                
                <div className="border border-black/10 p-4 bg-white text-center">
                  <h4 className="text-[11px] font-mono uppercase text-black/40 mb-2">Severity Level</h4>
                  <p className="text-xl font-bold uppercase mt-2">{severity}</p>
                </div>
                
                <div className="border border-black/10 p-4 bg-white text-center">
                  <h4 className="text-[11px] font-mono uppercase text-black/40 mb-2">Analysis Status</h4>
                  <p className="text-lg font-bold uppercase mt-2">{status.replace('_', ' ')}</p>
                </div>
              </div>
              
              <div className="border border-black p-6 bg-white relative">
                <span className="absolute -top-2.5 left-4 bg-white px-2 font-bold text-[11px] tracking-widest uppercase">Recommendations</span>
                <p className="font-mono text-sm leading-relaxed">{recommendations}</p>
              </div>

              {mlSuggestion && (
                <div className="flex flex-wrap gap-6 pt-4 border-t border-black/10 text-[11px] font-mono uppercase text-black/60">
                  <p>
                    <span className="font-bold text-black border-b border-black/10 pb-0.5 mr-2">Processed</span> 
                    {new Date(mlSuggestion.processed_at).toLocaleString()}
                  </p>
                  {mlSuggestion.reviewed_at && (
                    <p>
                      <span className="font-bold text-black border-b border-black/10 pb-0.5 mr-2">Reviewed</span> 
                      {new Date(mlSuggestion.reviewed_at).toLocaleString()}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Patient Information & Metadata */}
          <div className="grid md:grid-cols-2 gap-12">
            <div>
              <div className="flex items-center gap-3 border-b border-black/10 pb-4 mb-6">
                <h2 className="text-xl font-bold uppercase">Patient Info</h2>
              </div>
              <div className="border border-black/10 bg-black/[0.02]">
                <div className="grid grid-cols-1 divide-y divide-black/10">
                  <div className="flex justify-between p-3 bg-white">
                    <span className="text-[11px] font-mono uppercase text-black/40">Patient ID</span>
                    <span className="text-xs font-bold uppercase">{patientId}</span>
                  </div>
                  
                  {fullName !== 'Not provided' && (
                    <div className="flex justify-between p-3 bg-white">
                      <span className="text-[10px] font-mono uppercase text-black/40">Full Name</span>
                      <span className="text-xs font-bold uppercase">{fullName}</span>
                    </div>
                  )}
                  
                  {age !== 'Not provided' && (
                    <div className="flex justify-between p-3 bg-white">
                      <span className="text-[10px] font-mono uppercase text-black/40">Age / Gender</span>
                      <span className="text-xs font-bold uppercase">{age}Y / {gender}</span>
                    </div>
                  )}
                  
                  {phoneNumber !== 'Not provided' && (
                    <div className="flex justify-between p-3 bg-white">
                      <span className="text-[10px] font-mono uppercase text-black/40">Phone</span>
                      <span className="text-xs font-bold font-mono">{phoneNumber}</span>
                    </div>
                  )}

                  {eyeSide && (
                    <div className="flex justify-between p-3 bg-white border-t border-black/5">
                      <span className="text-[10px] font-mono uppercase text-black/40">Eye Side</span>
                      <span className="text-xs font-bold uppercase">{eyeSide}</span>
                    </div>
                  )}

                  {familyHistory && (
                    <div className="p-3 bg-white flex flex-col gap-1 border-t border-black/5">
                      <span className="text-[10px] font-mono uppercase text-black/40">Family History</span>
                      <span className="text-xs font-mono">{familyHistory}</span>
                    </div>
                  )}

                  {previousDiagnosis && (
                    <div className="p-3 bg-white flex flex-col gap-1 border-t-2 border-black/10">
                      <span className="text-[10px] font-mono uppercase text-black/40">Previous Diagnosis</span>
                      <span className="text-xs font-mono">{previousDiagnosis}</span>
                    </div>
                  )}
                  
                  {ongoingTreatments && (
                    <div className="p-3 bg-white flex flex-col gap-1">
                      <span className="text-[10px] font-mono uppercase text-black/40">Ongoing Treatments</span>
                      <span className="text-xs font-mono">{ongoingTreatments}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-3 border-b border-black/10 pb-4 mb-6">
                <h2 className="text-xl font-bold uppercase">Report Details</h2>
              </div>
              <div className="border border-black/10 bg-black/[0.02]">
                <div className="grid grid-cols-1 divide-y divide-black/10">
                  <div className="flex justify-between p-3 bg-white">
                    <span className="text-[10px] font-mono uppercase text-black/40">Test Type</span>
                    <span className="text-xs font-bold uppercase">{testType}</span>
                  </div>
                  <div className="flex justify-between p-3 bg-white">
                    <span className="text-[10px] font-mono uppercase text-black/40">Priority</span>
                    <span className={`text-xs font-bold uppercase px-1.5 py-0.5 border ${report.priority === 'urgent' || report.priority === 'critical' ? 'border-red-500 text-red-600 bg-red-50' : 'border-black'}`}>{report.priority || 'Normal'}</span>
                  </div>
                  <div className="flex flex-col gap-1 p-3 bg-white">
                    <span className="text-[10px] font-mono uppercase text-black/40">File Name</span>
                    <span className="text-[10px] font-mono truncate">{report.original_name || 'Unknown'}</span>
                  </div>
                  <div className="flex justify-between p-3 bg-white">
                    <span className="text-[10px] font-mono uppercase text-black/40">Uploaded</span>
                    <span className="text-[10px] font-mono">{report.uploaded_at ? new Date(report.uploaded_at).toLocaleDateString() : 'Unknown'}</span>
                  </div>
                  <div className="flex flex-col gap-1 p-3 bg-white">
                    <span className="text-[10px] font-mono uppercase text-black/40">Report ID</span>
                    <span className="text-[10px] font-mono text-black/60">{report.id}</span>
                  </div>
                  
                  {report.notes && (
                    <div className="flex flex-col gap-1 p-3 bg-white border-t-2 border-black/10">
                      <span className="text-[10px] font-mono uppercase text-black/40">Physician Notes</span>
                      <span className="text-sm font-mono">{report.notes}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 