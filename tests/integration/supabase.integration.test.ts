import { describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321'
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!anonKey) throw new Error('Set NEXT_PUBLIC_SUPABASE_ANON_KEY from the local Supabase status output before running integration tests.')

describe('local Supabase integration preflight', () => {
  const client = createClient(url, anonKey)
  it('serves the local Auth health endpoint', async () => {
    const response = await fetch(`${url}/auth/v1/health`)
    expect(response.ok).toBe(true)
  })
  it('allows only permitted anonymous reads on reports', async () => {
    const { error } = await client.from('reports').select('id').limit(1)
    // Phase 1 revoked table grants from anon; a permission error is expected.
    expect(error).not.toBeNull()
  })
})
