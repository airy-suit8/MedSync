"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, User, Mail, Lock, UserCheck, CheckCircle, AlertCircle } from "lucide-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import { validateEmail, validatePassword, parseAuthError, AUTH_SUCCESS, AUTH_ERRORS } from "@/lib/auth-utils"

export default function SignUpPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "",
    licenseNumber: "",
  })
  const [loading, setLoading] = useState(false)
  const [isHydrated, setIsHydrated] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [passwordValidation, setPasswordValidation] = useState({
    isValid: false,
    score: 0,
    feedback: "",
    errors: [] as string[],
  })
  const router = useRouter()

  useEffect(() => setIsHydrated(true), [])

  const handlePasswordChange = (password: string) => {
    setFormData((current) => ({ ...current, password }))
    setPasswordValidation(validatePassword(password))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    // Validation
    if (!formData.name.trim()) {
      setError(AUTH_ERRORS.MISSING_NAME)
      setLoading(false)
      return
    }

    if (!validateEmail(formData.email)) {
      setError(AUTH_ERRORS.INVALID_EMAIL)
      setLoading(false)
      return
    }

    if (!passwordValidation.isValid) {
      setError(AUTH_ERRORS.WEAK_PASSWORD)
      setLoading(false)
      return
    }

    if (!formData.role) {
      setError(AUTH_ERRORS.MISSING_ROLE)
      setLoading(false)
      return
    }

    if (formData.role === "doctor" && !formData.licenseNumber.trim()) {
      setError(AUTH_ERRORS.MISSING_LICENSE)
      setLoading(false)
      return
    }

    try {
      const supabase = createClient()

      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            name: formData.name,
            role: formData.role,
            ...(formData.role === "doctor" && { license_number: formData.licenseNumber.trim() }),
          },
          emailRedirectTo: `${window.location.origin}/verify-email`
        },
      })

      if (error) throw error

      setSuccess(true)

      // Redirect to login after 5 seconds
      setTimeout(() => {
        router.push("/login")
      }, 5000)
    } catch (error: any) {
      setError(parseAuthError(error))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header - Virgil Abloh Style */}
        <div className="mb-12">
          <Link href="/" className="inline-flex items-center space-x-2 text-black hover:text-black/60 mb-8 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-mono uppercase tracking-wide">Home</span>
          </Link>

          <div className="mb-2">
            <span className="text-xs font-mono tracking-widest text-black/55 uppercase">
               &quot;CREATE ACCOUNT&quot;
            </span>
          </div>
          <h1 className="text-5xl font-bold tracking-tight mb-4">
            Sign Up
          </h1>
          <p className="text-black/60 text-lg">
            Join the healthcare platform
          </p>
        </div>

        {success ? (
          <Card className="border-black/10">
            <CardHeader>
              <div className="text-center">
                <CheckCircle className="h-12 w-12 mx-auto mb-4" />
                <CardTitle className="text-2xl font-bold">Account Created!</CardTitle>
                <CardDescription className="text-black/60 mt-2">
                  Please check your email and click the verification link to activate your account.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <p className="text-sm text-black/60 mb-4">
                  Redirecting to login page...
                </p>
                <Button className="bg-black hover:bg-black/90" asChild>
                  <Link href="/login">
                    Go to Login →
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-black/10">
            <CardHeader className="space-y-1 pb-8">
              <CardTitle className="text-2xl font-bold">Create Account</CardTitle>
              <CardDescription className="text-black/60">
                Enter your details to get started
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form data-testid="signup-form" data-hydrated={isHydrated} onSubmit={handleSubmit} className="space-y-6">
                {error && (
                  <div className="bg-black/5 border border-black/10 text-black px-4 py-3 text-sm flex items-start space-x-2">
                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-mono uppercase tracking-wide text-black/60">
                    Full Name
                  </Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="John Doe"
                    value={formData.name}
                    onChange={(e) => setFormData((current) => ({ ...current, name: e.target.value }))}
                    required
                    className="border-black/20 focus:border-black h-12"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-mono uppercase tracking-wide text-black/60">
                    Email Address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    maxLength={254}
                    placeholder="your@email.com"
                    value={formData.email}
                    onChange={(e) => setFormData((current) => ({ ...current, email: e.target.value }))}
                    required
                    className="border-black/20 focus:border-black h-12"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-mono uppercase tracking-wide text-black/60">
                    Password
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => handlePasswordChange(e.target.value)}
                    required
                    className="border-black/20 focus:border-black h-12"
                  />
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
                  <Label className="text-sm font-mono uppercase tracking-wide text-black/60">
                    Role
                  </Label>
                  <select
                    aria-label="Role"
                    data-testid="signup-role-trigger"
                    value={formData.role}
                    onChange={(event) => setFormData((current) => ({ ...current, role: event.target.value }))}
                    className="flex h-12 w-full items-center justify-between rounded-md border border-black/20 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  >
                    <option value="">Select your role</option>
                    <option data-testid="signup-role-option-patient" value="patient">Patient</option>
                    <option data-testid="signup-role-option-doctor" value="doctor">Doctor</option>
                    <option data-testid="signup-role-option-lab" value="lab">Lab Technician</option>
                  </select>
                </div>

                {formData.role === "doctor" && (
                  <div className="space-y-2">
                    <Label htmlFor="licenseNumber" className="text-sm font-mono uppercase tracking-wide text-black/60">
                      Medical Registration Number
                    </Label>
                    <Input
                      id="licenseNumber"
                      type="text"
                      placeholder="State or National Medical Council number"
                      value={formData.licenseNumber}
                      onChange={(e) => setFormData((current) => ({ ...current, licenseNumber: e.target.value }))}
                      maxLength={64}
                      required
                      aria-describedby="licenseHelp"
                      className="border-black/20 focus:border-black h-12"
                    />
                    <p id="licenseHelp" className="text-xs text-black/60">
                      Our team verifies this before you can schedule appointments or see patients.
                    </p>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full bg-black hover:bg-black/90 text-white h-12 font-medium"
                  disabled={loading}
                >
                  {loading ? "CREATING ACCOUNT..." : "CREATE ACCOUNT →"}
                </Button>
              </form>

              <div className="mt-8 pt-6 border-t border-black/10 text-center">
                <p className="text-sm text-black/60">
                  Already have an account?{" "}
                  <Link href="/login" className="text-black font-medium hover:underline">
                    Sign in
                  </Link>
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
