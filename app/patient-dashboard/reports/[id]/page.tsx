"use client"

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { ArrowLeft, Brain, Clock, Download, FileText, Stethoscope } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase'
import { ErrorLogger } from '@/lib/error-logger'
import ClinicalNotice from "@/components/medical/common/ClinicalNotice"
import { VERDICTS, type Review } from '@/lib/review'
import LabValuesTable from '@/components/medical/LabValuesTable'
import PrescriptionList from '@/components/medical/PrescriptionList'
import type { LabValue } from '@/lib/lab-report-ai'

type ShownReview = Review & { doctor_name: string; image_url: string | null }
type Ai = { findings: string | null; recommendations: string | null; confidence: number | null; severity: string | null; details?: { kind?: string; tests?: LabValue[] } | null }

// The patient sees a report's AI reading only after a doctor has reviewed it, together
// with what the doctor wrote. Until then the page says the doctor is reviewing it.
export default function PatientReportDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [report, setReport] = useState<any>(null)
  const [reviews, setReviews] = useState<ShownReview[]>([])
  const [ai, setAi] = useState<Ai | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase.from('reports').select('*').eq('id', id).maybeSingle()
        if (error) {
          ErrorLogger.logSupabaseError(error, { context: 'fetching_report_detail', reportId: id })
          setError('We could not load this report. Please try again.')
          return
        }
        if (!data) {
          setError('This report does not exist or is not yours.')
          return
        }
        setReport(data)

        const [{ data: reviewRows }, { data: suggestion }] = await Promise.all([
          supabase.from('report_reviews').select('id, doctor_id, verdict, patient_note, note_image_path, updated_at').eq('report_id', id).order('updated_at'),
          supabase.from('ml_suggestions').select('findings, recommendations, confidence, severity, details').eq('report_id', id).order('processed_at', { ascending: false }).limit(1).maybeSingle(),
        ])
        const rows = (reviewRows || []) as Review[]
        const doctorIds = [...new Set(rows.map((r) => r.doctor_id))]
        const { data: doctors } = doctorIds.length
          ? await supabase.from('profile_directory').select('id, name').in('id', doctorIds)
          : { data: [] }
        const nameById = new Map<string, string | null>((doctors || []).map((d: { id: string; name: string | null }) => [d.id, d.name]))
        setReviews(await Promise.all(rows.map(async (r) => ({
          ...r,
          doctor_name: nameById.get(r.doctor_id) || 'Your doctor',
          image_url: r.note_image_path
            ? (await supabase.storage.from('review-notes').createSignedUrl(r.note_image_path, 3600)).data?.signedUrl || null
            : null,
        }))))
        const reading = suggestion || data.result
        if (reading?.findings && !String(reading.findings).startsWith('AI analysis unavailable')) setAi(reading)

        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user?.id) {
          await supabase.from('audit_logs').insert({
            actor_id: session.user.id, patient_id: data.patient_id, action: 'view',
            resource_type: 'reports', resource_id: id, details: { viewer_role: 'patient' },
          })
        }
      } catch (err) {
        ErrorLogger.logGenericError(err, { context: 'report_detail_fetch_unexpected', reportId: id })
        setError('Something went wrong while loading this report.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span role="status" className="text-xs font-mono uppercase tracking-widest text-black/60">Loading report…</span>
      </div>
    )
  }

  if (error || !report) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="border border-black p-12 text-center max-w-md bg-white">
          <h1 className="text-3xl font-bold uppercase mb-4 tracking-tighter">Report unavailable</h1>
          <p className="text-black/60 text-sm mb-8 leading-relaxed">{error}</p>
          <Button className="bg-black text-white rounded-none px-8 h-12 uppercase font-mono text-xs tracking-widest" asChild>
            <Link href="/patient-dashboard/reports"><ArrowLeft className="h-4 w-4 mr-2" />My reports</Link>
          </Button>
        </div>
      </div>
    )
  }

  const reviewed = reviews.length > 0
  const fileUrl = `/api/file/signed-url?path=${encodeURIComponent(report.file_name)}`
  const isImage = /\.(jpe?g|png|gif|bmp|webp)$/i.test(report.file_name || '')
  const severity = ai?.severity && ai.severity !== 'none' ? ai.severity : 'normal'

  return (
    <div className="min-h-screen p-6 lg:p-12 max-w-6xl mx-auto">
      <header className="border-b border-black/10 pb-8 mb-12 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href="/patient-dashboard/reports" className="print:hidden inline-flex items-center space-x-2 text-xs font-mono uppercase tracking-widest text-black/60 hover:text-black mb-4">
            <ArrowLeft className="h-3 w-3" aria-hidden="true" />
            <span>My reports</span>
          </Link>
          <h1 className="text-4xl font-bold tracking-tight uppercase mb-2">{String(report.test_type || 'Report').replace(/_/g, ' ')}</h1>
          <p className="text-black/60 font-mono text-xs uppercase tracking-widest">
            Uploaded {report.uploaded_at ? format(parseISO(report.uploaded_at), 'd MMM yyyy') : ''}
            {' · '}{reviewed ? `Reviewed by ${reviews.length === 1 ? 'your doctor' : `${reviews.length} doctors`}` : 'Awaiting doctor review'}
          </p>
        </div>
        <Button onClick={() => window.print()} className="print:hidden bg-black text-white hover:bg-black/80 rounded-none uppercase font-mono text-[11px] tracking-widest flex items-center gap-2 h-10">
          <Download className="h-4 w-4" aria-hidden="true" />
          Save as PDF
        </Button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2 space-y-12">
          {!reviewed ? (
            <section className="border border-black p-8">
              <h2 className="flex items-center gap-3 text-xl font-bold uppercase mb-3">
                <Clock className="h-5 w-5" aria-hidden="true" />
                Your doctor is reviewing this report
              </h2>
              <p className="text-black/70 leading-relaxed max-w-xl">
                You&apos;ll get a notification when they&apos;ve looked at it. Their notes, and the AI&apos;s first reading if there is one, will appear here together.
              </p>
            </section>
          ) : (
            <section aria-labelledby="reviews" className="space-y-6">
              <h2 id="reviews" className="flex items-center gap-3 text-xl font-bold uppercase">
                <Stethoscope className="h-5 w-5" aria-hidden="true" />
                Doctor&apos;s review
              </h2>
              {reviews.map((r) => (
                <article key={r.id} className="border border-black p-8 space-y-4">
                  <p className="font-mono text-[11px] uppercase tracking-widest text-black/60">
                    {r.doctor_name} · {format(parseISO(r.updated_at), 'd MMM yyyy')}
                  </p>
                  <p className="text-lg font-bold">{VERDICTS[r.verdict].patient}</p>
                  {r.patient_note && <p className="leading-relaxed whitespace-pre-line">{r.patient_note}</p>}
                  {r.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
                    <img src={r.image_url} alt={`Handwritten note from ${r.doctor_name}`} className="max-h-96 border border-black/10" />
                  )}
                </article>
              ))}
            </section>
          )}

          {reviewed && ai && (
            <section aria-labelledby="ai" className="border border-black/10 bg-white p-8 space-y-6">
              <h2 id="ai" className="flex items-center gap-3 text-xl font-bold uppercase">
                <Brain className="h-5 w-5" aria-hidden="true" />
                AI first reading
              </h2>
              <ClinicalNotice>The AI assists your doctor; your doctor&apos;s review above is what counts.</ClinicalNotice>
              {ai.details?.kind === 'lab_values' && ai.details.tests && <LabValuesTable tests={ai.details.tests} />}
              {ai.findings && (
                <div>
                  <h3 className="text-[11px] font-mono uppercase tracking-widest text-black/60 mb-2">What it found</h3>
                  <p className="leading-relaxed">{ai.findings}</p>
                </div>
              )}
              {ai.recommendations && (
                <div>
                  <h3 className="text-[11px] font-mono uppercase tracking-widest text-black/60 mb-2">Suggested next step</h3>
                  <p className="leading-relaxed">{ai.recommendations}</p>
                </div>
              )}
              <dl className="grid grid-cols-2 gap-8 pt-4 border-t border-black/10">
                <div>
                  <dt className="text-[11px] font-mono uppercase tracking-widest text-black/60 mb-1">Confidence</dt>
                  <dd className="text-2xl font-mono">{typeof ai.confidence === 'number' ? `${Math.round(ai.confidence * 100)}%` : '—'}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-mono uppercase tracking-widest text-black/60 mb-1">Severity</dt>
                  <dd className={`text-2xl font-mono uppercase ${['critical', 'severe'].includes(severity) ? 'text-red-700' : severity === 'moderate' ? 'text-amber-700' : ''}`}>{severity}</dd>
                </div>
              </dl>
            </section>
          )}

          {reviewed && (
            <section aria-labelledby="rx" className="space-y-4">
              <h2 id="rx" className="text-xl font-bold uppercase">Prescriptions from this report</h2>
              <PrescriptionList patientId={report.patient_id} reportId={report.id} emptyText="No prescription was written for this report." />
            </section>
          )}

          <section aria-labelledby="file" className="border border-black/10 bg-white p-8">
            <h2 id="file" className="text-xl font-bold uppercase mb-6">Your file</h2>
            {isImage ? (
              // eslint-disable-next-line @next/next/no-img-element -- served through the signed-URL route
              <img src={fileUrl} alt={`${report.test_type} file`} className="max-h-[600px] w-full object-contain bg-black/[0.02]" />
            ) : (
              <a href={fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-3 border border-black px-6 py-4 font-mono text-xs uppercase tracking-widest hover:bg-black hover:text-white">
                <FileText className="h-5 w-5" aria-hidden="true" />
                Open {report.original_name || 'file'}
              </a>
            )}
          </section>
        </div>

        <aside className="space-y-8">
          <dl className="border border-black/10 bg-white p-8 space-y-6">
            <div>
              <dt className="text-[11px] font-mono uppercase text-black/60 mb-1">Test</dt>
              <dd className="font-bold uppercase">{String(report.test_type || '').replace(/_/g, ' ')}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-mono uppercase text-black/60 mb-1">Priority</dt>
              <dd className="font-bold uppercase">{report.priority || 'normal'}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-mono uppercase text-black/60 mb-1">Status</dt>
              <dd className="font-bold uppercase">{reviewed ? 'Reviewed' : 'Awaiting review'}</dd>
            </div>
          </dl>

          {report.notes && (
            <div className="border border-black/10 bg-white p-8">
              <h3 className="text-[11px] font-mono uppercase tracking-widest text-black/60 mb-3">Notes from the lab</h3>
              <p className="text-sm leading-relaxed">{report.notes}</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
