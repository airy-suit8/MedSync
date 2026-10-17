"use client"

import { Suspense, useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { CheckCircle, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import AuthFrame from "@/components/auth/AuthFrame"
import ResendConfirmation from "@/components/auth/ResendConfirmation"
import { createClient } from "@/lib/supabase"
import { getRoleDashboard } from "@/lib/auth-utils"

// Where the sign-up confirmation email lands. Supabase confirms the address before
// redirecting here; it only reports a problem through error parameters. Opening the link
// in another browser or device confirms the email but doesn't sign that browser in, which
// used to be shown as "Verification failed".
function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const [state, setState] = useState<"loading" | "signed-in" | "confirmed" | "error">("loading")
  const [dashboard, setDashboard] = useState("/login")
  const [problem, setProblem] = useState("")

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1))
    const error = searchParams.get("error") || hash.get("error")
    const code = searchParams.get("error_code") || hash.get("error_code")
    if (error) {
      setProblem(code === "otp_expired"
        ? "This link has expired. Enter your email below and we'll send a new one."
        : "This link is not valid any more. Enter your email below and we'll send a new one.")
      setState("error")
      return
    }
    createClient().auth.getUser().then(({ data: { user } }: { data: { user: { app_metadata?: { role?: string } } | null } }) => {
      if (user) {
        setDashboard(getRoleDashboard(user.app_metadata?.role as Parameters<typeof getRoleDashboard>[0]))
        setState("signed-in")
      } else {
        setState("confirmed")
      }
    })
  }, [searchParams])

  if (state === "loading") return <p role="status" className="text-sm text-black/60">Checking your link…</p>

  if (state === "error") return <ResendForm problem={problem} />

  return (
    <div role="status" className="space-y-6 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center border border-black">
        <CheckCircle className="h-6 w-6" aria-hidden="true" />
      </div>
      <div>
        <h2 className="text-2xl font-bold">Email confirmed</h2>
        <p className="mt-2 text-black/60">
          {state === "signed-in" ? "You're signed in and ready to go." : "Sign in to continue."}
        </p>
      </div>
      <Button asChild className="h-14 w-full rounded-none bg-black text-white hover:bg-black/90 font-mono text-sm uppercase tracking-widest">
        <Link href={state === "signed-in" ? dashboard : "/login"}>{state === "signed-in" ? "Go to your dashboard" : "Sign in"}</Link>
      </Button>
    </div>
  )
}

function ResendForm({ problem }: { problem: string }) {
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-700" aria-hidden="true" />
        <p role="alert">{problem}</p>
      </div>
      <ResendConfirmation />
      <p className="text-center text-xs font-mono uppercase tracking-wide text-black/60">
        Already confirmed? <Link href="/login" className="text-black border-b border-black/30 hover:border-black">Sign in</Link>
      </p>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <AuthFrame label="EMAIL" title="CONFIRM EMAIL." subtitle="One last step before you start.">
      <Suspense fallback={<p className="text-sm text-black/60">Checking your link…</p>}>
        <VerifyEmailContent />
      </Suspense>
    </AuthFrame>
  )
}
