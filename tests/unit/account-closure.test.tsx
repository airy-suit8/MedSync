// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const { createClientMock, toast, push, params } = vi.hoisted(() => ({
  createClientMock: vi.fn(), toast: vi.fn(), push: vi.fn(), params: { value: new URLSearchParams() },
}))
vi.mock('@/lib/supabase', () => ({ createClient: createClientMock }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }), useSearchParams: () => params.value }))
vi.mock('@/hooks/use-auth-check', () => ({ useAuthCheck: () => ({ user: { id: 'admin-1' }, loading: false }) }))

import AccountSettings from '@/components/medical/AccountSettings'
import AccountClosedPage from '@/app/account-closed/page'
import AccountsPage from '@/app/admin-dashboard/accounts/page'
import { accountStatus, dueForDeletion } from '@/lib/admin'
import { parseAuthError } from '@/lib/auth-utils'

afterEach(cleanup)
beforeEach(() => { push.mockReset(); toast.mockReset(); createClientMock.mockReset(); params.value = new URLSearchParams() })

const select = (data: unknown) => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data }) }) }) })

describe('closing your own account', () => {
  it('needs CLOSE typed, then closes, signs out and explains what happens next', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: '2029-10-15T09:30:00+00:00', error: null })
    const signOut = vi.fn().mockResolvedValue({})
    createClientMock.mockReturnValue({ from: () => select({ name: 'Ravi', email: 'ravi@example.com', short_id: 'PAT-1', created_at: '2026-09-01T00:00:00Z' }), rpc, auth: { signOut } })
    render(<AccountSettings userId="p1" role="patient" />)
    expect(await screen.findByText('ravi@example.com')).toBeTruthy()
    expect(screen.getByText(/kept for 3 years after your last report/)).toBeTruthy()
    const button = screen.getByRole('button', { name: 'Close my account' }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Type CLOSE to confirm'), { target: { value: 'close' } })
    expect(button.disabled).toBe(false)
    fireEvent.click(button)
    await waitFor(() => expect(push).toHaveBeenCalledWith('/account-closed?role=patient&until=2029-10-15'))
    expect(rpc).toHaveBeenCalledWith('close_my_account')
    expect(signOut).toHaveBeenCalled()
  })

  it('tells a patient until when their records are kept', () => {
    params.value = new URLSearchParams('role=patient&until=2029-10-15')
    render(<AccountClosedPage />)
    expect(screen.getByText('15 October 2029')).toBeTruthy()
  })

  it('signing in to a closed account says so', () => {
    expect(parseAuthError({ message: 'User is banned' })).toMatch(/This account is closed/)
  })
})

describe('closed accounts for admins', () => {
  const closed = {
    id: 'p1', name: 'Ravi Kumar', email: 'ravi@example.com', role: 'patient', short_id: 'PAT-1', verified: false,
    license_number: null, medical_council: null, qualification: null, specialty: null, verification_note: null,
    verification_reviewed_at: null, email_confirmed: true, created_at: '2023-01-01T00:00:00Z', last_sign_in_at: null,
    invite_code: null, closed_at: '2023-06-01T00:00:00Z', delete_after: '2026-06-01T00:00:00Z',
  } as const

  it('a closed account shows as closed, and a patient is due once the date has passed', () => {
    expect(accountStatus({ ...closed, role: 'doctor', verified: true })).toBe('closed')
    expect(dueForDeletion(closed, new Date('2026-10-18'))).toBe(true)
    expect(dueForDeletion(closed, new Date('2026-05-01'))).toBe(false)
    expect(dueForDeletion({ ...closed, role: 'doctor' }, new Date('2026-10-18'))).toBe(false)
  })

  it('an admin can delete a due account for good, after confirming', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [closed], error: null })
    createClientMock.mockReturnValue({ rpc })
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ deleted: true, filesRemoved: 2, fileErrors: [] }) })
    vi.stubGlobal('fetch', fetchMock)
    render(<AccountsPage />)
    expect(await screen.findByText(/retention period is over/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Delete permanently' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Delete permanently' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/admin/purge', expect.objectContaining({ method: 'POST', body: JSON.stringify({ userId: 'p1' }) })))
    vi.unstubAllGlobals()
  })

  it('an admin can reopen a closed account', async () => {
    const rpc = vi.fn().mockImplementation((fn: string) => Promise.resolve(fn === 'admin_list_accounts' ? { data: [{ ...closed, delete_after: '2099-01-01T00:00:00Z' }], error: null } : { error: null }))
    createClientMock.mockReturnValue({ rpc })
    render(<AccountsPage />)
    expect(await screen.findByText(/Medical records are kept until 1 Jan 2099/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Delete permanently' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Reopen' }))
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('admin_reopen_account', { p_user: 'p1' }))
  })
})
