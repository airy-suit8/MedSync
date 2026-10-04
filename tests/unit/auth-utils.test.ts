import { describe, expect, it } from 'vitest'
import { AUTH_ERRORS, getRoleDashboard, parseAuthError, validateEmail, validatePassword } from '@/lib/auth-utils'

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
