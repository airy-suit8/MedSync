// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

const { createClientMock } = vi.hoisted(() => ({ createClientMock: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ createClient: createClientMock }))

import HealthTimeline from '@/components/medical/HealthTimeline'

afterEach(cleanup)

const entries = [
  { kind: 'review', ref_id: 'r1', happened_at: '2026-10-10T10:00:00Z', title: 'X Ray report reviewed', detail: 'Keep the cast on.', doctor_name: 'Dr Rao' },
  { kind: 'prescription', ref_id: 'rx1', happened_at: '2026-10-09T10:00:00Z', title: 'Prescription: Ibuprofen', detail: null, doctor_name: 'Dr Rao' },
  { kind: 'care', ref_id: 'c1', happened_at: '2026-10-01T10:00:00Z', title: 'Started seeing Dr Rao', detail: null, doctor_name: 'Dr Rao' },
]

describe('HealthTimeline', () => {
  it.each([
    ['patient', '/patient-dashboard/reports/r1'],
    ['doctor', '/doctor-dashboard/reports/r1'],
  ] as const)('links a review to the %s report page', async (viewer, href) => {
    const rpc = vi.fn().mockResolvedValue({ data: entries })
    createClientMock.mockReturnValue({ rpc })
    render(<HealthTimeline patientId="p1" viewer={viewer} />)
    // the database's "X Ray" is shown as the test's proper name
    expect((await screen.findByText('X-ray report reviewed')).closest('a')?.getAttribute('href')).toBe(href)
    expect(rpc).toHaveBeenCalledWith('get_patient_timeline', { p_patient_id: 'p1' })
    expect(screen.getByText('Prescription: Ibuprofen').closest('a')?.getAttribute('href')).toBe('/prescriptions/rx1')
    expect(screen.getByText('Started seeing Dr Rao').closest('a')).toBeNull()
  })

  it('shows each day once, with that day’s entries under it', async () => {
    const sameDay = [
      { kind: 'report', ref_id: 'r2', happened_at: '2026-09-28T09:00:00Z', title: 'Mri report', detail: null, doctor_name: 'Dr Rao' },
      { kind: 'report', ref_id: 'r3', happened_at: '2026-09-28T08:00:00Z', title: 'Mri report', detail: null, doctor_name: 'Dr Rao' },
    ]
    createClientMock.mockReturnValue({ rpc: vi.fn().mockResolvedValue({ data: sameDay }) })
    render(<HealthTimeline patientId="p1" viewer="doctor" />)
    expect(await screen.findAllByText('MRI report')).toHaveLength(2)
    expect(screen.getAllByText('28 Sep 2026')).toHaveLength(1)
  })

  it('says when there is nothing yet', async () => {
    createClientMock.mockReturnValue({ rpc: vi.fn().mockResolvedValue({ data: [] }) })
    render(<HealthTimeline patientId="p1" viewer="patient" />)
    expect(await screen.findByText('Nothing here yet.')).toBeTruthy()
  })
})
