import { beforeEach, describe, expect, it, vi } from 'vitest'

const { cookieGetAll, cookieSet, getUser, createServerClient } = vi.hoisted(() => ({
  cookieGetAll: vi.fn(() => [{ name: 'sb-token', value: 'token' }]), cookieSet: vi.fn(), getUser: vi.fn(), createServerClient: vi.fn(),
}))
vi.mock('next/headers', () => ({ cookies: async () => ({ getAll: cookieGetAll, set: cookieSet }) }))
vi.mock('@supabase/ssr', () => ({ createServerClient }))
import { unauthorizedResponse, verifySession } from '@/lib/api-utils'

describe('server API session helpers', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-only-placeholder'
    getUser.mockReset()
    createServerClient.mockReset().mockReturnValue({ auth: { getUser } })
  })
  it('returns an authenticated user and server client', async () => {
    const user = { id: 'u1' }
    getUser.mockResolvedValue({ data: { user }, error: null })
    const result = await verifySession()
    expect(result.user).toEqual(user)
    expect(result.error).toBeNull()
    expect(createServerClient).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.objectContaining({ cookies: expect.any(Object) }))
  })
  it('returns no user for expired sessions', async () => {
    const error = new Error('expired')
    getUser.mockResolvedValue({ data: { user: null }, error })
    await expect(verifySession()).resolves.toMatchObject({ user: null, error })
  })
  it('creates a JSON 401 response', async () => {
    const response = unauthorizedResponse()
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized. Please sign in to access this resource.' })
  })
})
