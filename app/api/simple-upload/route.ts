import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { UUID_REGEX } from '@/lib/constants'
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
    // Validate environment variables
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing Supabase environment variables')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

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

    // Get the request body
    const body = await request.json()
    const { 
      patientId, 
      doctorId,
      testType, 
      originalName, 
      fileName, 
      priority, 
      notes, 
      patientInfo 
    } = body

    // Validate required fields
    if (!patientId || !doctorId || !testType || !originalName || !fileName) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Resolve patientId: accept short_id or UUID
    let resolvedPatientId = patientId
    if (!UUID_REGEX.test(patientId)) {
      const { data: shortMatch, error: shortErr } = await supabase
        .from('profiles')
        .select('id')
        .eq('short_id', patientId)
        .maybeSingle()

      if (shortErr) {
        console.warn('[simple-upload] Short ID lookup error:', shortErr.message)
      }
      if (shortMatch?.id) {
        resolvedPatientId = shortMatch.id
      } else {
        return NextResponse.json(
          { error: 'Invalid patient identifier. Use a valid short code or UUID.' },
          { status: 400 }
        )
      }
    }

    // Resolve doctorId: accept short_id or UUID
    let resolvedDoctorId = doctorId
    if (!UUID_REGEX.test(doctorId)) {
      const { data: shortDoc, error: docErr } = await supabase
        .from('profiles')
        .select('id')
        .eq('short_id', doctorId)
        .maybeSingle()

      if (docErr) {
        console.warn('[simple-upload] Doctor Short ID lookup error:', docErr.message)
      }
      if (shortDoc?.id) {
        resolvedDoctorId = shortDoc.id
      } else {
        return NextResponse.json(
          { error: 'Invalid doctor identifier. Use a valid short code or UUID.' },
          { status: 400 }
        )
      }
    }



    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, role')
      .in('id', [resolvedPatientId, resolvedDoctorId])

    if (profilesError) {
      return NextResponse.json({ error: 'Failed to verify report participants' }, { status: 500 })
    }
    if (!profiles?.some((profile) => profile.id === resolvedPatientId && profile.role === 'patient') ||
        !profiles.some((profile) => profile.id === resolvedDoctorId && profile.role === 'doctor')) {
      return NextResponse.json({ error: 'Patient or doctor was not found' }, { status: 400 })
    }

    const { data: assignment, error: assignmentError } = await supabase
      .from('doctor_patient_assignments')
      .select('id')
      .eq('doctor_id', resolvedDoctorId)
      .eq('patient_id', resolvedPatientId)
      .eq('is_active', true)
      .maybeSingle()

    if (assignmentError) {
      return NextResponse.json({ error: 'Failed to verify patient assignment' }, { status: 500 })
    }
    if (!assignment) {
      return forbiddenResponse()
    }

    // Create a simple record with minimal data
    const simpleRecord = {
      patient_id: resolvedPatientId,
      doctor_id: resolvedDoctorId,
      test_type: testType,
      original_name: originalName,
      file_name: fileName,
      priority: priority || 'normal',
      notes: notes || '',
      uploaded_by: user.id,
      uploaded_at: new Date().toISOString(),
      status: 'uploaded'
    }

    // Try to insert into reports table
    let reportId = null
    try {
      const { data: reportData, error: dbError } = await supabase
        .from('reports')
        .insert(simpleRecord)
        .select('id')
        .single()

      if (dbError) {
        console.error('[simple-upload] DB insert failed:', dbError.message)
        return NextResponse.json({ error: 'Failed to create report' }, { status: 500 })
      } else {
        reportId = reportData.id
        
        // Audit log creation
        await supabase.from('audit_logs').insert({
          actor_id: user.id,
          patient_id: resolvedPatientId,
          action: 'create',
          resource_type: 'reports',
          resource_id: reportId,
          details: { file_name: fileName, test_type: testType }
        })
      }
    } catch (dbError) {
      console.error('[simple-upload] DB insert failed:', dbError)
      return NextResponse.json({ error: 'Failed to create report' }, { status: 500 })
    }

    // Return success only after a persisted report has been created.
    return NextResponse.json({
      success: true,
      reportId: reportId,
      fileName: fileName,
      message: reportId ? 'Report uploaded successfully' : 'File uploaded, database record may be incomplete'
    })

  } catch (error: any) {
    console.error('[simple-upload] Error:', error)
    return NextResponse.json(
      { error: 'Upload failed', details: error.message },
      { status: 500 }
    )
  }
}
