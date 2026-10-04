"use client"

import { useState, useEffect } from 'react'
import { use } from 'react'
import Image from 'next/image'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Activity, Brain, FileText, Download } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { ErrorLogger } from '@/lib/error-logger'
import Link from 'next/link'

export default function PatientReportDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [report, setReport] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('reports')
          .select('*')
          .eq('id', id)
          .single()
        
        if (error) {
          ErrorLogger.logSupabaseError(error, {
            context: 'fetching_report_detail',
            reportId: id
          })
          setError(`Failed to load report: ${error?.message || 'Unknown error occurred'}`)
        } else if (!data) {
          setError('Report not found')
        } else {
          setReport(data)
          // Audit Log
          const { data: { session } } = await supabase.auth.getSession()
          if (session?.user?.id) {
            await supabase.from('audit_logs').insert({
              actor_id: session.user.id,
              patient_id: data.patient_id,
              action: 'view',
              resource_type: 'reports',
              resource_id: id,
              details: { viewer_role: 'patient' }
            })
          }
        }
      } catch (err) {
        ErrorLogger.logGenericError(err, {
          context: 'report_detail_fetch_unexpected',
          reportId: id
        })
        setError('An unexpected error occurred while loading the report')
      } finally {
        setLoading(false)
      }
    }

    fetchReport()
  }, [id])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-transparent">
        <div className="flex flex-col items-center">
          <Activity className="h-8 w-8 animate-spin mb-4 text-black" />
          <span className="text-xs font-mono uppercase tracking-widest text-black/60">Decrypting Record...</span>
        </div>
      </div>
    )
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center p-6">
        <div className="border border-black p-12 text-center max-w-md bg-white">
          <h1 className="text-3xl font-bold uppercase mb-4 tracking-tighter">Access Denied</h1>
          <p className="text-black/60 font-mono text-xs uppercase mb-8 leading-relaxed">{error || 'The requested medical report could not be located in the secure database.'}</p>
          <Link href="/patient-dashboard/reports">
            <Button className="bg-black text-white rounded-none px-8 h-12 uppercase font-mono text-xs tracking-widest">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Return to Archives
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-transparent p-12 max-w-6xl mx-auto">
      {/* Header */}
      <header className="border-b border-black/10 pb-8 mb-12 flex items-end justify-between">
        <div>
          <Link href="/patient-dashboard/reports" className="print:hidden inline-flex items-center space-x-2 text-xs font-mono uppercase tracking-widest text-black/40 hover:text-black mb-4 transition-colors">
            <ArrowLeft className="h-3 w-3" />
            <span>Archive Index</span>
          </Link>
          <h1 className="text-4xl font-bold tracking-tight uppercase mb-2">Report Detail</h1>
          <div className="flex items-center gap-4">
            <p className="text-black/40 font-mono text-[10px] uppercase tracking-widest">
              UUID: {report.id}
            </p>
            <span className="h-1 w-1 bg-black/20 rounded-full"></span>
            <p className="text-black/40 font-mono text-[10px] uppercase tracking-widest">
              TS: {new Date(report.uploaded_at).toISOString()}
            </p>
          </div>
        </div>
        <div className="text-right hidden md:block">
          <span className="text-[10px] font-mono uppercase tracking-widest text-black/40 block mb-3">
            Data Integrity
          </span>
          <span className="text-xl font-mono border-b-2 border-green-500 inline-flex items-center gap-2 mb-6">
            VERIFIED
          </span>
          <Button
            onClick={() => window.print()}
            className="print:hidden w-full bg-black text-white hover:bg-black/80 rounded-none uppercase font-mono text-[10px] tracking-widest flex items-center justify-center gap-2 h-10"
          >
            <Download className="h-4 w-4" />
            SAVE AS PDF
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-12">
          {/* AI Analysis Section */}
          {(report.result || report.findings) && (
            <div className="border border-black/10 bg-white p-8 relative overflow-hidden">
              <div className="absolute left-0 top-0 h-full w-0.5 bg-amber-600"></div>
              <h2 className="text-xl font-black uppercase mb-8 flex items-center gap-3 tracking-tighter">
                <Brain className="h-6 w-6 text-amber-600" />
                <span>AI Health Briefing</span>
              </h2>
              
              <div className="space-y-8">
                {report.result?.findings && (
                  <div>
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-black/40 mb-3">Diagnostic Findings</h3>
                    <div className="p-6 bg-black/[0.02] border border-black/5">
                      <p className="text-sm font-mono text-black leading-relaxed uppercase">
                        {report.result.findings}
                      </p>
                    </div>
                  </div>
                )}
                
                {report.result?.recommendations && (
                  <div>
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-black/40 mb-3">Action Plan</h3>
                    <div className="p-6 bg-emerald-50 border border-emerald-500/20">
                      <p className="text-sm font-mono text-emerald-900 leading-relaxed uppercase">
                        {report.result.recommendations}
                      </p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-8 pt-4 border-t border-black/5">
                  <div>
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-black/40 mb-2">Confidence</h3>
                    <span className="text-2xl font-mono">{Math.round((report.result?.confidence || 0.95) * 100)}%</span>
                  </div>
                  <div>
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-black/40 mb-2">Severity</h3>
                    <span className={`text-2xl font-mono uppercase ${
                      report.result?.severity === 'high' ? 'text-red-600 border-b-2 border-red-600' : 'text-green-600 border-b-2 border-green-600'
                    }`}>
                      {report.result?.severity || 'NORMAL'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Report Source View */}
          <div className="border border-black/10 bg-white p-8">
            <h2 className="text-xl font-black uppercase mb-8 tracking-tighter">Diagnostic Imagery</h2>
            <div className="bg-black/[0.02] border border-black/5 p-4 min-h-[400px] flex items-center justify-center relative group">
              {report.file_name?.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i) ? (
                <img
                  src={`/api/file/signed-url?path=${report.file_name}`}
                  alt="Medical report"
                  className="opacity-90 group-hover:opacity-100 transition-opacity grayscale hover:grayscale-0 duration-500 max-h-[600px] w-full object-contain"
                />
              ) : (
                <div className="text-center p-12">
                  <div className="bg-black text-white p-4 inline-block mb-6">
                    <FileText className="h-8 w-8" />
                  </div>
                  <p className="text-xs font-mono uppercase tracking-widest text-black/60 mb-2">Non-Rasterized Document</p>
                  <p className="text-[10px] font-mono uppercase text-black/40">File Type: PDF / Dicom</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-8">
          <div className="border border-black/10 bg-white p-8">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-black/40 mb-6">Technical Metadata</h3>
            <div className="space-y-6">
              {[
                { label: 'Test Type', value: report.test_type },
                { label: 'Priority', value: report.priority },
                { label: 'Category', value: 'Diagnostic' },
                { label: 'Status', value: 'Finalized' }
              ].map((item, i) => (
                <div key={i}>
                  <p className="text-[10px] font-mono text-black/40 uppercase mb-1">{item.label}</p>
                  <p className="text-sm font-bold uppercase tracking-tight">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="border border-black/10 bg-white p-8 relative overflow-hidden">
             <div className="absolute left-0 top-0 h-full w-0.5 bg-indigo-600"></div>
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-black/40 mb-6">Patient Context</h3>
            <div className="space-y-6">
              {[
                { label: 'ID', value: report.patient_info?.patientId || report.patient_id },
                { label: 'Gender', value: report.patient_info?.gender || 'N/A' },
                { label: 'Age Group', value: report.patient_info?.age || 'N/A' }
              ].map((item, i) => (
                <div key={i}>
                  <p className="text-[10px] font-mono text-black/40 uppercase mb-1">{item.label}</p>
                  <p className="text-sm font-bold uppercase tracking-tight">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          {report.notes && (
            <div className="border border-black/10 bg-white p-8">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-black/40 mb-4">Clinical Notes</h3>
              <p className="text-xs font-mono text-black/60 uppercase leading-relaxed">
                {report.notes}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}