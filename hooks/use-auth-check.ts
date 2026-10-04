"use client"

import { useEffect, useState, useRef } from "react"
import { createClient } from "@/lib/supabase"
import { useRouter, usePathname } from "next/navigation"

export type UserRole = "doctor" | "patient" | "lab"

interface AuthCheckResult {
  user: any | null
  shortId: string | null
  loading: boolean
  error: any | null
}

export function useAuthCheck(requiredRole?: UserRole) {
  const [user, setUser] = useState<any>(null)
  const [shortId, setShortId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<any>(null)
  const router = useRouter()
  const pathname = usePathname()
  useEffect(() => {
    let isMounted = true
    
    const checkAuth = async () => {
      if (!isMounted) return
      setLoading(true)

      try {
        const supabase = createClient()
        const { data: { session }, error: authError } = await supabase.auth.getSession()
        let user = session?.user || null
        // Tokens issued before the app_metadata role backfill don't carry the role yet.
        if (user && !user.app_metadata?.role) {
          user = (await supabase.auth.getUser()).data.user ?? user
        }

        if (!isMounted) return

        if (authError || !user) {
          console.error("useAuthCheck: getSession failed!", authError)
          router.push("/login")
          return
        }

        const userRole = user.app_metadata?.role

        if (requiredRole && userRole !== requiredRole) {
          console.error(`Unauthorized access: required ${requiredRole}, got ${userRole}`)
          router.push("/login")
          return
        }

        setUser(user)

        // Resolve the ID from the current schema. Phase 3 consolidated IDs
        // onto profiles and removed user_short_ids.
        try {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('short_id')
            .eq('id', user.id)
            .maybeSingle()

          if (!isMounted) return

          if (profileError) {
            console.warn("Could not resolve short ID:", profileError)
          } else {
            setShortId(profile?.short_id || null)
          }
        } catch (idError) {
          console.warn('Failed to resolve short ID:', idError)
        }

      } catch (e) {
        if (!isMounted) return
        console.error('Auth check error:', e)
        setError(e)
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    checkAuth()
    
    return () => {
      isMounted = false
    }
  }, [requiredRole, router])

  return { user, shortId, loading, error }
}
