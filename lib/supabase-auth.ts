import { createClient } from "./supabase"

/**
 * Returns a Supabase client only if the user has an active session.
 * Throws if not authenticated.
 */
export async function createAuthenticatedClient() {
  const client = createClient()

  const { data: { session }, error } = await client.auth.getSession()

  if (error) {
    throw new Error('Authentication failed')
  }

  if (!session) {
    throw new Error('No active session. Please log in again.')
  }

  return client
}

/**
 * Quick check that the Supabase connection and current session are working.
 * Useful for diagnostics — not for production hot paths.
 */
export async function testDatabaseConnection() {
  try {
    const client = await createAuthenticatedClient()

    const { data, error } = await client
      .from('reports')
      .select('count')
      .limit(1)

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, data }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

