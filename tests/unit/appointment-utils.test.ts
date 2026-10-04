import { beforeEach, describe, expect, it, vi } from 'vitest'

const { rpc, createClientMock } = vi.hoisted(() => ({ rpc: vi.fn(), createClientMock: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ createClient: createClientMock }))
import { isDemoAppointment, isValidUUID, resolveDoctorId, resolvePatientId, updateAppointment } from '@/lib/appointment-utils'

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
  it('resolves UUIDs without RPC and maps short IDs through the proper RPC', async () => {
    const uuid = '123e4567-e89b-12d3-a456-426614174000'
    await expect(resolvePatientId(uuid)).resolves.toBe(uuid)
    await expect(resolveDoctorId(uuid)).resolves.toBe(uuid)
    rpc.mockResolvedValueOnce({ data: uuid, error: null })
    await expect(resolvePatientId('PATIENT001')).resolves.toBe(uuid)
    expect(rpc).toHaveBeenLastCalledWith('resolve_patient_id', { input_id: 'PATIENT001' })
  })
  it('returns null on unresolved IDs and RPC exceptions', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'missing' } })
    await expect(resolveDoctorId('DOCTOR0001')).resolves.toBeNull()
    rpc.mockRejectedValueOnce(new Error('offline'))
    await expect(resolvePatientId('PATIENT0001')).resolves.toBeNull()
  })
  it('recognizes malformed IDs as demo IDs', () => {
    expect(isValidUUID('x')).toBe(false)
    expect(isDemoAppointment('short-id')).toBe(true)
  })
})
