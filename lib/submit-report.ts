"use client"

import { createClient } from "@/lib/supabase"
import { checkReportFile, contentTypeOf, extensionOf } from "@/lib/upload-validation"

export type LinkedDoctor = { id: string; name: string | null; short_id: string | null; specialty: string | null }

// The patient's current doctors, for the lab's doctor picker (verified labs only).
export async function doctorsOfPatient(patientId: string): Promise<LinkedDoctor[]> {
  const { data, error } = await createClient().rpc("get_patient_doctors_for_lab", { p_patient_id: patientId })
  if (error) throw new Error(error.message)
  return data || []
}

// Uploads a report file for a patient and one of their doctors, then hands it to the
// server, which tells the doctor and (if asked) runs the AI reading in the background.
// Used by the Upload page and by "Send to doctor" on the Imaging page.
export async function submitReport(input: {
  file: File
  patientId: string
  doctorId: string
  testType: string
  priority: string
  notes: string
  runAi: boolean
  labId: string
}): Promise<{ reportId: string; aiStatus: string }> {
  const problem = await checkReportFile(input.file)
  if (problem) throw new Error(problem)

  const supabase = createClient()
  const { data: details, error: detailsError } = await supabase.rpc("get_lab_upload_patient_profile", {
    p_patient_id: input.patientId,
    p_doctor_id: input.doctorId,
  })
  if (detailsError) throw new Error(detailsError.message)
  const patient = Array.isArray(details) ? details[0] : details
  if (!patient) throw new Error("This patient is not currently with that doctor.")

  const fileName = `${Date.now()}-${crypto.randomUUID()}.${extensionOf(input.file.name)}`
  const { error: uploadError } = await supabase.storage
    .from("reports")
    .upload(fileName, input.file, { cacheControl: "3600", upsert: false, contentType: contentTypeOf(input.file) })
  if (uploadError) throw new Error(`The file could not be uploaded: ${uploadError.message}`)

  const { data: report, error: reportError } = await supabase
    .from("reports")
    .insert({
      patient_id: input.patientId,
      doctor_id: input.doctorId,
      test_type: input.testType,
      original_name: input.file.name,
      file_name: fileName,
      priority: input.priority,
      notes: input.notes.trim() || null,
      uploaded_by: input.labId,
      // Shown on the doctor's report page; taken from the patient's own profile.
      patient_info: {
        fullName: patient.name,
        dateOfBirth: patient.date_of_birth,
        gender: patient.gender,
        phoneNumber: patient.phone,
        address: patient.address,
        previousDiagnosis: patient.chronic_conditions,
        ongoingTreatments: patient.current_medications,
        allergies: patient.allergies,
      },
    })
    .select("id")
    .single()
  if (reportError || !report) {
    await supabase.storage.from("reports").remove([fileName])
    throw new Error(`The report could not be saved: ${reportError?.message}`)
  }

  const response = await fetch("/api/ml-process", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reportId: report.id, runAi: input.runAi }),
  })
  const body = await response.json().catch(() => ({}))
  // The report is saved either way; a failed hand-off only means no notification/AI yet,
  // and the doctor can run the AI from the report page.
  return { reportId: report.id, aiStatus: response.ok ? body.status || "running" : "failed" }
}
