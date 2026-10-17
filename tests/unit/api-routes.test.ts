import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const { verifySession } = vi.hoisted(() => ({ verifySession: vi.fn() }))
vi.mock('@/lib/api-utils', () => ({
  verifySession,
  unauthorizedResponse: () => NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
  forbiddenResponse: () => NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
  hasRole: (user: { app_metadata?: Record<string, unknown> }, role: string) => user.app_metadata?.role === role,
}))
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }))

import { POST as chatPost } from '@/app/api/chat/route'
import { POST as mlProcessPost } from '@/app/api/ml-process/route'
import { GET as signedUrlGet } from '@/app/api/file/signed-url/route'

function post(body: unknown) {
  return new NextRequest('http://localhost/api/test', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
}

// Service-role client stand-in: each table answers with a fixed result.
function serviceClient(tables: Record<string, unknown>) {
  const builder = (result: unknown): any => new Proxy({}, {
    get: (_t, prop) => prop === 'then' ? (resolve: (v: unknown) => void) => resolve(result)
      : prop === 'maybeSingle' || prop === 'single' ? async () => result
      : () => builder(result),
  })
  return { from: (table: string) => builder(tables[table] ?? { data: null }) } as any
}

const reportId = '123e4567-e89b-12d3-a456-426614174000'

describe('API authentication boundary', () => {
  beforeEach(() => {
    verifySession.mockReset().mockResolvedValue({ user: null })
    vi.mocked(createClient).mockClear()
  })
  it.each([
    ['chat', () => chatPost(post({ prompt: 'hello', provider: 'invalid' }))],
    ['ML processing', () => mlProcessPost(post({ reportId }))],
    ['signed file URL', () => signedUrlGet(new NextRequest('http://localhost/api/file/signed-url?path=x'))],
  ])('rejects unauthenticated %s requests', async (_name, invoke) => {
    const response = await invoke()
    expect(response.status).toBe(401)
  })

  it('refuses patients before touching the service-role client', async () => {
    verifySession.mockResolvedValue({ user: { id: 'patient-1', app_metadata: { role: 'patient' } } })
    const response = await mlProcessPost(post({ reportId }))
    expect(response.status).toBe(403)
    expect(createClient).not.toHaveBeenCalled()
  })
})

describe('report processing authorisation', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only-placeholder'
  })
  const report = { data: { id: reportId, patient_id: 'p1', doctor_id: 'd1', uploaded_by: 'lab-1', test_type: 'x_ray', file_name: 'f.png', original_name: 'f.png', ai_status: 'pending', updated_at: null } }

  it('refuses labs the team has not verified', async () => {
    verifySession.mockResolvedValue({ user: { id: 'lab-1', app_metadata: { role: 'lab' } } })
    vi.mocked(createClient).mockReturnValueOnce(serviceClient({ reports: report, profiles: { data: { verified: false } } }))
    expect((await mlProcessPost(post({ reportId }))).status).toBe(403)
  })

  it("refuses a lab processing another lab's report", async () => {
    verifySession.mockResolvedValue({ user: { id: 'lab-2', app_metadata: { role: 'lab' } } })
    vi.mocked(createClient).mockReturnValueOnce(serviceClient({ reports: report, profiles: { data: { verified: true } } }))
    expect((await mlProcessPost(post({ reportId }))).status).toBe(403)
  })

  it('refuses a doctor who is not treating the patient', async () => {
    verifySession.mockResolvedValue({ user: { id: 'd9', app_metadata: { role: 'doctor' } } })
    vi.mocked(createClient).mockReturnValueOnce(serviceClient({ reports: report, profiles: { data: { verified: true } }, doctor_patient_assignments: { data: [] } }))
    expect((await mlProcessPost(post({ reportId }))).status).toBe(403)
  })

  it('reports no AI for tests without one (and does not start a run)', async () => {
    verifySession.mockResolvedValue({ user: { id: 'lab-1', app_metadata: { role: 'lab' } } })
    vi.mocked(createClient).mockReturnValueOnce(serviceClient({
      reports: { data: { ...report.data, test_type: 'ecg', ai_status: 'not_applicable' } },
      profiles: { data: { verified: true, name: 'P' } },
    }))
    const response = await mlProcessPost(post({ reportId }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'not_applicable' })
  })
})
describe('chat API validation', () => {
  beforeEach(() => verifySession.mockResolvedValue({ user: { id: 'test-user' } }))
  it('rejects missing, non-string, oversized prompts and invalid providers', async () => {
    for (const body of [{}, { prompt: 42 }, { prompt: 'x'.repeat(4001) }, { prompt: 'hi', provider: 'other' }]) {
      const response = await chatPost(post(body))
      expect(response.status).toBe(400)
    }
  })
  it('accepts adversarial strings through parsing without executing or calling remote providers', async () => {
    const prompt = '<script>alert(1)</script> \' OR \'1\'=\'1'
    const response = await chatPost(post({ prompt, provider: 'missing-provider' }))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Invalid provider' })
  })
})

describe('ML route request shape', () => {
  beforeEach(() => {
    verifySession.mockResolvedValue({ user: { id: 'test-user', app_metadata: { role: 'lab' } } })
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only-placeholder'
  })
  it('rejects a malformed report ID before any database call', async () => {
    vi.mocked(createClient).mockClear()
    const response = await mlProcessPost(post({ reportId: 'bad' }))
    expect(response.status).toBe(400)
    expect(createClient).not.toHaveBeenCalled()
  })
})
