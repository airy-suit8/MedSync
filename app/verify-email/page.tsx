"use client"

import { Suspense, useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ArrowRight, Check, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import AuthFrame from "@/components/auth/AuthFrame"
import ResendConfirmation from "@/components/auth/ResendConfirmation"
import { createClient } from "@/lib/supabase"
import { getRoleDashboard } from "@/lib/auth-utils"

// Where the sign-up confirmation email lands. The email links to Supabase's confirm URL
// (supabase/templates/confirmation.html), which confirms the address the moment it is
// opened and then redirects here:
//   ?code=…            confirmed. In the browser that signed up, the client also signs in
//                      with the code; on another browser or device it can't, which is fine.
//   ?error=… / #error= the link expired or was already used: send a new one.
//   nothing            opened directly: say where the link is.
type Role = "doctor" | "patient" | "lab"
type State =
  | { kind: "checking" }
  | { kind: "error"; expired: boolean }
  | { kind: "confirmed"; role: Role | null; signedIn: boolean; verified?: boolean }
  | { kind: "inbox" }

const FRAME: Record<State["kind"], { title: string; subtitle: string }> = {
  checking: { title: "CHECKING.", subtitle: "Reading the link from your email." },
  error: { title: "LINK EXPIRED.", subtitle: "Confirmation links work once, for a limited time." },
  confirmed: { title: "YOU’RE CONFIRMED.", subtitle: "Your email address is verified." },
  inbox: { title: "CHECK YOUR INBOX.", subtitle: "We sent you a link to confirm your email." },
}

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const [state, setState] = useState<State>({ kind: "checking" })

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1))
    if (searchParams.get("error") || hash.get("error")) {
      setState({ kind: "error", expired: (searchParams.get("error_code") || hash.get("error_code")) === "otp_expired" })
      return
    }
    const fromLink = !!(searchParams.get("code") || hash.get("access_token"))
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }: { data: { user: { id: string; app_metadata?: { role?: string } } | null } }) => {
      const role = (user?.app_metadata?.role as Role | undefined) || null
      if (!user) return setState(fromLink ? { kind: "confirmed", role: null, signedIn: false } : { kind: "inbox" })
      // A doctor or lab with an invite code is verified already.
      let verified: boolean | undefined
      if (role === "doctor" || role === "lab") {
        const { data } = await supabase.from("profiles").select("verified").eq("id", user.id).maybeSingle()
        verified = data?.verified === true
      }
      setState({ kind: "confirmed", role, signedIn: true, verified })
    })
  }, [searchParams])

  return (
    <AuthFrame label="EMAIL" title={FRAME[state.kind].title} subtitle={FRAME[state.kind].subtitle}>
      {state.kind === "checking" && <p role="status" className="text-sm text-black/60">Checking your link…</p>}
      {state.kind === "confirmed" && <Confirmed role={state.role} signedIn={state.signedIn} verified={state.verified} />}
      {state.kind === "error" && (
        <div className="space-y-6">
          <p role="alert" className="flex items-start gap-3">
            <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-700" aria-hidden="true" />
            {state.expired ? "This link has expired." : "This link has already been used or isn't valid."} Enter your email and we&apos;ll send a new one.
          </p>
          <ResendConfirmation />
          <SignInHint text="Already confirmed?" />
        </div>
      )}
      {state.kind === "inbox" && (
        <div className="space-y-6">
          <p className="text-black/70">
            Open the email from MedSync and press <strong className="text-black">Confirm email</strong>. It works on any device.
            Not there? Check your spam folder, or send a new link.
          </p>
          <ResendConfirmation />
          <SignInHint text="Already confirmed?" />
        </div>
      )}
    </AuthFrame>
  )
}

// What's done and what's next, so a new account knows where it stands.
function Confirmed({ role, signedIn, verified }: { role: Role | null; signedIn: boolean; verified?: boolean }) {
  const steps: { label: string; detail?: string; done: boolean }[] = [
    { label: "Create your account", done: true },
    { label: "Confirm your email", done: true },
    { label: "Sign in", detail: signedIn ? undefined : "Use the email and password you signed up with.", done: signedIn },
  ]
  if (role === "doctor" || role === "lab") {
    steps.push({
      label: "Registration check",
      detail: verified
        ? "Done: your invite code verified your account."
        : role === "doctor"
          ? "An admin checks your medical registration number. Until it's verified, patients can't find you and you can't schedule appointments."
          : "An admin checks your lab registration number. Until it's verified, you can't upload reports.",
      done: !!verified,
    })
  } else if (role === "patient") {
    steps.push({ label: "Choose a doctor", detail: "Find doctors by what they treat and send a consultation request.", done: false })
  }
  const next = steps.findIndex((s) => !s.done)

  return (
    <div role="status" className="space-y-8">
      <ol className="divide-y divide-black/10 border-y border-black/10">
        {steps.map((s, i) => (
          <li key={s.label} className="flex items-start gap-4 py-4">
            <span className="w-6 pt-0.5 font-mono text-xs text-black/50">{String(i + 1).padStart(2, "0")}</span>
            <span className="min-w-0 flex-1">
              <span className={`block font-bold ${s.done ? "text-black/45" : ""}`}>{s.label}</span>
              {s.detail && <span className="mt-1 block text-sm text-black/60">{s.detail}</span>}
            </span>
            <span aria-label={s.done ? "Done" : i === next ? "Next" : "Later"}
              className={`flex h-6 w-6 shrink-0 items-center justify-center border ${s.done ? "border-black bg-black text-white" : i === next ? "border-black" : "border-black/20"}`}>
              {s.done ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : i === next ? <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /> : null}
            </span>
          </li>
        ))}
      </ol>

      {role === null && (
        <p className="text-sm text-black/60">Doctors and labs: after you sign in, we check your registration number before patients can find you.</p>
      )}

      <div className="space-y-3">
        <Button asChild className="h-14 w-full rounded-none bg-black text-white hover:bg-black/90 font-mono text-sm uppercase tracking-widest">
          <Link href={signedIn ? getRoleDashboard(role ?? undefined) : "/login"}>{signedIn ? "Go to your dashboard" : "Sign in"}</Link>
        </Button>
        {signedIn && role === "doctor" && (
          <Button asChild variant="outline" className="h-12 w-full rounded-none border-black font-mono text-xs uppercase tracking-widest">
            <Link href="/doctor-dashboard/profile">Fill in your public profile</Link>
          </Button>
        )}
        {signedIn && role === "patient" && (
          <Button asChild variant="outline" className="h-12 w-full rounded-none border-black font-mono text-xs uppercase tracking-widest">
            <Link href="/patient-dashboard/doctors">Find a doctor</Link>
          </Button>
        )}
      </div>
    </div>
  )
}

function SignInHint({ text }: { text: string }) {
  return (
    <p className="text-center font-mono text-xs uppercase tracking-wide text-black/60">
      {text} <Link href="/login" className="border-b border-black/30 text-black hover:border-black">Sign in</Link>
    </p>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <AuthFrame label="EMAIL" title={FRAME.checking.title} subtitle={FRAME.checking.subtitle}>
        <p className="text-sm text-black/60">Checking your link…</p>
      </AuthFrame>
    }>
      <VerifyEmailContent />
    </Suspense>
  )
}
