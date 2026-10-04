"use client"

import { useEffect, useState } from "react"
import { ShieldAlert } from "lucide-react"
import { createClient } from "@/lib/supabase"

// Unverified doctors can sign in but can't schedule or see patients until the team
// checks their registration number (profiles.verified, set in the Supabase dashboard).
export default function VerificationBanner() {
  const [isPending, setIsPending] = useState(false)

  useEffect(() => {
    const check = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from("profiles").select("verified").eq("id", user.id).maybeSingle()
      setIsPending(data?.verified === false)
    }
    check()
  }, [])

  if (!isPending) return null

  return (
    <div role="status" className="flex items-start gap-3 border-b border-amber-600/30 bg-amber-50 px-6 py-3 text-sm text-amber-900">
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <p>
        <strong className="font-mono uppercase text-xs tracking-wide">Verification pending.</strong>{" "}
        We&apos;re checking your medical registration number. Until then you can&apos;t schedule appointments or see patient records.
      </p>
    </div>
  )
}
