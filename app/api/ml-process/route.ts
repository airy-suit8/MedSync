import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import path from 'path'
import axios from 'axios'
import FormData from 'form-data'
import { analysisRequestSchema } from '@/lib/schemas'
import { verifySession, unauthorizedResponse, forbiddenResponse, hasRole } from '@/lib/api-utils'

export async function POST(request: NextRequest) {
  try {
    // Verify session
    const { user } = await verifySession()
    if (!user) {
      return unauthorizedResponse()
    }
    if (!hasRole(user, 'lab')) {
      return forbiddenResponse()
    }

    // Validate environment variables first
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      console.error('[ml-process] Missing NEXT_PUBLIC_SUPABASE_URL')
      return NextResponse.json(
        { error: 'Server configuration error: Missing Supabase URL' },
        { status: 500 }
      )
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[ml-process] Missing SUPABASE_SERVICE_ROLE_KEY')
      return NextResponse.json(
        { error: 'Server configuration error: Missing service role key' },
        { status: 500 }
      )
    }

    // SECURITY: Require INTERNAL_API_KEY — never fall back to a default secret
    if (!process.env.INTERNAL_API_KEY) {
      console.error('[ml-process] INTERNAL_API_KEY is not configured. Refusing to call ML service.')
      return NextResponse.json(
        { error: 'Server configuration error: Internal API key not set' },
        { status: 500 }
      )
    }

    const body = await request.json()

    // Strict Zod Validation
    const validation = analysisRequestSchema.safeParse(body)

    if (!validation.success) {
      console.error('[ml-process] Validation Error:', validation.error.format())
      return NextResponse.json(
        { error: 'Invalid input data', details: validation.error.format() },
        { status: 400 }
      )
    }

    const { fileName, originalName, patientId, doctorId, testType, reportId } = validation.data

    // Create service role client for server-side operations
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const { data: report, error: reportError } = await supabase
      .from('reports')
      .select('id, file_name, original_name, patient_id, doctor_id, uploaded_by, test_type')
      .eq('id', reportId)
      .maybeSingle()

    if (reportError) {
      console.error('[ml-process] Report access check failed:', reportError.message)
      return NextResponse.json({ error: 'Failed to verify report access' }, { status: 500 })
    }
    if (!report || report.uploaded_by !== user.id || report.file_name !== fileName ||
        report.original_name !== originalName || report.test_type !== testType) {
      return forbiddenResponse()
    }

    const resolvedPatientId = report.patient_id
    const resolvedDoctorId = report.doctor_id

    // Download file from Supabase Storage using service role
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('reports')
      .download(fileName)

    if (downloadError || !fileData) {
      console.error('[ml-process] Storage download error:', downloadError?.message)
      return NextResponse.json(
        { error: 'Failed to download file', details: downloadError?.message },
        { status: 500 }
      )
    }

    // PERFORMANCE: Stream the buffer directly to FastAPI — no temp file on disk
    const arrayBuffer = await fileData.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Call FastAPI for ML analysis
    let prediction
    try {
      const fastApiForm = new FormData();
      fastApiForm.append('scan_type', testType === 'x_ray' ? 'xray' : testType === 'mri' ? 'mri' : testType);
      fastApiForm.append('file', buffer, originalName);

      if (!process.env.ML_SERVICE_URL) {
        throw new Error('ML_SERVICE_URL is not configured');
      }
      const mlServiceUrl = process.env.ML_SERVICE_URL;
      const response = await axios.post(`${mlServiceUrl}/analyze`, fastApiForm, {
        headers: {
          ...fastApiForm.getHeaders(),
          'X-Internal-Secret': process.env.INTERNAL_API_KEY
        },
        timeout: 30000, // 30 second timeout
      });

      prediction = response.data;

      // Ensure all required fields are present
      if (!prediction.findings) prediction.findings = 'No specific findings detected.';
      if (typeof prediction.confidence !== 'number') prediction.confidence = 0.5;
      if (!prediction.recommendations) prediction.recommendations = 'No recommendations available.';
      if (!prediction.severity) prediction.severity = 'unknown';

    } catch (err: any) {
      console.error('[ml-process] ML service error:', err.message)
      prediction = {
        findings: 'AI analysis unavailable. Please review manually.',
        confidence: 0.0,
        recommendations: 'Manual review recommended.',
        severity: 'unknown',
      };
    }

    // Update the existing report with ML results
    const updateData = {
      result: prediction,
      updated_at: new Date().toISOString(),
      doctor_id: resolvedDoctorId || null,
    }

    const { error: updateError } = await supabase
      .from('reports')
      .update(updateData)
      .eq('id', reportId)

    if (updateError) {
      console.error('[ml-process] Report update error:', updateError.message)

      // If it's a UUID format error, provide more specific guidance
      if (updateError.message.includes('invalid input syntax for type uuid')) {
        return NextResponse.json(
          {
            error: 'Failed to update report with ML results',
            details: `Invalid UUID format for doctor ID: ${resolvedDoctorId}. This might be a Short ID that couldn't be resolved to a UUID.`,
            suggestion: 'Please ensure the doctor ID is a valid UUID or Short ID that exists in the system.'
          },
          { status: 500 }
        )
      }

      return NextResponse.json(
        { error: 'Failed to update report with ML results', details: updateError.message },
        { status: 500 }
      )
    }

    // Store ML suggestion in ml_suggestions table
    const { data: suggestionData, error: suggestionError } = await supabase
      .from('ml_suggestions')
      .insert({
        report_id: reportId,
        patient_id: resolvedPatientId,
        test_type: testType,
        findings: prediction.findings,
        confidence: prediction.confidence,
        recommendations: prediction.recommendations,
        severity: prediction.severity,
        status: 'pending_review',
        processed_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (suggestionError) {
      console.error('[ml-process] ML suggestion insert error:', suggestionError.message)
      return NextResponse.json(
        { error: 'Failed to store ML suggestion', details: suggestionError.message },
        { status: 500 }
      )
    }

    // Audit log creation for system action
    await supabase.from('audit_logs').insert({
      actor_id: null, // System action
      patient_id: resolvedPatientId,
      action: 'create',
      resource_type: 'ml_suggestions',
      resource_id: suggestionData.id,
      details: { test_type: testType, confidence: prediction.confidence }
    })

    // Create notification for doctors about new ML analysis
    try {
      await supabase
        .from('notifications')
        .insert({
          user_id: resolvedDoctorId || resolvedPatientId || patientId, // Route to the doctor, not the report
          title: 'AI Analysis Complete',
          message: `AI analysis completed for ${testType} report - Patient ID: ${patientId}`,
          notification_type: 'ml_suggestion',
          related_id: suggestionData.id,
          related_type: 'ml_suggestion',
          data: {
            patient_id: patientId,
            test_type: testType,
            suggestion_id: suggestionData.id,
            confidence: prediction.confidence,
            severity: prediction.severity
          }
        })
    } catch (notificationError) {
      console.warn('[ml-process] Notification creation failed (non-fatal)')
      // Continue even if notification fails
    }

    return NextResponse.json({
      success: true,
      reportId: reportId,
      suggestionId: suggestionData.id,
      prediction,
    })

  } catch (error: any) {
    console.error('[ml-process] Internal error:', error.message)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}