"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ArrowLeft, Mail, Lock, CheckCircle, AlertCircle, ArrowRight } from "lucide-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase"
import { validateEmail, parseAuthError, getRoleDashboard } from "@/lib/auth-utils"
import Image from "next/image"

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

  useEffect(() => setIsHydrated(true), [])

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
      const role = user?.app_metadata?.role || user?.user_metadata?.role
      
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
    <div className="min-h-screen bg-white relative overflow-hidden flex flex-col">
      {/* Grid Background */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.02]">
        <div className="h-full w-full" style={{
          backgroundImage: `linear-gradient(to right, black 1px, transparent 1px),
                           linear-gradient(to bottom, black 1px, transparent 1px)`,
          backgroundSize: '40px 40px'
        }} />
      </div>

      <div className="container mx-auto px-6 py-6 relative z-10 flex-1 flex flex-col">
        {/* Header */}
        <header className="flex justify-between items-center mb-8">
          <Link href="/" className="inline-flex items-center space-x-2 group">
            <div className="bg-black text-white p-1 rounded-sm group-hover:bg-black/80 transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </div>
            <span className="text-sm font-mono uppercase tracking-widest text-black/60 group-hover:text-black transition-colors">Return</span>
          </Link>
          <div className="flex items-center space-x-2 opacity-50">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
            <span className="text-[10px] font-mono uppercase tracking-widest">System Online</span>
          </div>
        </header>

        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-lg">
            {/* Label */}
            <div className="mb-6 flex items-center justify-between border-b border-black/10 pb-2">
              <span className="text-[10px] font-mono tracking-[0.2em] text-black/40 uppercase">
                 &quot;SECURE ENTRY&quot;
              </span>
              <span className="text-[10px] font-mono text-black/40">
                v2.0.25
              </span>
            </div>

            {/* Main Title */}
            <h1 className="text-6xl font-bold tracking-tighter mb-2">
              LOGIN.
            </h1>
            <p className="text-xl text-black/50 font-light mb-12 max-w-sm">
              Enter your credentials to access the medical network.
            </p>

            {/* Form Container */}
            <div className="bg-white border text-card-foreground shadow-sm border-black/10 relative">
              {/* Decorative Corner */}
              <div className="absolute -top-1 -right-1 w-4 h-4 border-t border-r border-black"></div>
              <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b border-l border-black"></div>

              <div className="p-8 lg:p-10">
                <form data-testid="login-form" data-hydrated={isHydrated} onSubmit={handleSubmit} className="space-y-6">
                  {error && (
                    <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 text-sm font-mono flex items-start space-x-2">
                      <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-xs font-mono uppercase tracking-widest text-black/60">
                      Email Identifier
                    </Label>
                    <div className="relative group">
                      <Input
                        id="email"
                        type="email"
                        maxLength={254}
                        placeholder="USER@MEDSYNC.COM"
                        value={formData.email}
                        onChange={(e) => setFormData((current) => ({ ...current, email: e.target.value }))}
                        required
                        className="bg-transparent border-black/20 focus:border-black h-12 rounded-none font-mono placeholder:text-black/20 transition-all pl-10"
                      />
                      <Mail className="absolute left-3 top-4 h-4 w-4 text-black/20 group-focus-within:text-black transition-colors" />
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
                        className="text-[10px] font-mono uppercase tracking-wide text-black/40 hover:text-black p-0 h-auto"
                        onClick={() => setShowForgotPassword(true)}
                      >
                        Reset Key?
                      </Button>
                    </div>
                    <div className="relative group">
                      <Input
                        id="password"
                        type="password"
                        placeholder="••••••••"
                        value={formData.password}
                        onChange={(e) => setFormData((current) => ({ ...current, password: e.target.value }))}
                        required
                        className="bg-transparent border-black/20 focus:border-black h-12 rounded-none font-mono placeholder:text-black/20 transition-all pl-10"
                      />
                      <Lock className="absolute left-3 top-4 h-4 w-4 text-black/20 group-focus-within:text-black transition-colors" />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-black hover:bg-black/90 text-white h-14 rounded-none text-sm font-mono uppercase tracking-widest flex items-center justify-between px-6 group"
                    disabled={loading}
                  >
                    <span>{loading ? "AUTHENTICATING..." : "INITIATE SESSION"}</span>
                    <ArrowRight className="h-4 w-4 opacity-50 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </form>

                <div className="mt-8 pt-6 border-t border-black/10 text-center">
                  <p className="text-xs font-mono text-black/40 uppercase tracking-wide">
                    New User?{" "}
                    <Link href="/signup" className="text-black border-b border-black/20 hover:border-black pb-0.5 transition-all">
                      Create Account
                    </Link>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal - Deconstructed */}
      <Dialog open={showForgotPassword} onOpenChange={setShowForgotPassword}>
        <DialogContent className="sm:max-w-md border-black bg-white p-0 overflow-hidden rounded-none shadow-none">
          <div className="bg-black text-white p-6">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold font-mono uppercase tracking-widest flex items-center space-x-2">
                <Lock className="h-4 w-4" />
                <span>Reset Access</span>
              </DialogTitle>
              <DialogDescription className="text-white/60 font-mono text-xs">
                Provide email for recovery procedure.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="p-8">
            {resetSuccess ? (
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-100">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="text-lg font-bold mb-2">Link Dispatched</h3>
                <p className="text-black/60 mb-6 text-sm">
                  Review your inbox for the recovery key.
                </p>
                <Button onClick={() => setShowForgotPassword(false)} className="w-full bg-black h-12 rounded-none font-mono text-xs uppercase tracking-widest">
                  Close Terminal
                </Button>
              </div>
            ) : (
              <form data-testid="forgot-password-form" data-hydrated={isHydrated} onSubmit={handleForgotPassword} className="space-y-6">
                {resetError && (
                  <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 text-xs font-mono flex items-start space-x-2">
                    <AlertCircle className="h-4 w-4 mt-0.5" />
                    <span>{resetError}</span>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="reset-email" className="text-xs font-mono uppercase tracking-widest text-black/60">
                    Email Address
                  </Label>
                  <Input
                    id="reset-email"
                    type="email"
                    maxLength={254}
                    placeholder="user@medsync.com"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    required
                    className="rounded-none border-black/20 h-11 font-mono text-sm"
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
                    {resetLoading ? "Processing..." : "Send Link"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
