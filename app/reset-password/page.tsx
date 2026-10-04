"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Lock, CheckCircle, AlertCircle, Eye, EyeOff } from "lucide-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import { validatePassword, parseAuthError, AUTH_ERRORS, AUTH_SUCCESS } from "@/lib/auth-utils"

export default function ResetPasswordPage() {
  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: "",
  })
  const [loading, setLoading] = useState(false)
  const [isHydrated, setIsHydrated] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [passwordValidation, setPasswordValidation] = useState({
    isValid: false,
    score: 0,
    feedback: "",
    errors: [] as string[],
  })
  const router = useRouter()

  useEffect(() => {
    // Check if user is authenticated (they should be after clicking reset link)
    const checkAuth = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setError((currentError) => currentError || AUTH_ERRORS.INVALID_RESET_LINK)
      }
    }

    checkAuth()
  }, [])

  useEffect(() => setIsHydrated(true), [])

  const handlePasswordChange = (password: string) => {
    setFormData((current) => ({ ...current, password }))
    setPasswordValidation(validatePassword(password))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError(AUTH_ERRORS.PASSWORDS_MISMATCH)
      setLoading(false)
      return
    }

    // Validate password strength
    if (!passwordValidation.isValid) {
      setError(AUTH_ERRORS.WEAK_PASSWORD)
      setLoading(false)
      return
    }

    try {
      const supabase = createClient()

      const { error } = await supabase.auth.updateUser({
        password: formData.password
      })

      if (error) throw error

      setSuccess(true)

      // Redirect to login after 3 seconds
      setTimeout(() => {
        router.push("/login")
      }, 3000)
    } catch (error: any) {
      setError(parseAuthError(error))
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Card className="border-black/10">
            <CardContent className="text-center py-12">
              <CheckCircle className="h-16 w-16 mx-auto mb-4" />
              <h2 className="text-3xl font-bold mb-2">Password Updated!</h2>
              <p className="text-black/60 mb-6">
                Your password has been successfully updated. Redirecting to login...
              </p>
              <Link href="/login">
                <Button className="bg-black hover:bg-black/90">
                  Go to Login →
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header - Virgil Abloh Style */}
        <div className="mb-12">
          <Link href="/login" className="inline-flex items-center space-x-2 text-black hover:text-black/60 mb-8 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-mono uppercase tracking-wide">Login</span>
          </Link>

          <div className="mb-2">
            <span className="text-xs font-mono tracking-widest text-black/40 uppercase">
               &quot;PASSWORD RESET&quot;
            </span>
          </div>
          <h1 className="text-5xl font-bold tracking-tight mb-4">
            New Password
          </h1>
          <p className="text-black/60 text-lg">
            Create a strong password
          </p>
        </div>

        <Card className="border-black/10">
          <CardHeader className="space-y-1 pb-8">
            <CardTitle className="text-2xl font-bold">Reset Password</CardTitle>
            <CardDescription className="text-black/60">
              Enter your new password below
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form data-testid="reset-password-form" data-hydrated={isHydrated} onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-black/5 border border-black/10 text-black px-4 py-3 text-sm flex items-start space-x-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-mono uppercase tracking-wide text-black/60">
                  New Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => handlePasswordChange(e.target.value)}
                    required
                    className="border-black/20 focus:border-black h-12 pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {formData.password && (
                  <div className="mt-3">
                    <div className="flex space-x-1 mb-2">
                      {[1, 2, 3, 4, 5].map((level) => (
                        <div
                          key={level}
                          className={`h-1 flex-1 rounded ${level <= passwordValidation.score
                              ? passwordValidation.score < 3
                                ? 'bg-red-500'
                                : passwordValidation.score < 4
                                  ? 'bg-yellow-500'
                                  : 'bg-green-500'
                              : 'bg-black/10'
                            }`}
                        />
                      ))}
                    </div>
                    <p className={`text-xs ${passwordValidation.score < 3 ? 'text-red-600' :
                        passwordValidation.score < 4 ? 'text-yellow-600' : 'text-green-600'
                      }`}>
                      {passwordValidation.feedback}
                    </p>
                    {passwordValidation.errors.length > 0 && (
                      <ul className="mt-2 text-xs text-black/60 space-y-1">
                        {passwordValidation.errors.map((err, idx) => (
                          <li key={idx}>• {err}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-sm font-mono uppercase tracking-wide text-black/60">
                  Confirm Password
                </Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData((current) => ({ ...current, confirmPassword: e.target.value }))}
                    required
                    className="border-black/20 focus:border-black h-12 pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-black hover:bg-black/90 text-white h-12 font-medium"
                disabled={loading}
              >
                {loading ? "UPDATING..." : "UPDATE PASSWORD →"}
              </Button>
            </form>

            <div className="mt-8 pt-6 border-t border-black/10 text-center">
              <p className="text-sm text-black/60">
                Remember your password?{" "}
                <Link href="/login" className="text-black font-medium hover:underline">
                  Sign in
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
