import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getSession, createClientMock } = vi.hoisted(() => ({ getSession: vi.fn(), createClientMock: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ createClient: createClientMock }))
import { AUTH_ERRORS, checkAuthStatus, getRoleDashboard, parseAuthError, validateEmail, validatePassword } from '@/lib/auth-utils'

describe('auth validation and role utilities', () => {
  it.each([
    ['valid simple address', 'person@example.com', true],
    ['case-insensitive address', 'PERSON@Example.COM', true],
    ['empty', '', false], ['whitespace', '   ', false], ['missing at', 'person.example.com', false],
    ['missing domain suffix', 'person@example', false], ['embedded whitespace', 'a b@example.com', false],
    ['SQL-looking input', "' OR '1'='1", false], ['unicode local part', 'ü@example.com', true],
    ['maximum length address', `${'a'.repeat(242)}@example.com`, true],
    ['one over maximum address', `${'a'.repeat(243)}@example.com`, false],
  ])('email %s', (_label, email, expected) => expect(validateEmail(email)).toBe(expected))

  it.each([
    ['', false, 0], ['        ', false, 1], ['Abcdef1!', true, 5],
    ['abcdefgh', false, 2], ['ABCDEFG1!', true, 4], ['Abcdefgh!', true, 4],
    ['Abcdefg1', true, 4], ['Abcdef1🙂', true, 4], ["'; DROP TABLE users; --", true, 4],
    ['A'.repeat(7) + 'a1!', true, 5],
  ])('password edge %j', (password, valid, score) => {
    const result = validatePassword(password)
    expect(result.isValid).toBe(valid)
    expect(result.score).toBe(score)
    expect(result.errors.length).toBe(5 - score)
  })

  it.each([['doctor', '/doctor-dashboard'], ['patient', '/patient-dashboard'], ['lab', '/lab-dashboard'], [null, '/'], [undefined, '/']])('routes role %s', (role, route) => expect(getRoleDashboard(role as never)).toBe(route))

  it.each([
    [null, AUTH_ERRORS.UNKNOWN_ERROR], [{ message: 'Email not confirmed' }, AUTH_ERRORS.EMAIL_NOT_VERIFIED],
    [{ message: 'Invalid login credentials' }, AUTH_ERRORS.INVALID_CREDENTIALS],
    [{ message: 'already registered' }, AUTH_ERRORS.EMAIL_EXISTS], [{ message: 'Too many requests' }, AUTH_ERRORS.RATE_LIMIT],
    [{ message: 'Network unavailable' }, AUTH_ERRORS.NETWORK_ERROR], [{ message: 'specific error' }, 'specific error'],
  ])('parses errors %#', (error, expected) => expect(parseAuthError(error)).toBe(expected))
})

describe('checkAuthStatus', () => {
  beforeEach(() => {
    getSession.mockReset()
    createClientMock.mockReset().mockReturnValue({ auth: { getSession } })
  })
  it('returns logged out for missing users and expired sessions', async () => {
    getSession.mockResolvedValue({ data: { session: null }, error: new Error('expired') })
    await expect(checkAuthStatus()).resolves.toEqual({ isAuthenticated: false, user: null, role: null })
  })
  it('returns user role for an authenticated user', async () => {
    const user = { id: 'u1', user_metadata: { role: 'doctor' } }
    getSession.mockResolvedValue({ data: { session: { user } }, error: null })
    await expect(checkAuthStatus()).resolves.toEqual({ isAuthenticated: true, user, role: 'doctor' })
  })
  it('fails closed when Supabase throws', async () => {
    createClientMock.mockImplementation(() => { throw new Error('fetch failed') })
    await expect(checkAuthStatus()).resolves.toEqual({ isAuthenticated: false, user: null, role: null })
  })
})
