"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
import { Label } from "@/components/ui/label"
import { CheckCircle, AlertCircle, ArrowRight } from "lucide-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import { validateEmail, validatePassword, parseAuthError, AUTH_ERRORS } from "@/lib/auth-utils"
import AuthFrame from "@/components/auth/AuthFrame"
import { MEDICAL_COUNCILS } from "@/lib/constants"

const INPUT_CLASS = "bg-transparent border-black/20 focus:border-black h-12 rounded-none font-mono placeholder:text-black/55"
const LABEL_CLASS = "text-xs font-mono uppercase tracking-widest text-black/60"
const SELECT_CLASS = "h-12 w-full border border-black/20 bg-white px-3 font-mono text-sm focus:border-black focus:outline-none"

const ROLES = [
  { value: "patient", label: "Patient", hint: "See your reports and talk to your doctor" },
  { value: "doctor", label: "Doctor", hint: "Review scans and manage patients" },
  { value: "lab", label: "Lab Technician", hint: "Upload scans and results" },
]

export default function SignUpPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "",
    licenseNumber: "",
    medicalCouncil: "",
    qualification: "",
    inviteCode: "",
  })
  const [loading, setLoading] = useState(false)
  const [isHydrated, setIsHydrated] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState<null | { invited: boolean }>(null)
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

    const needsLicense = formData.role === "doctor" || formData.role === "lab"
    if (needsLicense && !formData.licenseNumber.trim()) {
      setError(AUTH_ERRORS.MISSING_LICENSE)
      setLoading(false)
      return
    }
    if (formData.role === "doctor" && (!formData.medicalCouncil || !formData.qualification.trim())) {
      setError("Choose your medical council and enter your qualification.")
      setLoading(false)
      return
    }
    const inviteCode = needsLicense ? formData.inviteCode.trim() : ""

    try {
      const supabase = createClient()

      // Check an invite code first, so a typo doesn't quietly create an account that waits
      // for an admin.
      if (inviteCode) {
        const { data: valid, error: codeError } = await supabase.rpc("signup_code_is_valid", {
          p_code: inviteCode, p_role: formData.role, p_email: formData.email.trim(),
        })
        if (codeError) throw codeError
        if (!valid) {
          setError(`This invite code won't work. It may be mistyped, already used, expired, or meant for another email or for a ${formData.role === "lab" ? "doctor" : "lab"} account.`)
          return
        }
      }

      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            name: formData.name,
            role: formData.role,
            ...(needsLicense && { license_number: formData.licenseNumber.trim() }),
            ...(formData.role === "doctor" && { medical_council: formData.medicalCouncil, qualification: formData.qualification.trim() }),
            ...(inviteCode && { invite_code: inviteCode }),
          },
          emailRedirectTo: `${window.location.origin}/verify-email`
        },
      })

      if (error) throw error

      // For an email that is already registered, Supabase returns a user with no
      // identities and sends no email (so nobody can probe which emails exist). Say so
      // here instead of "Account created" followed by an email that never comes.
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        setError("An account with this email already exists. Sign in, or use “Forgot password?” on the sign-in page.")
        return
      }

      setSuccess({ invited: !!inviteCode })

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

  if (success) {
    return (
      <AuthFrame label="CREATE ACCOUNT" title="SIGN UP." subtitle="One account for patients, doctors and labs.">
        <div role="status" className="text-center py-4">
          <div className="w-14 h-14 border border-black flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="h-6 w-6" aria-hidden="true" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Account Created!</h2>
          <p className="text-black/60 mb-2">
            Check your email and click the verification link to activate your account.
          </p>
          {(formData.role === "doctor" || formData.role === "lab") && (
            <p className="text-black/60 mb-2">
              {success.invited
                ? "Your invite code is accepted, so your account is ready as soon as you confirm."
                : "Then an admin checks your registration number. You'll get a notification when it's done."}
            </p>
          )}
          <p className="text-sm text-black/60 mb-8">Taking you to sign in…</p>
          <Button className="w-full bg-black hover:bg-black/90 text-white h-14 rounded-none text-sm font-mono uppercase tracking-widest" asChild>
            <Link href="/login">Go to sign in</Link>
          </Button>
        </div>
      </AuthFrame>
    )
  }

  return (
    <AuthFrame label="CREATE ACCOUNT" title="SIGN UP." subtitle="One account for patients, doctors and labs.">
      <form data-testid="signup-form" data-hydrated={isHydrated} onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div role="alert" className="bg-red-50 border border-red-100 text-red-700 px-4 py-3 text-sm flex items-start space-x-2">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <fieldset>
          <legend className={`${LABEL_CLASS} mb-3`}>I am a</legend>
          <div className="grid sm:grid-cols-3 gap-px bg-black/10 border border-black/10">
            {ROLES.map((role) => (
              <label
                key={role.value}
                data-testid={`signup-role-${role.value}`}
                className="group relative cursor-pointer bg-white p-4 transition-colors hover:bg-black/[0.03] has-[:checked]:bg-black has-[:checked]:text-white has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-black"
              >
                <input
                  type="radio"
                  name="role"
                  value={role.value}
                  checked={formData.role === role.value}
                  onChange={() => setFormData((current) => ({ ...current, role: role.value }))}
                  className="sr-only"
                />
                <span className="block text-sm font-bold uppercase tracking-wide">{role.label}</span>
                <span className="mt-1 block text-xs leading-snug text-black/60 group-has-[:checked]:text-white/75">{role.hint}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {formData.role === "doctor" && (
          <div className="space-y-2">
            <Label htmlFor="medicalCouncil" className={LABEL_CLASS}>Medical Council</Label>
            <select id="medicalCouncil" value={formData.medicalCouncil} required className={SELECT_CLASS}
              onChange={(e) => setFormData((current) => ({ ...current, medicalCouncil: e.target.value }))}>
              <option value="">Choose where you are registered</option>
              {MEDICAL_COUNCILS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}

        {(formData.role === "doctor" || formData.role === "lab") && (
          <div className="space-y-2">
            <Label htmlFor="licenseNumber" className={LABEL_CLASS}>
              {formData.role === "lab" ? "Lab Registration Number" : "Medical Registration Number"}
            </Label>
            <Input
              id="licenseNumber"
              type="text"
              value={formData.licenseNumber}
              onChange={(e) => setFormData((current) => ({ ...current, licenseNumber: e.target.value }))}
              maxLength={64}
              required
              aria-describedby="licenseHelp"
              className={INPUT_CLASS}
            />
            <p id="licenseHelp" className="text-xs text-black/60">
              {formData.role === "lab"
                ? "Your NABL accreditation or state lab registration number. Our team verifies it before you can upload reports or see patients."
                : "Your registration number with that council. Patients see it on your profile and prescriptions."}
            </p>
          </div>
        )}

        {formData.role === "doctor" && (
          <div className="space-y-2">
            <Label htmlFor="qualification" className={LABEL_CLASS}>Qualification</Label>
            <Input id="qualification" type="text" value={formData.qualification} maxLength={120} required
              placeholder="e.g. MBBS, MD (Radiology)" className={INPUT_CLASS}
              onChange={(e) => setFormData((current) => ({ ...current, qualification: e.target.value }))} />
          </div>
        )}

        {(formData.role === "doctor" || formData.role === "lab") && (
          <div className="space-y-2">
            <Label htmlFor="inviteCode" className={LABEL_CLASS}>Invite code (optional)</Label>
            <Input id="inviteCode" type="text" value={formData.inviteCode} maxLength={20} autoComplete="off"
              placeholder="XXXX-XXXX-XXXX" aria-describedby="inviteHelp" className={`${INPUT_CLASS} uppercase`}
              onChange={(e) => setFormData((current) => ({ ...current, inviteCode: e.target.value }))} />
            <p id="inviteHelp" className="text-xs text-black/60">
              From the MedSync team. With a code, your account is active as soon as you confirm your email.
              Without one, an admin checks your registration first.
            </p>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="name" className={LABEL_CLASS}>
            Full Name
          </Label>
          <Input
            id="name"
            type="text"
            autoComplete="name"
            value={formData.name}
            onChange={(e) => setFormData((current) => ({ ...current, name: e.target.value }))}
            required
            className={INPUT_CLASS}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email" className={LABEL_CLASS}>
            Email
          </Label>
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
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className={LABEL_CLASS}>
            Password
          </Label>
          <div className="relative">
            <PasswordInput
              id="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={formData.password}
              onChange={(e) => handlePasswordChange(e.target.value)}
              required
              aria-describedby={formData.password ? "passwordHelp" : undefined}
              className={INPUT_CLASS}
            />
          </div>
          {formData.password && (
            <div id="passwordHelp" className="mt-3">
              <div className="flex gap-1 mb-2" aria-hidden="true">
                {[1, 2, 3, 4, 5].map((level) => (
                  <div
                    key={level}
                    className={`h-1 flex-1 ${level <= passwordValidation.score
                        ? passwordValidation.score < 3
                          ? 'bg-red-500'
                          : passwordValidation.score < 4
                            ? 'bg-yellow-500'
                            : 'bg-green-600'
                        : 'bg-black/10'
                      }`}
                  />
                ))}
              </div>
              <p className={`text-xs ${passwordValidation.score < 3 ? 'text-red-700' :
                  passwordValidation.score < 4 ? 'text-yellow-800' : 'text-green-700'
                }`}>
                {passwordValidation.feedback}
              </p>
              {passwordValidation.errors.length > 0 && (
                <ul className="mt-2 text-xs text-black/60 space-y-1">
                  {passwordValidation.errors.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <Button
          type="submit"
          className="w-full bg-black hover:bg-black/90 text-white h-14 rounded-none text-sm font-mono uppercase tracking-widest flex items-center justify-between px-6 group"
          disabled={loading}
        >
          <span>{loading ? "CREATING ACCOUNT…" : "CREATE ACCOUNT"}</span>
          <ArrowRight className="h-4 w-4 opacity-60 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
        </Button>
      </form>

      <div className="mt-8 pt-6 border-t border-black/10 text-center">
        <p className="text-xs font-mono text-black/60 uppercase tracking-wide">
          Already have an account?{" "}
          <Link href="/login" className="text-black border-b border-black/30 hover:border-black pb-0.5 transition-all">
            Sign in
          </Link>
        </p>
      </div>
    </AuthFrame>
  )
}
