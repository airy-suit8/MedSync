"use client"

import type React from "react"
import { Suspense, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { CheckCircle, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import AuthFrame from "@/components/auth/AuthFrame"
import ResendConfirmation from "@/components/auth/ResendConfirmation"
import { createClient } from "@/lib/supabase"
import { AUTH_ERRORS, getRoleDashboard, validatePassword } from "@/lib/auth-utils"

// Where MedSync's emails link (supabase/templates/*.html): /confirm?token_hash=…&type=…
// The token in the link is checked here, so it works in any browser or device (unlike
// the default links, which only finish in the browser that started sign-up or reset).
//   type=email (or signup)  confirm a new account, then go to the dashboard
//   type=recovery           choose a new password
//   type=email_change       confirm a new email address
type OtpType = "email" | "recovery" | "email_change"
type Phase = "checking" | "confirmed" | "new-password" | "password-saved" | "email-changed" | "failed"

function ConfirmContent() {
  const params = useSearchParams()
  const [phase, setPhase] = useState<Phase>("checking")
  const [dashboard, setDashboard] = useState("/login")
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return // the token can only be used once
    started.current = true
    const tokenHash = params.get("token_hash") || params.get("token")
    const raw = params.get("type")
    const type: OtpType | null = raw === "signup" || raw === "email" ? "email" : raw === "recovery" || raw === "email_change" ? raw : null
    if (!tokenHash || !type) {
      setPhase("failed")
      return
    }
    createClient().auth.verifyOtp({ token_hash: tokenHash, type }).then(({ data, error }: { data: { user: { app_metadata?: { role?: string } } | null }; error: unknown }) => {
      if (error) return setPhase("failed")
      setDashboard(getRoleDashboard(data.user?.app_metadata?.role as Parameters<typeof getRoleDashboard>[0]))
      setPhase(type === "recovery" ? "new-password" : type === "email_change" ? "email-changed" : "confirmed")
    })
  }, [params])

  if (phase === "checking") return <p role="status" className="text-sm text-black/60">Checking your link…</p>
  if (phase === "new-password") return <NewPassword onSaved={() => setPhase("password-saved")} />

  if (phase === "failed") {
    return (
      <div className="space-y-6">
        <div className="flex items-start gap-3">
          <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-700" aria-hidden="true" />
          <p role="alert">This link has expired or was already used. Links work once, for a limited time.</p>
        </div>
        <p className="text-sm text-black/70">Confirming a new account? Enter your email for a fresh link.</p>
        <ResendConfirmation />
        <p className="text-sm text-black/70">
          Resetting your password? Use “Forgot password?” on the <Link href="/login" className="underline underline-offset-4">sign-in page</Link>.
        </p>
      </div>
    )
  }

  const done = {
    confirmed: { title: "Email confirmed", text: "Your account is ready.", cta: "Go to your dashboard" },
    "email-changed": { title: "Link accepted", text: "If a link was also sent to your other address, open that one too. Then sign in with your new address.", cta: "Go to your dashboard" },
    "password-saved": { title: "Password saved", text: "You're signed in with your new password.", cta: "Go to your dashboard" },
  }[phase]

  return (
    <div role="status" className="space-y-6 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center border border-black">
        <CheckCircle className="h-6 w-6" aria-hidden="true" />
      </div>
      <div>
        <h2 className="text-2xl font-bold">{done.title}</h2>
        <p className="mt-2 text-black/60">{done.text}</p>
      </div>
      <Button asChild className="h-14 w-full rounded-none bg-black text-white hover:bg-black/90 font-mono text-sm uppercase tracking-widest">
        <Link href={dashboard}>{done.cta}</Link>
      </Button>
    </div>
  )
}

function NewPassword({ onSaved }: { onSaved: () => void }) {
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const check = validatePassword(password)

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) return setError(AUTH_ERRORS.PASSWORDS_MISMATCH)
    if (!check.isValid) return setError(AUTH_ERRORS.WEAK_PASSWORD)
    setBusy(true)
    const { error } = await createClient().auth.updateUser({ password })
    setBusy(false)
    if (error) return setError(error.message)
    onSaved()
  }

  return (
    <form onSubmit={save} className="space-y-6">
      <p>Choose a new password for your account.</p>
      {error && <p role="alert" className="border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      <div className="space-y-2">
        <Label htmlFor="new-password" className="font-mono text-xs uppercase tracking-widest text-black/60">New password</Label>
        <Input id="new-password" type="password" autoComplete="new-password" required value={password}
          onChange={(e) => setPassword(e.target.value)} aria-describedby="password-help"
          className="h-12 rounded-none border-black/20 font-mono focus:border-black" />
        {password && <p id="password-help" className="text-xs text-black/60">{check.isValid ? "Strong enough." : check.errors.join(" · ")}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm-password" className="font-mono text-xs uppercase tracking-widest text-black/60">Type it again</Label>
        <Input id="confirm-password" type="password" autoComplete="new-password" required value={confirm}
          onChange={(e) => setConfirm(e.target.value)} className="h-12 rounded-none border-black/20 font-mono focus:border-black" />
      </div>
      <Button type="submit" disabled={busy} className="h-14 w-full rounded-none bg-black text-white hover:bg-black/90 font-mono text-sm uppercase tracking-widest">
        {busy ? "Saving…" : "Save new password"}
      </Button>
    </form>
  )
}

export default function ConfirmPage() {
  return (
    <AuthFrame label="MEDSYNC" title="ALMOST THERE." subtitle="Checking the link from your email.">
      <Suspense fallback={<p className="text-sm text-black/60">Checking your link…</p>}>
        <ConfirmContent />
      </Suspense>
    </AuthFrame>
  )
}
