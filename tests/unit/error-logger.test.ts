import { describe, expect, it, vi } from 'vitest'
import { ErrorLogger } from '@/lib/error-logger'

describe('ErrorLogger metadata', () => {
  it('normalizes Supabase error fields and logs them', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const result = ErrorLogger.logSupabaseError({ message: 'bad', code: '42501' }, { context: 'reports' })
    expect(result).toMatchObject({ message: 'bad', code: '42501', details: null, hint: null, context: 'reports' })
    spy.mockRestore()
  })
  it('normalizes generic errors and primitives', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(ErrorLogger.logGenericError(new Error('oops'), { context: 'test' })).toMatchObject({ message: 'oops', type: 'object' })
    expect(ErrorLogger.logGenericError('oops', { context: 'test' })).toMatchObject({ message: 'Unknown error', type: 'string', stack: null })
    spy.mockRestore()
  })
  it('normalizes network errors with missing fields', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(ErrorLogger.logNetworkError({ message: 'timeout', status: 504, config: { url: '/api', method: 'POST' } }, { context: 'network' })).toMatchObject({ message: 'timeout', status: 504, url: '/api', method: 'POST' })
    spy.mockRestore()
  })
})
