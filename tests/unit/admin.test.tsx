// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const { createClientMock, toast, push } = vi.hoisted(() => ({ createClientMock: vi.fn(), toast: vi.fn(), push: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ createClient: createClientMock }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }), useSearchParams: () => new URLSearchParams() }))

import { accountStatus, codeStatus, type Account } from '@/lib/admin'
import ReviewActions from '@/components/admin/ReviewActions'
import VerificationBanner from '@/components/medical/common/VerificationBanner'
import DoctorCard from '@/components/medical/DoctorCard'
import SignUpPage from '@/app/signup/page'

afterEach(cleanup)
beforeEach(() => { toast.mockReset(); createClientMock.mockReset() })

// Supabase query builder stand-in: chained calls return itself; awaiting yields `result`.
function query(result: unknown) {
  const builder: any = new Proxy({}, {
    get: (_t, prop) => prop === 'then' ? (resolve: (v: unknown) => void) => resolve(result) : () => builder,
  })
  return builder
}

const doctor: Account = {
  id: 'd1', name: 'Dr Meera Iyer', email: 'meera@example.com', role: 'doctor', short_id: 'abc', verified: false,
  license_number: 'MMC-2019-1', medical_council: 'Maharashtra', qualification: 'MBBS, MD', specialty: null,
  verification_note: null, verification_reviewed_at: null, email_confirmed: true, created_at: '2026-10-18T10:00:00Z',
  last_sign_in_at: null, invite_code: null,
}

describe('account and code status', () => {
  it('doctors and labs are waiting, verified or turned down; others are active', () => {
    expect(accountStatus(doctor)).toBe('pending')
    expect(accountStatus({ ...doctor, verified: true })).toBe('verified')
    expect(accountStatus({ ...doctor, verification_reviewed_at: '2026-10-18T11:00:00Z' })).toBe('turned_down')
    expect(accountStatus({ ...doctor, role: 'patient' })).toBe('active')
  })
  it('a code is open until used, revoked or expired', () => {
    const now = new Date('2026-10-18T12:00:00Z')
    const open = { used_at: null, revoked_at: null, expires_at: '2026-10-30T00:00:00Z' }
    expect(codeStatus(open, now)).toBe('open')
    expect(codeStatus({ ...open, expires_at: '2026-10-01T00:00:00Z' }, now)).toBe('expired')
    expect(codeStatus({ ...open, revoked_at: '2026-10-10T00:00:00Z' }, now)).toBe('revoked')
    expect(codeStatus({ ...open, used_at: '2026-10-10T00:00:00Z', revoked_at: '2026-10-11T00:00:00Z' }, now)).toBe('used')
  })
})

describe('ReviewActions', () => {
  it('approves a doctor', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null })
    createClientMock.mockReturnValue({ rpc })
    const onDone = vi.fn()
    render(<ReviewActions account={doctor} onDone={onDone} />)
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }))
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(rpc).toHaveBeenCalledWith('admin_review_account', { p_user: 'd1', p_approve: true, p_note: null })
  })

  it('turning down needs a reason, which is sent', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null })
    createClientMock.mockReturnValue({ rpc })
    render(<ReviewActions account={doctor} onDone={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Turn down' }))
    const submit = screen.getByRole('button', { name: 'Turn down' })
    expect((submit as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: 'Not on the register' } })
    fireEvent.click(submit)
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('admin_review_account', { p_user: 'd1', p_approve: false, p_note: 'Not on the register' }))
  })
})

describe('VerificationBanner', () => {
  it('shows why a doctor was turned down and sends fixed details for review', async () => {
    const me = { ...doctor, id: 'd1', verification_note: 'Number not found.', verification_reviewed_at: '2026-10-18T11:00:00Z' }
    const update = vi.fn().mockReturnValue(query({ error: null }))
    const rpc = vi.fn().mockResolvedValue({ error: null })
    createClientMock.mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'd1' } } }) },
      from: () => ({ select: () => query({ data: me }), update }),
      rpc,
    })
    render(<VerificationBanner role="doctor" />)
    expect(await screen.findByText(/Number not found\./)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Fix my details' }))
    fireEvent.change(screen.getByLabelText('Registration number'), { target: { value: 'MMC-2019-12' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send for review' }))
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('request_verification_review'))
    expect(update).toHaveBeenCalledWith({ license_number: 'MMC-2019-12', medical_council: 'Maharashtra', qualification: 'MBBS, MD' })
  })

  it('says nothing once verified', async () => {
    createClientMock.mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'd1' } } }) },
      from: () => ({ select: () => query({ data: { ...doctor, verified: true } }) }),
    })
    const { container } = render(<VerificationBanner role="doctor" />)
    await waitFor(() => expect(createClientMock).toHaveBeenCalled())
    expect(container.textContent).toBe('')
  })
})

describe('DoctorCard', () => {
  it('shows qualification and registration, as the telemedicine guidelines ask', () => {
    render(<DoctorCard doctor={{ id: 'd1', name: 'Dr Meera Iyer', specialty: 'Radiology', expertise: null, share_before: null,
      qualification: 'MBBS, MD', license_number: 'MMC-2019-1', medical_council: 'Maharashtra' }} />)
    expect(screen.getByText(/MBBS, MD/).textContent).toContain('Reg. no. MMC-2019-1 (Maharashtra)')
  })
})

describe('signing up as a doctor with an invite code', () => {
  const fill = () => {
    fireEvent.click(screen.getByTestId('signup-role-doctor'))
    fireEvent.change(screen.getByLabelText('Medical Council'), { target: { value: 'Maharashtra' } })
    fireEvent.change(screen.getByLabelText('Medical Registration Number'), { target: { value: 'MMC-2019-1' } })
    fireEvent.change(screen.getByLabelText('Qualification'), { target: { value: 'MBBS, MD' } })
    fireEvent.change(screen.getByLabelText('Invite code (optional)'), { target: { value: 'abcd-efgh-jkmn' } })
    fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'Meera Iyer' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'meera@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Str0ng!Passw0rd' } })
    fireEvent.submit(screen.getByTestId('signup-form'))
  }

  it('checks the code, then signs up with it and the registration details', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null })
    const signUp = vi.fn().mockResolvedValue({ data: { user: { id: 'x', identities: [{}] } }, error: null })
    createClientMock.mockReturnValue({ rpc, auth: { signUp } })
    render(<SignUpPage />)
    fill()
    expect(await screen.findByText(/invite code is accepted/)).toBeTruthy()
    expect(rpc).toHaveBeenCalledWith('signup_code_is_valid', { p_code: 'abcd-efgh-jkmn', p_role: 'doctor', p_email: 'meera@example.com' })
    expect(signUp.mock.calls[0][0].options.data).toMatchObject({
      role: 'doctor', license_number: 'MMC-2019-1', medical_council: 'Maharashtra', qualification: 'MBBS, MD', invite_code: 'abcd-efgh-jkmn',
    })
  })

  it("doesn't create the account when the code won't work", async () => {
    const signUp = vi.fn()
    createClientMock.mockReturnValue({ rpc: vi.fn().mockResolvedValue({ data: false, error: null }), auth: { signUp } })
    render(<SignUpPage />)
    fill()
    expect(await screen.findByText(/This invite code won't work/)).toBeTruthy()
    expect(signUp).not.toHaveBeenCalled()
  })
})
