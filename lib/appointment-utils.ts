// Utility functions for handling appointments with demo data support
import { createClient } from '@/lib/supabase'
import { UUID_REGEX } from '@/lib/constants'

export interface AppointmentUpdateData {
  status?: string
  notes?: string
  diagnosis?: string
  prescription?: string
  completed_at?: string
}

export interface AppointmentUpdateResult {
  success: boolean
  message: string
  is_demo: boolean
  error?: string
}

/**
 * Safely update an appointment, handling both demo and real appointments
 */
export async function updateAppointment(
  appointmentId: string, 
  updateData: AppointmentUpdateData
): Promise<AppointmentUpdateResult> {
  // Check if this is a demo appointment
  if (appointmentId.startsWith('demo-')) {
    return {
      success: true,
      message: 'Demo appointment updated successfully (local only)',
      is_demo: true
    }
  }

  const supabase = createClient()
  
  try {
    // Use the safe update function from the database
    const { data, error } = await supabase
      .rpc('safe_appointment_update', {
        appointment_id: appointmentId,
        update_data: updateData
      })

    if (error) {
      console.error('Error updating appointment:', error)
      return {
        success: false,
        message: 'Failed to update appointment',
        is_demo: false,
        error: error.message
      }
    }

    return data as AppointmentUpdateResult
  } catch (error) {
    console.error('Error in appointment update:', error)
    return {
      success: false,
      message: 'An unexpected error occurred',
      is_demo: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Check if an ID is a valid UUID format
 */
export function isValidUUID(id: string): boolean {
  return UUID_REGEX.test(id)
}

/**
 * Check if an appointment ID represents demo data
 */
export function isDemoAppointment(appointmentId: string): boolean {
  return appointmentId.startsWith('demo-') || !isValidUUID(appointmentId)
}

/**
 * Resolve a patient ID (Short ID or UUID) to a proper UUID
 */
export async function resolvePatientId(patientId: string): Promise<string | null> {
  if (isValidUUID(patientId)) {
    return patientId
  }

  const supabase = createClient()
  
  try {
    const { data } = await supabase
      .rpc('resolve_patient_id', { input_id: patientId })

    return data || null
  } catch (error) {
    console.error('Error resolving patient ID:', error)
    return null
  }
}

/**
 * Resolve a doctor ID (Short ID or UUID) to a proper UUID
 */
export async function resolveDoctorId(doctorId: string): Promise<string | null> {
  if (isValidUUID(doctorId)) {
    return doctorId
  }

  const supabase = createClient()
  
  try {
    const { data } = await supabase
      .rpc('resolve_doctor_id', { input_id: doctorId })

    return data || null
  } catch (error) {
    console.error('Error resolving doctor ID:', error)
    return null
  }
}
