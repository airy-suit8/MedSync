import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export async function verifySession() {
  const cookieStore = await cookies()
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )

  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return { user: null, supabase, error }
  }

  return { user, supabase, error: null }
}

export function unauthorizedResponse() {
  return NextResponse.json(
    { error: "Unauthorized. Please sign in to access this resource." },
    { status: 401 }
  )
}

export function forbiddenResponse() {
  return NextResponse.json(
    { error: "Forbidden. You do not have permission to access this resource." },
    { status: 403 }
  )
}

export function hasRole(user: { app_metadata?: Record<string, unknown>, user_metadata?: Record<string, unknown> }, role: string) {
  return user.app_metadata?.role === role || user.user_metadata?.role === role
}
