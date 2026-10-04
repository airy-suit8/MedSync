import { expect, test, type BrowserContext } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

test('landing and unauthenticated primary flows render at desktop and mobile sizes', async ({ page }) => {
  const response = await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 90_000 })
  expect(response?.status()).toBeLessThan(400)
  await expect(page.locator('body')).not.toBeEmpty()
  for (const route of ['/login', '/signup', '/reset-password']) {
    const result = await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 90_000 })
    expect(result?.status(), `route ${route}`).toBeLessThan(400)
    await expect(page.locator('body')).not.toBeEmpty()
  }
})

test('unknown paths render the app not-found page rather than a server error', async ({ page }) => {
  const response = await page.goto('/testing-route-that-does-not-exist', { waitUntil: 'domcontentloaded', timeout: 90_000 })
  expect(response?.status()).toBe(404)
  await expect(page.locator('body')).not.toBeEmpty()
})

test('signup text fields safely retain adversarial and international text without executing it', async ({ page }) => {
  await page.goto('/signup', { waitUntil: 'domcontentloaded', timeout: 90_000 })
  let dialogOpened = false
  page.on('dialog', async (dialog) => { dialogOpened = true; await dialog.dismiss() })
  const name = page.locator('input[type="text"]').first()
  const cases = ['Ada Patient', '   ', '患者 🩺', 'مرحبا', '<script>alert(1)</script>', "' OR '1'='1", 'x'.repeat(500)]
  for (const value of cases) {
    await name.fill(value)
    await expect(name).toHaveValue(value)
  }
  expect(dialogOpened).toBe(false)
})

test('signup email control marks malformed and whitespace values invalid', async ({ page }) => {
  await page.goto('/signup', { waitUntil: 'domcontentloaded', timeout: 90_000 })
  const email = page.locator('input[type="email"]').first()
  for (const value of ['bad-address', 'a b@example.com', '']) {
    await email.fill(value)
    expect(await email.evaluate((node: HTMLInputElement) => node.checkValidity())).toBe(false)
  }
})

test('auth input matrix executes adversarial values across login, signup, and password reset fields', async ({ page }) => {
  const textCases = ['', '   ', '患者 🩺', 'مرحبا', '<script>alert(1)</script>', '<img src=x onerror=alert(1)>', "' OR '1'='1", "; DROP TABLE reports; --", '\u0000', '\u0001\u001f', 'x'.repeat(254), 'x'.repeat(255)]
  const passwordCases = ['', '        ', '🩺🔒🔑', 'مرحبا🔒', '<script>alert(1)</script>', "' OR '1'='1", '\u0000', '\u0001\u001f', 'P'.repeat(1024)]
  const fillAndObserve = async (input: ReturnType<typeof page.locator>, value: string) => {
    // Record the browser's actual value; invalid email values are separately
    // checked through the native constraint validation API.
    await input.fill(value)
    const observed = await input.inputValue()
    return observed
  }
  let dialogOpened = false
  page.on('dialog', async (dialog) => { dialogOpened = true; await dialog.dismiss() })

  await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 90_000 })
  await expect(page.getByTestId('login-form')).toBeVisible()
  const loginEmail = page.locator('#email')
  const loginPassword = page.locator('#password')
  await expect(loginEmail).toHaveAttribute('maxlength', '254')
  for (const value of textCases) {
    const observed = await fillAndObserve(loginEmail, value)
    expect(await loginEmail.evaluate((input: HTMLInputElement) => input.checkValidity())).toBe(false)
  }
  for (const value of passwordCases) {
    await fillAndObserve(loginPassword, value)
  }
  await page.getByRole('button', { name: /Reset Key/ }).click()
  const resetEmail = page.locator('input[type="email"]').last()
  await expect(resetEmail).toHaveAttribute('maxlength', '254')
  for (const value of textCases) {
    await fillAndObserve(resetEmail, value)
    expect(await resetEmail.evaluate((input: HTMLInputElement) => input.checkValidity())).toBe(false)
  }

  await page.goto('/signup', { waitUntil: 'domcontentloaded', timeout: 90_000 })
  await expect(page.getByTestId('signup-form')).toBeVisible()
  const signupName = page.locator('#name')
  const signupEmail = page.locator('#email')
  const signupPassword = page.locator('#password')
  await expect(signupEmail).toHaveAttribute('maxlength', '254')
  for (const value of textCases) {
    await fillAndObserve(signupName, value)
  }
  for (const value of ['bad-address', 'a b@example.com', '', 'unicode💊@example.com', "' OR '1'='1@example.com"]) {
    await fillAndObserve(signupEmail, value)
    expect(await signupEmail.evaluate((input: HTMLInputElement) => input.checkValidity())).toBe(false)
  }
  await signupEmail.fill(`${'a'.repeat(245)}@example.com`)
  expect(await signupEmail.evaluate((input: HTMLInputElement) => input.checkValidity())).toBe(false)
  await signupEmail.fill(`${'a'.repeat(240)}@x.co`)
  expect(await signupEmail.evaluate((input: HTMLInputElement) => input.checkValidity())).toBe(true)
  for (const value of passwordCases) {
    await fillAndObserve(signupPassword, value)
  }

  await page.goto('/reset-password', { waitUntil: 'domcontentloaded', timeout: 90_000 })
  await expect(page.getByTestId('reset-password-form')).toHaveAttribute('data-hydrated', 'true', { timeout: 30_000 })
  for (const selector of ['#password', '#confirmPassword']) {
    const input = page.locator(selector)
    for (const value of passwordCases) {
      await fillAndObserve(input, value)
    }
  }
  await page.locator('#password').fill('Valid-Strong-Password-1!')
  await page.locator('#confirmPassword').fill('Valid-Strong-Password-2!')
  await page.getByRole('button', { name: /UPDATE PASSWORD/i }).click()
  await expect(page.getByText(/Passwords do not match/i)).toBeVisible()
  expect(dialogOpened).toBe(false)
})

test('signup, login, and dashboard access work for each local role', async ({ browser }) => {
  test.setTimeout(180_000)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  test.skip(!supabaseUrl || !serviceRoleKey, 'local Supabase admin credentials are required for account cleanup')
  const admin = createClient(supabaseUrl!, serviceRoleKey!, { auth: { autoRefreshToken: false, persistSession: false } })
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const createdEmails: string[] = []
  const contexts: BrowserContext[] = []
  try {
    for (const role of ['patient', 'doctor', 'lab'] as const) {
      const context = await browser.newContext()
      contexts.push(context)
      const page = await context.newPage()
      const browserFailures: string[] = []
      page.on('pageerror', (error) => browserFailures.push(`pageerror: ${error.message}`))
      page.on('console', (message) => { if (message.type() === 'error') browserFailures.push(`console: ${message.text()}`) })
      page.on('requestfailed', (request) => browserFailures.push(`request: ${request.url()} ${request.failure()?.errorText || ''}`))
      page.setDefaultTimeout(5_000)
      const email = `medsync-${runId}-${role}@example.com`
      const password = 'MedSync-Test-2026!'
      createdEmails.push(email)
      await page.goto('/signup', { waitUntil: 'domcontentloaded', timeout: 90_000 })
      await expect(page.getByTestId('signup-form')).toHaveAttribute('data-hydrated', 'true', { timeout: 30_000 })
      await page.locator('#name').fill(`Test ${role}`)
      await page.locator('#email').fill(email)
      await page.locator('#password').fill(password)
      await expect(page.locator('#name')).toHaveValue(`Test ${role}`)
      await expect(page.locator('#email')).toHaveValue(email)
      const roleTrigger = page.getByTestId('signup-role-trigger')
      await roleTrigger.scrollIntoViewIfNeeded()
      const roleLabel = role === 'patient' ? 'Patient' : role === 'doctor' ? 'Doctor' : 'Lab Technician'
      await roleTrigger.selectOption(role)
      await expect(roleTrigger).toHaveValue(role)
      await expect(roleTrigger).toContainText(roleLabel)
      await expect(page.locator('#name')).toHaveValue(`Test ${role}`)
      await expect(page.locator('#email')).toHaveValue(email)
      await expect(page.locator('#password')).toHaveValue(password)
      await page.getByRole('button', { name: /CREATE ACCOUNT/ }).click()
      try {
        await expect(page.getByText('Account Created!')).toBeVisible({ timeout: 20_000 })
      } catch (cause) {
        throw new Error(`Signup did not complete for ${role}; hydrated=${await page.getByTestId('signup-form').getAttribute('data-hydrated')}; role=${await roleTrigger.inputValue().catch(() => 'n/a')}; body=${(await page.locator('body').innerText().catch(() => '')).slice(0, 1000)}; browser=${browserFailures.join(' | ')}; cause=${String(cause)}`)
      }

      await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 90_000 })
      await expect(page.getByTestId('login-form')).toBeVisible()
      await page.locator('#email').fill(email)
      await page.locator('#password').fill(password)
      const signInResponsePromise = page.waitForResponse((response) => response.url().includes('/auth/v1/token?grant_type=password'), { timeout: 15_000 })
      const userResponses: string[] = []
      page.on('response', async (response) => {
        if (response.url().endsWith('/auth/v1/user')) userResponses.push(`${response.status()} ${await response.text().catch(() => '')}`)
      })
      await page.getByRole('button', { name: /INITIATE SESSION/ }).click()
      const signInResponse = await signInResponsePromise
      if (!signInResponse.ok()) throw new Error(`Login failed (${signInResponse.status()}): ${await signInResponse.text()}`)
      try {
        await expect(page).toHaveURL(new RegExp(`/${role}-dashboard/?$`), { timeout: 20_000 })
      } catch (cause) {
        const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
        const createdUser = data.users.find((candidate) => candidate.email === email)
        throw new Error(`Dashboard entry failed for ${role}; user=${JSON.stringify({ app: createdUser?.app_metadata, metadata: createdUser?.user_metadata })}; userEndpoints=${userResponses.join(' | ')}; url=${page.url()}; body=${(await page.locator('body').innerText().catch(() => '')).slice(0, 1000)}; cause=${String(cause)}`)
      }
      await expect(page.locator('body')).not.toBeEmpty()

      if (role === 'lab') {
        const { data: { users } } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
        const patient = users.find((candidate) => candidate.email === `medsync-${runId}-patient@example.com`)
        const doctor = users.find((candidate) => candidate.email === `medsync-${runId}-doctor@example.com`)
        const lab = users.find((candidate) => candidate.email === email)
        expect(patient && doctor && lab).toBeTruthy()

        await page.goto('/lab-dashboard/upload', { waitUntil: 'domcontentloaded', timeout: 90_000 })
        const fileInput = page.locator('input[type="file"]')
        await expect(fileInput).toBeVisible({ timeout: 30_000 })
        const adversarialFiles = [
          { name: 'empty.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(0) },
          { name: 'no-extension', mimeType: 'application/octet-stream', buffer: Buffer.from('x') },
          { name: 'double.pdf.exe', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%%EOF') },
          { name: 'oversized.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(10 * 1024 * 1024 + 1, 65) },
          { name: 'corrupt.pdf', mimeType: 'application/pdf', buffer: Buffer.from('not a PDF') },
        ]
        for (const candidate of adversarialFiles) {
          await fileInput.setInputFiles(candidate)
          expect(await fileInput.evaluate((input: HTMLInputElement) => input.files?.[0]?.name)).toBe(candidate.name)
          expect(await fileInput.evaluate((input: HTMLInputElement) => input.files?.[0]?.size)).toBe(candidate.buffer.length)
        }

        const reportName = `e2e-${runId}.pdf`
        await page.getByPlaceholder('ENTER SHORT ID / UUID').fill(patient!.id)
        await expect(page.getByText(/NODE:/)).toBeVisible({ timeout: 10_000 })
        await page.getByPlaceholder('ENTER DOCTOR ID').fill(doctor!.id)
        await page.getByRole('combobox').first().selectOption('blood_test')
        await page.locator('#mlEnabled').uncheck()
        await fileInput.setInputFiles({ name: reportName, mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\nMedSync local upload test\n%%EOF') })
        await page.getByRole('button', { name: /UPLOAD|SYNCHRONIZE|SUBMIT/i }).click()
        await expect(page.getByText('Uplink Successful')).toBeVisible({ timeout: 30_000 })

        const { data: uploadedReports } = await admin.from('reports').select('id,file_name').eq('uploaded_by', lab!.id).eq('original_name', reportName)
        if (uploadedReports?.length) {
          await admin.storage.from('reports').remove(uploadedReports.map((report) => report.file_name))
          await admin.from('reports').delete().in('id', uploadedReports.map((report) => report.id))
        }
      }
    }
  } finally {
    const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    for (const email of createdEmails) {
      const user = data.users.find((candidate) => candidate.email === email)
      if (user) await admin.auth.admin.deleteUser(user.id)
    }
    await Promise.all(contexts.map((context) => context.close()))
  }
})
