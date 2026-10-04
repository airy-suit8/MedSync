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
import { POST as labUploadPost } from '@/app/api/lab-upload/route'
import { POST as simpleUploadPost } from '@/app/api/simple-upload/route'
import { POST as mlProcessPost } from '@/app/api/ml-process/route'
import { GET as signedUrlGet } from '@/app/api/file/signed-url/route'

function post(body: unknown) {
  return new NextRequest('http://localhost/api/test', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
}

describe('API authentication boundary', () => {
  beforeEach(() => {
    verifySession.mockReset().mockResolvedValue({ user: null })
    vi.mocked(createClient).mockClear()
  })
  it.each([
    ['chat', () => chatPost(post({ prompt: 'hello', provider: 'invalid' }))],
    ['lab upload', () => labUploadPost(post({}))],
    ['simple upload', () => simpleUploadPost(post({}))],
    ['ML processing', () => mlProcessPost(post({}))],
    ['signed file URL', () => signedUrlGet(new NextRequest('http://localhost/api/file/signed-url?path=x'))],
  ])('rejects unauthenticated %s requests', async (_name, invoke) => {
    const response = await invoke()
    expect(response.status).toBe(401)
  })

  it.each([
    ['lab upload', () => labUploadPost(post({}))],
    ['simple upload', () => simpleUploadPost(post({}))],
    ['ML processing', () => mlProcessPost(post({}))],
  ])('rejects non-lab users from %s service-role operations', async (_name, invoke) => {
    verifySession.mockResolvedValue({ user: { id: 'patient-1', app_metadata: { role: 'patient' } } })
    const response = await invoke()
    expect(response.status).toBe(403)
    expect(createClient).not.toHaveBeenCalled()
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
    process.env.INTERNAL_API_KEY = 'test-only-placeholder'
  })
  it('rejects absent required fields and unexpected test type before making network calls', async () => {
    const response = await mlProcessPost(post({ fileName: 'x', originalName: 'x', patientId: 'p', testType: 'malformed', reportId: 'bad' }))
    expect(response.status).toBe(400)
  })
})
