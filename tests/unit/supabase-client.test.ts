import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createBrowserClient } = vi.hoisted(() => ({ createBrowserClient: vi.fn() }))
vi.mock('@supabase/ssr', () => ({ createBrowserClient }))
import { createClient } from '@/lib/supabase'

describe('browser Supabase client configuration', () => {
  beforeEach(() => {
    vi.resetModules()
    createBrowserClient.mockReset().mockReturnValue({ client: true })
  })
  it('requires both public connection settings', () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    expect(() => createClient()).toThrow(/Missing Supabase environment variables/)
  })
  it('creates once and caches the browser client', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-only-placeholder'
    expect(createClient()).toEqual({ client: true })
    expect(createClient()).toEqual({ client: true })
    expect(createBrowserClient).toHaveBeenCalledTimes(1)
  })
})
