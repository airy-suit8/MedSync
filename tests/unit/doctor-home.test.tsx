// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

const { createClientMock, auth } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  // one object, as the real hook keeps it between renders
  auth: { user: { id: 'd1', user_metadata: { name: 'Dr Meera Iyer' } }, shortId: 'DOC-1', loading: false },
}))
vi.mock('@/lib/supabase', () => ({ createClient: createClientMock }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), useSearchParams: () => new URLSearchParams() }))
vi.mock('@/hooks/use-auth-check', () => ({ useAuthCheck: () => auth }))

import DoctorDashboard from '@/app/doctor-dashboard/page'

afterEach(cleanup)

// Supabase query builder stand-in: chained calls return itself; awaiting yields `result`.
function query(result: unknown) {
  const builder: any = new Proxy({}, {
    get: (_t, prop) => prop === 'then' ? (resolve: (v: unknown) => void) => resolve(result) : () => builder,
  })
  return builder
}

describe('doctor home', () => {
  it('counts only reports the doctor has not reviewed, and current patients as active', async () => {
    const reports = [
      { id: 'r1', patient_id: 'p1', test_type: 'x_ray', priority: 'urgent', created_at: '2026-10-17T09:00:00Z' },
      { id: 'r2', patient_id: 'p2', test_type: 'mri', priority: 'normal', created_at: '2026-10-16T09:00:00Z' },
    ]
    const tables: Record<string, unknown> = {
      appointments: { data: [] },
      reports: { data: reports },
      ml_suggestions: { data: [] },
      report_reviews: { data: [{ report_id: 'r1' }] }, // the urgent one is reviewed
      profile_directory: { data: [] },
    }
    createClientMock.mockReturnValue({
      from: (t: string) => query(tables[t] ?? { data: [] }),
      rpc: (fn: string) => query(fn === 'get_doctor_patients_bulletproof'
        ? { data: [{ patient_id: 'p1', patient_name: 'Ravi' }, { patient_id: 'p2', patient_name: 'Anita' }, { patient_id: 'p3', patient_name: 'Meena' }] }
        : { data: [] }),
    })
    render(<DoctorDashboard />)
    const pending = await screen.findByText('Pending Reports')
    expect(pending.previousElementSibling?.textContent).toBe('1')
    expect(screen.getByText('Active Patients').previousElementSibling?.textContent).toBe('3')
    expect(screen.queryByText(/Requires Immediate Attention/)).toBeNull() // reviewed urgent reports don't raise the banner
  })
})
