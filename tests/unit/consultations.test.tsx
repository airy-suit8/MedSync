// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const { createClientMock, toast } = vi.hoisted(() => ({ createClientMock: vi.fn(), toast: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ createClient: createClientMock }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }))

import { matchesDoctor } from '@/lib/doctor-search'
import ConsultationRequests from '@/components/medical/ConsultationRequests'
import EndCareButton from '@/components/medical/EndCareButton'

afterEach(cleanup)

// Supabase query builder stand-in: chained calls return itself; awaiting yields `result`.
function query(result: unknown) {
  const builder: any = new Proxy({}, {
    get: (_t, prop) => prop === 'then' ? (resolve: (v: unknown) => void) => resolve(result) : () => builder,
  })
  return builder
}

describe('matchesDoctor', () => {
  const doctor = { id: 'd1', name: 'Asha Rao', specialty: 'Orthopaedics', expertise: 'Fractures, knee and back pain', share_before: null }
  it.each([
    ['', true],
    ['asha', true],
    ['ORTHO', true],
    ['knee pain', true],
    ['fracture rao', true],
    ['skin', false],
    ['knee skin', false],
  ])('query %j matches: %s', (q, expected) => expect(matchesDoctor(doctor, q)).toBe(expected))
})

describe('ConsultationRequests', () => {
  let rpc: ReturnType<typeof vi.fn>
  const request = { id: 'a1', patient_name: 'Ravi', appointment_date: '2026-10-20', start_time: '10:00:00', symptoms: 'Cold for a week' }

  beforeEach(() => {
    toast.mockReset()
    rpc = vi.fn().mockResolvedValue({ error: null })
    createClientMock.mockReset().mockReturnValue({ from: () => query({ data: [request] }), rpc })
  })

  it('shows the request and accepts it', async () => {
    const onAnswered = vi.fn()
    render(<ConsultationRequests doctorId="doc-1" onAnswered={onAnswered} />)
    expect(await screen.findByText('Ravi')).toBeTruthy()
    expect(screen.getByText(/Cold for a week/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }))
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('respond_to_consultation_request', { p_appointment_id: 'a1', p_accept: true }))
    await waitFor(() => expect(screen.queryByText('Ravi')).toBeNull())
    expect(onAnswered).toHaveBeenCalled()
  })

  it('keeps the request when the server refuses', async () => {
    rpc.mockResolvedValue({ error: { message: 'Only verified doctors can accept patients' } })
    render(<ConsultationRequests doctorId="doc-1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Decline' }))
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' })))
    expect(screen.getByText('Ravi')).toBeTruthy()
  })
})

describe('EndCareButton', () => {
  it('asks once, then ends care', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null })
    createClientMock.mockReset().mockReturnValue({ rpc })
    const onEnded = vi.fn()
    render(<EndCareButton otherId="doc-1" otherName="Dr Rao" role="patient" onEnded={onEnded} />)
    fireEvent.click(screen.getByRole('button', { name: 'End care' }))
    expect(rpc).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Yes, end care' }))
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('end_care', { p_other_id: 'doc-1' }))
    await waitFor(() => expect(onEnded).toHaveBeenCalled())
  })

  it('can be backed out of', () => {
    createClientMock.mockReset().mockReturnValue({ rpc: vi.fn() })
    render(<EndCareButton otherId="p-1" otherName="Ravi" role="doctor" onEnded={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'End care' }))
    fireEvent.click(screen.getByRole('button', { name: 'Keep' }))
    expect(screen.getByRole('button', { name: 'End care' })).toBeTruthy()
  })
})
