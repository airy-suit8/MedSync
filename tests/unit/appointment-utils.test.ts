import { beforeEach, describe, expect, it, vi } from 'vitest'

const { rpc, createClientMock } = vi.hoisted(() => ({ rpc: vi.fn(), createClientMock: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ createClient: createClientMock }))
import { isValidUUID, updateAppointment } from '@/lib/appointment-utils'

describe('appointment utilities with mocked Supabase RPCs', () => {
  beforeEach(() => createClientMock.mockReset().mockReturnValue({ rpc }))
  it('updates demo appointment locally without a client call', async () => {
    await expect(updateAppointment('demo-1', { status: 'done' })).resolves.toMatchObject({ success: true, is_demo: true })
    expect(createClientMock).not.toHaveBeenCalled()
  })
  it('returns real update result and RPC error', async () => {
    rpc.mockResolvedValueOnce({ data: { success: true, message: 'ok', is_demo: false }, error: null })
    await expect(updateAppointment('123e4567-e89b-12d3-a456-426614174000', { status: 'done' })).resolves.toMatchObject({ success: true })
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'denied' } })
    await expect(updateAppointment('123e4567-e89b-12d3-a456-426614174000', {})).resolves.toMatchObject({ success: false, error: 'denied' })
  })
  it('rejects malformed IDs', () => {
    expect(isValidUUID('x')).toBe(false)
  })
})
