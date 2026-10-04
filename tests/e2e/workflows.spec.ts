import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

type Role = 'patient' | 'doctor' | 'lab'
type TestAccount = { id: string; email: string; name: string; role: Role }

const password = 'MedSync-E2E-2026!'

function localAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Local Supabase service role credentials are required for E2E fixture cleanup.')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

async function createAccount(admin: SupabaseClient, runId: string, role: Role): Promise<TestAccount> {
  const email = `workflow-${runId}-${role}@example.com`
  const name = `Workflow ${runId.slice(-6)} ${role}`
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role },
    user_metadata: { name, role },
  })
  if (error || !data.user) throw new Error(`Could not create ${role} fixture: ${error?.message || 'no user returned'}`)
  return { id: data.user.id, email, name, role }
}

async function signIn(page: Page, account: TestAccount) {
  await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 90_000 })
  await expect(page.getByTestId('login-form')).toHaveAttribute('data-hydrated', 'true', { timeout: 20_000 })
  await page.locator('#email').fill(account.email)
  await page.locator('#password').fill(password)
  await page.getByRole('button', { name: /INITIATE SESSION/ }).click()
  await expect(page).toHaveURL(new RegExp(`/${account.role}-dashboard/?$`), { timeout: 60_000 })
}

async function removeAccounts(admin: SupabaseClient, accounts: TestAccount[]) {
  for (const account of accounts) await admin.auth.admin.deleteUser(account.id)
}

test('lab report upload, ML suggestion, doctor review, and patient result visibility', async ({ browser }) => {
  test.setTimeout(180_000)
  const admin = localAdmin()
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const accounts: TestAccount[] = []
  const context = await browser.newContext()
  const page = await context.newPage()
  const originalName = `workflow-${runId}.pdf`
  try {
    const patient = await createAccount(admin, runId, 'patient')
    const doctor = await createAccount(admin, runId, 'doctor')
    const lab = await createAccount(admin, runId, 'lab')
    accounts.push(patient, doctor, lab)

    // Assignment must exist before lab upload due to RLS policy 'reports_lab_insert_serviced_patient'
    const { data: assignment } = await admin.from('doctor_patient_assignments').insert({ doctor_id: doctor.id, patient_id: patient.id, is_active: true }).select('id').single()
    expect(assignment?.id).toBeTruthy()

    await signIn(page, lab)
    await page.goto('/lab-dashboard/upload', { waitUntil: 'domcontentloaded', timeout: 90_000 })
    await page.getByPlaceholder('ENTER SHORT ID / UUID').fill(patient.id)
    await expect(page.getByText(/NODE:/)).toBeVisible({ timeout: 10_000 })
    await page.getByPlaceholder('ENTER DOCTOR ID').fill(doctor.id)
    await page.locator('select').first().selectOption('blood_test')
    await page.locator('input[type="file"]').setInputFiles({
      name: originalName,
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4\nMedSync end-to-end report fixture\n%%EOF'),
    })
    await page.getByRole('button', { name: /UPLOAD|SYNCHRONIZE|SUBMIT/i }).click()
    await expect(page.getByText('Uplink Successful')).toBeVisible({ timeout: 60_000 })

    const { data: report } = await admin.from('reports').select('id,file_name').eq('uploaded_by', lab.id).eq('original_name', originalName).single()
    expect(report?.id).toBeTruthy()
    let { data: suggestion } = await admin.from('ml_suggestions').select('id,status,findings').eq('report_id', report!.id).single()
    expect(suggestion?.findings).toBeTruthy()

    await signIn(page, doctor)
    await page.goto('/doctor-dashboard/reports', { waitUntil: 'domcontentloaded', timeout: 90_000 })
    const reportCard = page.locator('div.border').filter({ hasText: originalName }).first()
    await expect(reportCard).toBeVisible({ timeout: 20_000 })
    await reportCard.getByRole('button', { name: /Approve AI/ }).click()

    // Verify the persisted result, not only the optimistic status shown by the UI.
    const { data: reviewed } = await admin.from('ml_suggestions').select('status,reviewed_by').eq('id', suggestion!.id).single()
    expect(reviewed).toMatchObject({ status: 'accepted', reviewed_by: doctor.id })

    await signIn(page, patient)
    await page.goto('/patient-dashboard/reports', { waitUntil: 'domcontentloaded', timeout: 90_000 })
    const patientReport = page.locator('div').filter({ hasText: originalName }).first()
    await expect(patientReport).toBeVisible({ timeout: 20_000 })
    await patientReport.getByRole('button', { name: /DETAILED BRIEF/i }).click()
    await expect(page.getByText(suggestion!.findings, { exact: false })).toBeVisible({ timeout: 20_000 })
  } finally {
    const { data: reports } = await admin.from('reports').select('id,file_name').eq('original_name', originalName)
    const reportIds = reports?.map((row) => row.id) || []
    const { data: suggestions } = reportIds.length
      ? await admin.from('ml_suggestions').select('id').in('report_id', reportIds)
      : { data: [] as { id: string }[] }
    if (suggestions?.length) {
      await admin.from('audit_logs').delete().in('resource_id', suggestions.map((row) => row.id))
      await admin.from('ml_suggestions').delete().in('id', suggestions.map((row) => row.id))
    }
    if (reportIds.length) {
      await admin.from('doctor_patient_assignments').delete().in('doctor_id', accounts.filter((a) => a.role === 'doctor').map((a) => a.id))
      await admin.from('reports').delete().in('id', reportIds)
    }
    if (reports?.length) await admin.storage.from('reports').remove(reports.map((row) => row.file_name))
    await context.close()
    await removeAccounts(admin, accounts)
  }
})

test('chat message travels between separate patient and doctor browser contexts', async ({ browser }) => {
  test.setTimeout(150_000)
  const admin = localAdmin()
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const accounts: TestAccount[] = []
  const contexts: BrowserContext[] = []
  const message = `e2e chat ${runId}`
  try {
    const patient = await createAccount(admin, runId, 'patient')
    const doctor = await createAccount(admin, runId, 'doctor')
    accounts.push(patient, doctor)
    const patientContext = await browser.newContext()
    const doctorContext = await browser.newContext()
    contexts.push(patientContext, doctorContext)
    const patientPage = await patientContext.newPage()
    const doctorPage = await doctorContext.newPage()
    await signIn(patientPage, patient)
    await signIn(doctorPage, doctor)

    await patientPage.goto('/patient-dashboard/chat', { waitUntil: 'domcontentloaded', timeout: 90_000 })
    await doctorPage.goto('/doctor-dashboard/communication', { waitUntil: 'domcontentloaded', timeout: 90_000 })
    await expect(patientPage.getByPlaceholder('ENTER CLINICAL QUERY...')).toBeVisible({ timeout: 30_000 })
    await expect(doctorPage.getByPlaceholder('ENTER MESSAGE...')).toBeVisible({ timeout: 30_000 })
    await patientPage.getByText(doctor.name, { exact: false }).first().click()
    await doctorPage.getByText(patient.name, { exact: false }).first().click()

    await patientPage.getByPlaceholder('ENTER CLINICAL QUERY...').fill(message)
    await patientPage.getByRole('button', { name: /SEND/ }).click()
    await expect(patientPage.getByText(message, { exact: false })).toBeVisible({ timeout: 20_000 })
    await expect(doctorPage.getByText(message, { exact: false })).toBeVisible({ timeout: 30_000 })
  } finally {
    if (accounts.length) {
      const patient = accounts.find((account) => account.role === 'patient')
      const doctor = accounts.find((account) => account.role === 'doctor')
      if (patient && doctor) await admin.from('messages').delete().or(`and(sender_id.eq.${patient.id},receiver_id.eq.${doctor.id}),and(sender_id.eq.${doctor.id},receiver_id.eq.${patient.id})`)
    }
    for (const context of contexts) {
      await context.close()
    }
    await removeAccounts(admin, accounts)
  }
})

test('doctor and patient join and end the same video consultation from separate contexts', async ({ browser }) => {
  test.setTimeout(180_000)
  const admin = localAdmin()
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const accounts: TestAccount[] = []
  const contexts: BrowserContext[] = []
  let appointmentId: string | undefined
  try {
    const patient = await createAccount(admin, runId, 'patient')
    const doctor = await createAccount(admin, runId, 'doctor')
    accounts.push(patient, doctor)
    const { data: appointment, error } = await admin.from('appointments').insert({
      patient_id: patient.id,
      doctor_id: doctor.id,
      patient_name: patient.name,
      doctor_name: doctor.name,
      appointment_date: new Date().toISOString().slice(0, 10),
      start_time: '23:58:00',
      end_time: '23:59:00',
      appointment_type: 'consultation',
      consultation_type: 'video',
      status: 'scheduled',
      symptoms: `E2E video ${runId}`,
    }).select('id').single()
    if (error || !appointment) throw new Error(`Could not seed video appointment: ${error?.message}`)
    appointmentId = appointment.id

    for (let i = 0; i < 2; i += 1) {
      const context = await browser.newContext()
      contexts.push(context)
      await context.grantPermissions(['camera', 'microphone'])
      await context.addInitScript(() => {
        const fakeTrack = { stop() {}, enabled: true, kind: 'video', readyState: 'live' }
        const fakeStream = { getTracks: () => [fakeTrack], getVideoTracks: () => [fakeTrack], getAudioTracks: () => [fakeTrack] }
        Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: async () => fakeStream } })
      })
    }
    const doctorPage = await contexts[0].newPage()
    const patientPage = await contexts[1].newPage()
    await signIn(doctorPage, doctor)
    await signIn(patientPage, patient)
    await doctorPage.goto('/doctor-dashboard/consultations', { waitUntil: 'domcontentloaded', timeout: 90_000 })
    await patientPage.goto('/patient-dashboard/video-consultations', { waitUntil: 'domcontentloaded', timeout: 90_000 })

    await expect(doctorPage.getByRole('button', { name: /Start Video Call/ })).toBeVisible({ timeout: 30_000 })
    await doctorPage.getByRole('button', { name: /Start Video Call/ }).click()
    const doctorDialog = doctorPage.getByRole('dialog')
    await doctorDialog.getByPlaceholder('DR. NAME').fill(doctor.name)
    await expect(doctorDialog.getByRole('button', { name: /Establish Secure Uplink/ })).toBeEnabled({ timeout: 30_000 })
    await doctorDialog.getByRole('button', { name: /Establish Secure Uplink/ }).click()

    await patientPage.getByRole('button', { name: /Establish Link/ }).click()
    const patientDialog = patientPage.getByRole('dialog')
    await patientDialog.getByPlaceholder('ENTER YOUR FULL NAME').fill(patient.name)
    await expect(patientDialog.getByRole('button', { name: /Establish Secure Uplink/ })).toBeEnabled({ timeout: 30_000 })
    await patientDialog.getByRole('button', { name: /Establish Secure Uplink/ }).click()
    await expect(doctorDialog.getByText(/CONNECTED|ENCRYPTED/)).toBeVisible({ timeout: 30_000 })
    await expect(patientDialog.getByText(/CONNECTED|ENCRYPTED/)).toBeVisible({ timeout: 30_000 })

    await doctorDialog.locator('button').first().click()
    await patientDialog.locator('button').first().click()
    await expect(doctorDialog).toBeHidden()
    await expect(patientDialog).toBeHidden()
  } finally {
    if (appointmentId) {
      await admin.from('video_call_logs').delete().eq('appointment_id', appointmentId)
      await admin.from('consultation_meetings').delete().eq('appointment_id', appointmentId)
      await admin.from('appointments').delete().eq('id', appointmentId)
    }
    for (const context of contexts) {
      await context.close()
    }
    await removeAccounts(admin, accounts)
  }
})
