"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Mail, Lock, CheckCircle, AlertCircle, ArrowRight } from "lucide-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase"
import { validateEmail, parseAuthError, getRoleDashboard, AUTH_ERRORS } from "@/lib/auth-utils"
import AuthFrame from "@/components/auth/AuthFrame"

const INPUT_CLASS = "bg-transparent border-black/20 focus:border-black h-12 rounded-none font-mono placeholder:text-black/55 transition-all pl-10"

export default function LoginPage() {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  })
  const [loading, setLoading] = useState(false)
  const [isHydrated, setIsHydrated] = useState(false)
  const [error, setError] = useState("")
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [resetEmail, setResetEmail] = useState("")
  const [resetLoading, setResetLoading] = useState(false)
  const [resetSuccess, setResetSuccess] = useState(false)
  const [resetError, setResetError] = useState("")
  const [resend, setResend] = useState<"idle" | "sending" | "sent">("idle")

  useEffect(() => setIsHydrated(true), [])

  // Signing in before confirming the email: send a fresh confirmation link to that address.
  const resendConfirmation = async () => {
    setResend("sending")
    const { error } = await createClient().auth.resend({
      type: "signup",
      email: formData.email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/verify-email` },
    })
    if (error) {
      setResend("idle")
      setError(parseAuthError(error))
    } else setResend("sent")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    if (!validateEmail(formData.email)) {
      setError("Please enter a valid email address")
      setLoading(false)
      return
    }

    try {
      const supabase = createClient()
      const { data, error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      })

      if (error) throw error

      // The password grant already returns the verified user. Avoid a second
      // network round trip to /auth/v1/user before entering the dashboard.
      const user = data.user
      const role = user?.app_metadata?.role

      // Wait for cookie flush
      await new Promise(resolve => setTimeout(resolve, 500))

      window.location.assign(getRoleDashboard(role))
    } catch (error: any) {
      setError(parseAuthError(error))
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setResetLoading(true)
    setResetError("")
    setResetSuccess(false)

    if (!validateEmail(resetEmail)) {
      setResetError("Please enter a valid email address")
      setResetLoading(false)
      return
    }

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      })

      if (error) throw error
      setResetSuccess(true)
      setResetEmail("")
    } catch (error: any) {
      setResetError(parseAuthError(error))
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <AuthFrame label="SIGN IN" title="SIGN IN." subtitle="Welcome back to MedSync.">
      <form data-testid="login-form" data-hydrated={isHydrated} onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div role="alert" className="bg-red-50 border border-red-100 text-red-700 px-4 py-3 text-sm flex items-start space-x-2">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}
        {error === AUTH_ERRORS.EMAIL_NOT_VERIFIED && (
          resend === "sent" ? (
            <p role="status" className="border border-black px-4 py-3 text-sm">
              A new link is on its way to {formData.email.trim()}. Opening it confirms your email on any device; then sign in here.
            </p>
          ) : (
            <Button type="button" variant="outline" onClick={resendConfirmation} disabled={resend === "sending"}
              className="h-12 w-full rounded-none border-black font-mono text-xs uppercase tracking-widest">
              {resend === "sending" ? "Sending…" : "Send a new confirmation link"}
            </Button>
          )
        )}

        <div className="space-y-2">
          <Label htmlFor="email" className="text-xs font-mono uppercase tracking-widest text-black/60">
            Email
          </Label>
          <div className="relative group">
            <Input
              id="email"
              type="email"
              autoComplete="email"
              maxLength={254}
              placeholder="you@example.com"
              value={formData.email}
              onChange={(e) => setFormData((current) => ({ ...current, email: e.target.value }))}
              required
              className={INPUT_CLASS}
            />
            <Mail className="absolute left-3 top-4 h-4 w-4 text-black/40 group-focus-within:text-black transition-colors" aria-hidden="true" />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label htmlFor="password" className="text-xs font-mono uppercase tracking-widest text-black/60">
              Password
            </Label>
            <Button
              type="button"
              variant="link"
              className="text-[11px] font-mono uppercase tracking-wide text-black/60 hover:text-black p-0 h-auto"
              onClick={() => setShowForgotPassword(true)}
            >
              Forgot password?
            </Button>
          </div>
          <div className="relative group">
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={formData.password}
              onChange={(e) => setFormData((current) => ({ ...current, password: e.target.value }))}
              required
              className={INPUT_CLASS}
            />
            <Lock className="absolute left-3 top-4 h-4 w-4 text-black/40 group-focus-within:text-black transition-colors" aria-hidden="true" />
          </div>
        </div>

        <Button
          type="submit"
          className="w-full bg-black hover:bg-black/90 text-white h-14 rounded-none text-sm font-mono uppercase tracking-widest flex items-center justify-between px-6 group"
          disabled={loading}
        >
          <span>{loading ? "SIGNING IN…" : "SIGN IN"}</span>
          <ArrowRight className="h-4 w-4 opacity-60 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
        </Button>
      </form>

      <div className="mt-8 pt-6 border-t border-black/10 text-center">
        <p className="text-xs font-mono text-black/60 uppercase tracking-wide">
          New here?{" "}
          <Link href="/signup" className="text-black border-b border-black/30 hover:border-black pb-0.5 transition-all">
            Create account
          </Link>
        </p>
      </div>

      <Dialog open={showForgotPassword} onOpenChange={setShowForgotPassword}>
        <DialogContent className="sm:max-w-md border-black bg-white p-0 overflow-hidden rounded-none shadow-none">
          <div className="bg-black text-white p-6">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold font-mono uppercase tracking-widest flex items-center space-x-2">
                <Lock className="h-4 w-4" aria-hidden="true" />
                <span>Reset password</span>
              </DialogTitle>
              <DialogDescription className="text-white/70 text-sm">
                We&apos;ll email you a link to choose a new password.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="p-8">
            {resetSuccess ? (
              <div className="text-center py-4">
                <div className="w-14 h-14 border border-black flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="h-6 w-6" aria-hidden="true" />
                </div>
                <h3 className="text-lg font-bold mb-2">Check your email</h3>
                <p className="text-black/60 mb-6 text-sm">
                  We&apos;ve sent a reset link to your inbox.
                </p>
                <Button onClick={() => setShowForgotPassword(false)} className="w-full bg-black h-12 rounded-none font-mono text-xs uppercase tracking-widest">
                  Close
                </Button>
              </div>
            ) : (
              <form data-testid="forgot-password-form" data-hydrated={isHydrated} onSubmit={handleForgotPassword} className="space-y-6">
                {resetError && (
                  <div role="alert" className="bg-red-50 border border-red-100 text-red-700 px-4 py-3 text-sm flex items-start space-x-2">
                    <AlertCircle className="h-4 w-4 mt-0.5" aria-hidden="true" />
                    <span>{resetError}</span>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="reset-email" className="text-xs font-mono uppercase tracking-widest text-black/60">
                    Email
                  </Label>
                  <Input
                    id="reset-email"
                    type="email"
                    autoComplete="email"
                    maxLength={254}
                    placeholder="you@example.com"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    required
                    className="rounded-none border-black/20 h-11 font-mono text-sm placeholder:text-black/55"
                  />
                </div>

                <div className="flex space-x-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowForgotPassword(false)}
                    className="flex-1 rounded-none border-black/20 font-mono text-xs uppercase tracking-widest"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-black rounded-none font-mono text-xs uppercase tracking-widest hover:bg-black/90"
                    disabled={resetLoading}
                  >
                    {resetLoading ? "Sending…" : "Send link"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AuthFrame>
  )
}
