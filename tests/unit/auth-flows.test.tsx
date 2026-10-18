// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

const { createClientMock, searchParams } = vi.hoisted(() => ({ createClientMock: vi.fn(), searchParams: { value: new URLSearchParams() } }))
vi.mock('@/lib/supabase', () => ({ createClient: createClientMock }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => searchParams.value,
}))

import SignUpPage from '@/app/signup/page'
import VerifyEmailPage from '@/app/verify-email/page'
import ConfirmPage from '@/app/confirm/page'
import LoginPage from '@/app/login/page'

afterEach(cleanup)

describe('sign-up with an email that already has an account', () => {
  it('says so instead of "Account Created!"', async () => {
    const signUp = vi.fn().mockResolvedValue({ data: { user: { id: 'x', identities: [] } }, error: null })
    createClientMock.mockReturnValue({ auth: { signUp } })
    render(<SignUpPage />)
    fireEvent.click(screen.getByTestId('signup-role-patient'))
    fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'Ravi Kumar' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ravi@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Str0ng!Passw0rd' } })
    fireEvent.click(screen.getByRole('button', { name: /CREATE ACCOUNT/ }))
    expect(await screen.findByText(/already exists/)).toBeTruthy()
    expect(screen.queryByText('Account Created!')).toBeNull()
  })
})

describe('email confirmation page', () => {
  beforeEach(() => { window.location.hash = '' })

  // Supabase confirms the address when the link is opened, then redirects here with ?code=.
  it('treats a link opened on another device as confirmed, not failed', async () => {
    searchParams.value = new URLSearchParams('code=abc')
    createClientMock.mockReturnValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) } })
    render(<VerifyEmailPage />)
    expect(await screen.findByText('YOU’RE CONFIRMED.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Sign in' }).getAttribute('href')).toBe('/login')
  })

  it('sends a signed-in doctor to their dashboard and explains the registration check', async () => {
    searchParams.value = new URLSearchParams('code=abc')
    createClientMock.mockReturnValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { app_metadata: { role: 'doctor' } } } }) } })
    render(<VerifyEmailPage />)
    expect((await screen.findByRole('link', { name: 'Go to your dashboard' })).getAttribute('href')).toBe('/doctor-dashboard')
    expect(screen.getByText('Registration check')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Fill in your public profile' }).getAttribute('href')).toBe('/doctor-dashboard/profile')
  })

  it("doesn't claim a confirmation when the page is opened without a link", async () => {
    searchParams.value = new URLSearchParams()
    createClientMock.mockReturnValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) } })
    render(<VerifyEmailPage />)
    expect(await screen.findByText('CHECK YOUR INBOX.')).toBeTruthy()
    expect(screen.queryByText('YOU’RE CONFIRMED.')).toBeNull()
  })

  it('offers a new link when the old one expired', async () => {
    searchParams.value = new URLSearchParams('error=access_denied&error_code=otp_expired')
    const resend = vi.fn().mockResolvedValue({ error: null })
    createClientMock.mockReturnValue({ auth: { resend } })
    render(<VerifyEmailPage />)
    expect((await screen.findByRole('alert')).textContent).toMatch(/expired/)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ravi@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send a new link' }))
    expect(await screen.findByText(/new link is on its way/)).toBeTruthy()
    expect(resend).toHaveBeenCalledWith(expect.objectContaining({ type: 'signup', email: 'ravi@example.com' }))
  })
})

describe('signing in before confirming the email', () => {
  it('offers to send a new confirmation link to that address', async () => {
    searchParams.value = new URLSearchParams()
    const resend = vi.fn().mockResolvedValue({ error: null })
    const signInWithPassword = vi.fn().mockResolvedValue({ data: {}, error: { message: 'Email not confirmed' } })
    createClientMock.mockReturnValue({ auth: { signInWithPassword, resend } })
    render(<LoginPage />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'meera@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Str0ng!Passw0rd' } })
    fireEvent.submit(screen.getByTestId('login-form'))
    fireEvent.click(await screen.findByRole('button', { name: 'Send a new confirmation link' }))
    expect(await screen.findByText(/A new link is on its way to meera@example.com/)).toBeTruthy()
    expect(resend).toHaveBeenCalledWith(expect.objectContaining({ type: 'signup', email: 'meera@example.com' }))
  })
})

// The links in supabase/templates/*.html
describe('/confirm links from MedSync emails', () => {
  it('confirms a sign-up link on any device and links to the dashboard', async () => {
    searchParams.value = new URLSearchParams('token_hash=abc&type=email')
    const verifyOtp = vi.fn().mockResolvedValue({ data: { user: { app_metadata: { role: 'patient' } } }, error: null })
    createClientMock.mockReturnValue({ auth: { verifyOtp } })
    render(<ConfirmPage />)
    expect(await screen.findByText('Email confirmed')).toBeTruthy()
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: 'abc', type: 'email' })
    expect(screen.getByRole('link', { name: 'Go to your dashboard' }).getAttribute('href')).toBe('/patient-dashboard')
  })

  it('lets a recovery link set a new password', async () => {
    searchParams.value = new URLSearchParams('token_hash=abc&type=recovery')
    const updateUser = vi.fn().mockResolvedValue({ error: null })
    createClientMock.mockReturnValue({ auth: { verifyOtp: vi.fn().mockResolvedValue({ data: { user: {} }, error: null }), updateUser } })
    render(<ConfirmPage />)
    fireEvent.change(await screen.findByLabelText('New password'), { target: { value: 'Str0ng!Passw0rd' } })
    fireEvent.change(screen.getByLabelText('Type it again'), { target: { value: 'Str0ng!Passw0rd' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save new password' }))
    expect(await screen.findByText('Password saved')).toBeTruthy()
    expect(updateUser).toHaveBeenCalledWith({ password: 'Str0ng!Passw0rd' })
  })

  it('offers a fresh link when the token is used or expired', async () => {
    searchParams.value = new URLSearchParams('token_hash=old&type=email')
    createClientMock.mockReturnValue({ auth: { verifyOtp: vi.fn().mockResolvedValue({ data: { user: null }, error: { message: 'expired' } }) } })
    render(<ConfirmPage />)
    expect(await screen.findByText(/expired or was already used/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Send a new link' })).toBeTruthy()
  })
})
