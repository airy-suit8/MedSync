import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createClientMock } = vi.hoisted(() => ({ createClientMock: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ createClient: createClientMock }))
import { createAuthClient, createAuthenticatedClient, testDatabaseConnection } from '@/lib/supabase-auth'

describe('Supabase auth helpers', () => {
  beforeEach(() => createClientMock.mockReset())
  it('keeps createAuthClient as the createClient alias', () => expect(createAuthClient).toBe(createClientMock))
  it('returns a client with a session', async () => {
    const client = { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'x' } }, error: null }) } }
    createClientMock.mockReturnValue(client)
    await expect(createAuthenticatedClient()).resolves.toBe(client)
  })
  it.each([
    [{ data: { session: null }, error: null }, 'No active session. Please log in again.'],
    [{ data: { session: null }, error: new Error('auth') }, 'Authentication failed'],
  ])('throws for missing or failed session', async (result, message) => {
    createClientMock.mockReturnValue({ auth: { getSession: vi.fn().mockResolvedValue(result) } })
    await expect(createAuthenticatedClient()).rejects.toThrow(message)
  })
  it('checks the reports endpoint and reports success', async () => {
    const client = { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: {} }, error: null }) }, from: () => ({ select: () => ({ limit: async () => ({ data: [{ count: 2 }], error: null }) }) }) }
    createClientMock.mockReturnValue(client)
    await expect(testDatabaseConnection()).resolves.toEqual({ success: true, data: [{ count: 2 }] })
  })
  it('returns database errors and authentication failures as results', async () => {
    const client = { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: {} }, error: null }) }, from: () => ({ select: () => ({ limit: async () => ({ data: null, error: { message: 'denied' } }) }) }) }
    createClientMock.mockReturnValue(client)
    await expect(testDatabaseConnection()).resolves.toEqual({ success: false, error: 'denied' })
    createClientMock.mockReturnValue({ auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }) } })
    await expect(testDatabaseConnection()).resolves.toEqual({ success: false, error: 'No active session. Please log in again.' })
  })
})
