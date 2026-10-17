import { NextRequest, NextResponse, after } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { reportProcessingSchema } from '@/lib/schemas'
import { verifySession, unauthorizedResponse, forbiddenResponse } from '@/lib/api-utils'
import { LAB_AI_TEST_TYPES, LAB_AI_MIME_TYPES, labReadingToSuggestion, readLabReport } from '@/lib/lab-report-ai'

// Runs after every upload (from the lab) and on "Run AI again" (from a doctor treating
// the patient). It tells the doctor about a new upload, then reads the file in the
// background so the lab can close the page: X-ray and MRI go to our scan models, blood
// and urine reports to the lab-report reader, other tests have no AI. reports.ai_status
// shows where it stands.
export const maxDuration = 60

const IMAGING_TEST_TYPES = ['x_ray', 'mri']
const SCAN_SERVICE_TYPE: Record<string, string> = { x_ray: 'xray', mri: 'mri' }

type Report = {
  id: string; patient_id: string; doctor_id: string | null; uploaded_by: string | null
  test_type: string; file_name: string; original_name: string; ai_status: string; updated_at: string | null
}

export async function POST(request: NextRequest) {
  const { user } = await verifySession()
  if (!user) return unauthorizedResponse()
  const role = user.app_metadata?.role
  if (role !== 'lab' && role !== 'doctor') return forbiddenResponse()

  const parsed = reportProcessingSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.format() }, { status: 400 })
  }
  const { reportId, runAi } = parsed.data

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[ml-process] Missing Supabase server configuration')
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: report } = await supabase
    .from('reports')
    .select('id, patient_id, doctor_id, uploaded_by, test_type, file_name, original_name, ai_status, updated_at')
    .eq('id', reportId)
    .maybeSingle<Report>()
  if (!report) return forbiddenResponse()

  // The service role skips RLS, so check the caller here: the verified lab that uploaded
  // the report, or a verified doctor currently treating the patient.
  const { data: caller } = await supabase.from('profiles').select('verified').eq('id', user.id).maybeSingle()
  let allowed = false
  if (role === 'lab' && caller?.verified && report.uploaded_by === user.id) allowed = true
  if (role === 'doctor' && caller?.verified) {
    const { data: link } = await supabase.from('doctor_patient_assignments').select('id')
      .eq('doctor_id', user.id).eq('patient_id', report.patient_id).eq('is_active', true).limit(1)
    allowed = (link?.length ?? 0) > 0
  }
  if (!allowed) return forbiddenResponse()

  // First call after an upload: tell the doctor it arrived, whatever the test type.
  if (role === 'lab' && report.ai_status === 'pending' && report.doctor_id) {
    const patientName = await nameOf(supabase, report.patient_id)
    await notify(supabase, report.doctor_id, 'report_upload', 'New report uploaded',
      `${patientName}'s ${label(report.test_type)} report is ready for your review.`, report.id)
  }

  const kind = IMAGING_TEST_TYPES.includes(report.test_type) ? 'scan'
    : LAB_AI_TEST_TYPES.includes(report.test_type) ? 'lab_values' : null
  if (!runAi || !kind) {
    await supabase.from('reports').update({ ai_status: 'not_applicable' }).eq('id', report.id)
    return NextResponse.json({ status: 'not_applicable' })
  }

  // Don't start a second run while one is going (unless it has been stuck for 2 minutes),
  // and don't replace an AI reading a doctor has already reviewed.
  const stuck = report.updated_at && Date.now() - new Date(report.updated_at).getTime() > 120_000
  if (report.ai_status === 'running' && !stuck) return NextResponse.json({ status: 'running' }, { status: 202 })
  const { count: reviews } = await supabase.from('report_reviews').select('id', { count: 'exact', head: true }).eq('report_id', report.id)
  if ((reviews ?? 0) > 0) return NextResponse.json({ error: 'This report has already been reviewed' }, { status: 409 })

  await supabase.from('reports').update({ ai_status: 'running', updated_at: new Date().toISOString() }).eq('id', report.id)
  after(() => runAiReading(supabase, report, kind, role === 'doctor' ? user.id : null))
  return NextResponse.json({ status: 'running' }, { status: 202 })
}

async function runAiReading(supabase: SupabaseClient, report: Report, kind: 'scan' | 'lab_values', retriedBy: string | null) {
  try {
    const { data: file, error: downloadError } = await supabase.storage.from('reports').download(report.file_name)
    if (downloadError || !file) throw new Error(`download failed: ${downloadError?.message}`)

    let suggestion: { findings: string; recommendations: string; confidence: number | null; severity: string; details: unknown }
    if (kind === 'scan') {
      suggestion = await readScan(file, report)
      await supabase.from('reports').update({ result: suggestion }).eq('id', report.id) // the box viewer reads result.details
    } else {
      if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not configured')
      const mime = file.type && file.type !== 'application/octet-stream' ? file.type : mimeFromName(report.file_name)
      if (!LAB_AI_MIME_TYPES.includes(mime)) throw new Error(`no AI for ${mime} files`)
      suggestion = labReadingToSuggestion(await readLabReport(file, mime, process.env.GEMINI_API_KEY))
    }

    // A retry replaces the earlier (failed or unreviewed) reading.
    await supabase.from('ml_suggestions').delete().eq('report_id', report.id)
    const { data: saved, error: insertError } = await supabase.from('ml_suggestions').insert({
      report_id: report.id,
      patient_id: report.patient_id,
      test_type: report.test_type,
      findings: suggestion.findings,
      recommendations: suggestion.recommendations,
      confidence: suggestion.confidence,
      severity: suggestion.severity,
      details: suggestion.details,
      status: 'pending_review',
      processed_at: new Date().toISOString(),
    }).select('id').single()
    if (insertError) throw new Error(`saving the reading failed: ${insertError.message}`)

    await supabase.from('reports').update({ ai_status: 'done', updated_at: new Date().toISOString() }).eq('id', report.id)
    await supabase.from('audit_logs').insert({
      actor_id: retriedBy, patient_id: report.patient_id, action: 'create', resource_type: 'ml_suggestions',
      resource_id: saved.id, details: { test_type: report.test_type, kind, confidence: suggestion.confidence },
    })
    if (report.doctor_id) {
      await notify(supabase, report.doctor_id, 'ml_suggestion', 'AI reading ready',
        `The AI has read ${await nameOf(supabase, report.patient_id)}'s ${label(report.test_type)} report.`, report.id)
    }
  } catch (err) {
    console.error('[ml-process] AI reading failed:', err instanceof Error ? err.message : err)
    await supabase.from('reports').update({ ai_status: 'failed', updated_at: new Date().toISOString() }).eq('id', report.id)
    if (report.doctor_id) {
      await notify(supabase, report.doctor_id, 'ml_suggestion', 'AI could not read a report',
        `Review ${await nameOf(supabase, report.patient_id)}'s ${label(report.test_type)} report yourself, or run the AI again.`, report.id)
    }
  }
}

async function readScan(file: Blob, report: Report) {
  if (!process.env.ML_SERVICE_URL || !process.env.INTERNAL_API_KEY) throw new Error('ML service is not configured')
  const form = new FormData()
  form.append('scan_type', SCAN_SERVICE_TYPE[report.test_type])
  form.append('file', file, report.original_name)
  // The Space sleeps when idle and can take a while to wake; the route allows 60 s.
  const response = await fetch(`${process.env.ML_SERVICE_URL}/analyze`, {
    method: 'POST',
    body: form,
    headers: { 'X-Internal-Secret': process.env.INTERNAL_API_KEY },
    signal: AbortSignal.timeout(50_000),
  })
  if (!response.ok) throw new Error(`ML service responded ${response.status}`)
  const p = await response.json()
  return {
    findings: p.findings || 'No specific findings detected.',
    recommendations: p.recommendations || 'No recommendations available.',
    confidence: typeof p.confidence === 'number' ? p.confidence : null,
    severity: p.severity || 'unknown',
    details: p.details ?? null,
  }
}

async function notify(supabase: SupabaseClient, userId: string, type: string, title: string, message: string, reportId: string) {
  const { error } = await supabase.from('notifications').insert({
    user_id: userId, title, message, notification_type: type, related_id: reportId, related_type: 'report',
    target_role: 'doctor', action_url: `/doctor-dashboard/reports/${reportId}`,
  })
  if (error) console.warn('[ml-process] notification failed:', error.message)
}

async function nameOf(supabase: SupabaseClient, id: string) {
  const { data } = await supabase.from('profiles').select('name').eq('id', id).maybeSingle()
  return data?.name || 'A patient'
}

const label = (testType: string) => testType.replace(/_/g, ' ')

function mimeFromName(name: string) {
  const ext = name.split('.').pop()?.toLowerCase()
  return ext === 'pdf' ? 'application/pdf' : ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp'
    : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'application/octet-stream'
}
