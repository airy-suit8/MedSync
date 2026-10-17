"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase"

// Sends a fresh sign-up confirmation email. Says the same thing whether or not the
// address has an account, so it can't be used to find out who is registered.
export default function ResendConfirmation() {
  const [email, setEmail] = useState("")
  const [sent, setSent] = useState(false)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  const resend = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError("")
    const { error } = await createClient().auth.resend({
      type: "signup",
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/verify-email` },
    })
    setBusy(false)
    if (error) setError(error.message)
    else setSent(true)
  }

  if (sent) {
    return <p role="status" className="border border-black p-4 text-sm">If that email has an account waiting for confirmation, a new link is on its way.</p>
  }

  return (
    <form onSubmit={resend} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="resend-email" className="font-mono text-xs uppercase tracking-widest text-black/60">Email</Label>
        <Input id="resend-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
          className="h-12 rounded-none border-black/20 font-mono focus:border-black" />
      </div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <Button type="submit" disabled={busy} className="h-14 w-full rounded-none bg-black text-white hover:bg-black/90 font-mono text-sm uppercase tracking-widest">
        {busy ? "Sending…" : "Send a new link"}
      </Button>
    </form>
  )
}
