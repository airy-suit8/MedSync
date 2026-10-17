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

    // The service role skips RLS, so check here that the team has verified this lab.
    const { data: lab } = await supabase.from('profiles').select('verified').eq('id', user.id).maybeSingle()
    if (!lab?.verified) {
      return forbiddenResponse()
    }

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

    // Resolve patientId: allow short_id or UUID
    let resolvedPatientId = patientId
    if (!UUID_REGEX.test(patientId)) {
      const { data: shortMatch, error: shortErr } = await supabase
        .from('profiles')
        .select('id')
        .ilike('short_id', patientId)
        .maybeSingle()

      if (shortErr) {
        console.warn('[lab-upload] Short ID lookup error:', shortErr.message)
      }
      if (!shortMatch) {
        return NextResponse.json(
          { error: 'Invalid patient identifier. Use a valid short code or UUID.' },
          { status: 400 }
        )
      }
      resolvedPatientId = shortMatch.id
    }

    // Resolve doctorId: allow short_id or UUID
    let resolvedDoctorId = doctorId
    if (!UUID_REGEX.test(doctorId)) {
      const { data: shortDoc, error: docErr } = await supabase
        .from('profiles')
        .select('id')
        .ilike('short_id', doctorId)
        .maybeSingle()

      if (docErr) {
        console.warn('[lab-upload] Doctor Short ID lookup error:', docErr.message)
      }
      if (!shortDoc) {
        return NextResponse.json(
          { error: 'Invalid doctor identifier. Use a valid short code or UUID.' },
          { status: 400 }
        )
      }
      resolvedDoctorId = shortDoc.id
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

    // Bind report attribution to the authenticated lab account.
    const { data: reportData, error: dbError } = await supabase
      .from('reports')
      .insert({
        patient_id: resolvedPatientId,
        doctor_id: resolvedDoctorId,
        test_type: testType,
        original_name: originalName,
        file_name: fileName,
        priority: priority || 'normal',
        notes: notes || '',
        uploaded_by: user.id,
        patient_info: patientInfo || {}
      })
      .select('id')
      .single()

    if (dbError) {
      console.error('[lab-upload] Database insert error:', dbError)
      return NextResponse.json(
        { error: 'Failed to create report', details: dbError.message },
        { status: 500 }
      )
    }

    // Audit log creation
    await supabase.from('audit_logs').insert({
      actor_id: user.id,
      patient_id: resolvedPatientId,
      action: 'create',
      resource_type: 'reports',
      resource_id: reportData.id,
      details: { file_name: fileName, test_type: testType }
    })

    // Create notification for doctors
    try {
      await supabase
        .from('notifications')
        .insert({
          notification_type: 'new_report',
          title: 'New Lab Report Available',
          message: `A new ${testType} report has been uploaded for Patient ID: ${patientId}`,
          target_role: 'doctor',
          data: {
            patient_id: patientId,
            test_type: testType,
            file_name: originalName,
            priority: priority || 'normal',
            report_id: reportData.id
          }
        })

    } catch (notificationError) {
      console.warn('[lab-upload] Notification creation failed:', notificationError)
      // Continue even if notification fails
    }

    // Return success response
    return NextResponse.json({
      success: true,
      reportId: reportData.id,
      message: 'Report uploaded successfully'
    })

  } catch (error: any) {
    console.error('[lab-upload] Server-side upload error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
