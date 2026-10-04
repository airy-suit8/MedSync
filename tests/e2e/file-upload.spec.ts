import { expect, test, type Page } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const password = 'MedSync-Upload-2026!'

async function createAccount(admin: SupabaseClient, email: string, role: 'patient' | 'doctor' | 'lab', name: string) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role },
    user_metadata: { name, role },
  })
  if (error || !data.user) throw new Error(`Could not create ${role} upload fixture: ${error?.message}`)
  return { id: data.user.id, email, role }
}

async function login(page: Page, email: string, role: string) {
  await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 90_000 })
  await expect(page.getByTestId('login-form')).toHaveAttribute('data-hydrated', 'true', { timeout: 20_000 })
  await page.locator('#email').fill(email)
  await page.locator('#password').fill(password)
  await page.getByRole('button', { name: /INITIATE SESSION/ }).click()
  await expect(page).toHaveURL(new RegExp(`/${role}-dashboard/?$`), { timeout: 20_000 })
}

test('file upload adversarial cells reach local Storage and record actual acceptance/rejection', async ({ page }) => {
  test.setTimeout(180_000)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  test.skip(!supabaseUrl || !serviceRoleKey, 'local Supabase service role credentials are required for fixture cleanup')
  const admin = createClient(supabaseUrl!, serviceRoleKey!, { auth: { autoRefreshToken: false, persistSession: false } })
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const patientEmail = `upload-${runId}-patient@example.com`
  const doctorEmail = `upload-${runId}-doctor@example.com`
  const labEmail = `upload-${runId}-lab@example.com`
  const originalNames = [
    `empty-${runId}.pdf`,
    `no-extension-${runId}`,
    `double-${runId}.pdf.exe`,
    `oversized-${runId}.pdf`,
    `corrupt-${runId}.pdf`,
  ]
  const files = [
    { name: originalNames[0], mimeType: 'application/pdf', buffer: Buffer.alloc(0) },
    { name: originalNames[1], mimeType: 'application/octet-stream', buffer: Buffer.from('x') },
    { name: originalNames[2], mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%%EOF') },
    { name: originalNames[3], mimeType: 'application/pdf', buffer: Buffer.alloc(10 * 1024 * 1024 + 1, 65) },
    { name: originalNames[4], mimeType: 'application/pdf', buffer: Buffer.from('this is not a PDF') },
  ]
  const accepted: string[] = []
  let patient: Awaited<ReturnType<typeof createAccount>> | undefined
  let doctor: Awaited<ReturnType<typeof createAccount>> | undefined
  let lab: Awaited<ReturnType<typeof createAccount>> | undefined
  const existingStorage = new Set<string>()
  try {
    const { data: before } = await admin.storage.from('reports').list('', { limit: 1000 })
    for (const file of before || []) existingStorage.add(file.name)
    patient = await createAccount(admin, patientEmail, 'patient', `Upload Patient ${runId.slice(-5)}`)
    doctor = await createAccount(admin, doctorEmail, 'doctor', `Upload Doctor ${runId.slice(-5)}`)
    lab = await createAccount(admin, labEmail, 'lab', `Upload Lab ${runId.slice(-5)}`)

    await login(page, labEmail, 'lab')
    for (const file of files) {
      await page.goto('/lab-dashboard/upload', { waitUntil: 'domcontentloaded', timeout: 90_000 })
      const input = page.locator('input[type="file"]')
      await expect(input).toBeVisible({ timeout: 30_000 })
      await page.getByPlaceholder('ENTER SHORT ID / UUID').fill(patient.id)
      await expect(page.getByText(/NODE:/)).toBeVisible({ timeout: 10_000 })
      await page.getByPlaceholder('ENTER DOCTOR ID').fill(doctor.id)
      await page.locator('select').first().selectOption('blood_test')
      await page.locator('#mlEnabled').uncheck()
      await input.setInputFiles(file)
      await page.getByRole('button', { name: /Synchronize Payload/i }).click()
      await expect(page.getByRole('button', { name: /Synchronize Payload/i })).toBeEnabled({ timeout: 30_000 })

      const { data: reports } = await admin.from('reports').select('id,file_name').eq('uploaded_by', lab.id).eq('original_name', file.name)
      if (reports?.length) accepted.push(file.name)
      if (reports?.length) {
        await admin.from('reports').delete().in('id', reports.map((report) => report.id))
        await admin.storage.from('reports').remove(reports.map((report) => report.file_name))
      }
    }

    // Every edge file should be rejected by the upload flow. Keep the observed
    // accepted filenames in the failing assertion so the matrix records which
    // cells the live local stack allowed.
    expect(accepted, 'unsafe file cells accepted by the live upload flow').toEqual([])
  } finally {
    if (lab) await admin.from('reports').delete().eq('uploaded_by', lab.id)
    const { data: after } = await admin.storage.from('reports').list('', { limit: 1000 })
    const createdObjects = (after || []).filter((file) => !existingStorage.has(file.name)).map((file) => file.name)
    if (createdObjects.length) await admin.storage.from('reports').remove(createdObjects)
    for (const account of [patient, doctor, lab]) {
      if (account) await admin.auth.admin.deleteUser(account.id)
    }
  }
})
