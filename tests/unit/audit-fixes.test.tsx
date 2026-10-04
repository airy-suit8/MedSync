// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const { createClientMock, toast } = vi.hoisted(() => ({ createClientMock: vi.fn(), toast: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ createClient: createClientMock }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }))

import { pressable } from '@/lib/utils'
import { hasRole } from '@/lib/api-utils'
import AppointmentRequests from '@/components/medical/AppointmentRequests'
import VerificationBanner from '@/components/medical/common/VerificationBanner'

// No vitest globals, so Testing Library can't register its own cleanup.
afterEach(cleanup)

// A Supabase query builder stand-in: every chained call returns itself and awaiting it
// yields `result`.
function query(result: unknown) {
  const builder: any = new Proxy({}, {
    get: (_t, prop) => prop === 'then'
      ? (resolve: (v: unknown) => void) => resolve(result)
      : () => builder,
  })
  return builder
}

describe('role checks trust only server-controlled app_metadata', () => {
  it('ignores a client-writable user_metadata role', () => {
    expect(hasRole({ app_metadata: { role: 'doctor' } }, 'doctor')).toBe(true)
    expect(hasRole({ app_metadata: {}, user_metadata: { role: 'doctor' } } as never, 'doctor')).toBe(false)
  })
})

describe('pressable', () => {
  it.each([['Enter'], [' ']])('activates on %j', key => {
    const onPress = vi.fn()
    const props = pressable(onPress)
    const preventDefault = vi.fn()
    props.onKeyDown({ key, preventDefault } as never)
    expect(onPress).toHaveBeenCalledOnce()
    expect(preventDefault).toHaveBeenCalledOnce()
  })
  it('ignores other keys and exposes button semantics', () => {
    const onPress = vi.fn()
    const props = pressable(onPress)
    props.onKeyDown({ key: 'Tab', preventDefault: vi.fn() } as never)
    expect(onPress).not.toHaveBeenCalled()
    expect(props).toMatchObject({ role: 'button', tabIndex: 0, onClick: onPress })
  })
})

describe('AppointmentRequests', () => {
  const request = { id: 'appt-1', doctor_name: 'Dr Rao', appointment_date: '2099-01-02', start_time: '10:30:00', consultation_type: 'video' }
  let rpc: ReturnType<typeof vi.fn>

  beforeEach(() => {
    toast.mockReset()
    rpc = vi.fn().mockResolvedValue({ error: null })
    createClientMock.mockReset().mockReturnValue({ from: () => query({ data: [request] }), rpc })
  })

  it('lists pending requests and confirms one', async () => {
    render(<AppointmentRequests patientId="patient-1" />)
    expect(await screen.findByText('Dr Rao')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('respond_to_appointment', { p_appointment_id: 'appt-1', p_accept: true }))
    await waitFor(() => expect(screen.queryByText('Dr Rao')).toBeNull())
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Appointment confirmed' }))
  })

  it('declines and keeps the request when the server refuses', async () => {
    rpc.mockResolvedValue({ error: { message: 'This doctor is not verified yet' } })
    render(<AppointmentRequests patientId="patient-1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Decline' }))
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('respond_to_appointment', { p_appointment_id: 'appt-1', p_accept: false }))
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive', description: 'This doctor is not verified yet' }))
    expect(screen.getByText('Dr Rao')).toBeTruthy()
  })

  it('renders nothing when there are no requests', async () => {
    createClientMock.mockReturnValue({ from: () => query({ data: [] }), rpc })
    const { container } = render(<AppointmentRequests patientId="patient-1" />)
    await waitFor(() => expect(container.innerHTML).toBe(''))
  })
})

describe('VerificationBanner', () => {
  it.each([
    [false, true],
    [true, false],
  ])('verified=%s shows banner: %s', async (verified, shown) => {
    createClientMock.mockReset().mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'doc-1' } } }) },
      from: () => query({ data: { verified } }),
    })
    render(<VerificationBanner />)
    if (shown) {
      expect(await screen.findByText(/Verification pending/)).toBeTruthy()
    } else {
      await waitFor(() => expect(createClientMock).toHaveBeenCalled())
      expect(screen.queryByText(/Verification pending/)).toBeNull()
    }
  })
})
