"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CheckCircle, XCircle, Lock, ArrowLeft, Eye, EyeOff } from "lucide-react"
import Link from "next/link"
import Image from "next/image"

import { Suspense } from "react"

function ConfirmContent() {
  const [status, setStatus] = useState<'loading' | 'reset-password' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const handleConfirmation = async () => {
      const token = searchParams.get('token')
      const type = searchParams.get('type')

      if (!token) {
        setStatus('error')
        setMessage('Invalid confirmation link')
        return
      }

      try {
        const supabase = createClient()
        
        if (type === 'recovery') {
          // Password reset flow
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: token,
            type: 'recovery'
          })

          if (error) {
            setStatus('error')
            setMessage(error.message)
          } else {
            setStatus('reset-password')
            setMessage('Please enter your new password')
          }
        } else {
          // Email confirmation flow
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: token,
            type: 'signup'
          })

          if (error) {
            setStatus('error')
            setMessage(error.message)
          } else {
            setStatus('success')
            setMessage('Your email has been confirmed successfully!')
            setTimeout(() => {
              router.push('/login')
            }, 3000)
          }
        }
      } catch (error) {
        setStatus('error')
        setMessage('An unexpected error occurred')
      }
    }

    handleConfirmation()
  }, [searchParams, router])

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (password !== confirmPassword) {
      setMessage('Passwords do not match')
      return
    }

    if (password.length < 6) {
      setMessage('Password must be at least 6 characters')
      return
    }

    setIsSubmitting(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({
        password: password
      })

      if (error) {
        setMessage(error.message)
      } else {
        setStatus('success')
        setMessage('Password updated successfully!')
        setTimeout(() => {
          router.push('/login')
        }, 2000)
      }
    } catch (error) {
      setMessage('Failed to update password')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-medical-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Image src="/medi.png" alt="MedSync Logo" width={48} height={48} />
            <span className="text-3xl font-bold text-medical-navy ml-3">MedSync</span>
          </div>
          <p className="text-medical-gray-600">
            {status === 'reset-password' ? 'Reset Password' : 'Email Confirmation'}
          </p>
        </div>

        <Card className="border-medical-gray-200">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4">
              {status === 'loading' && (
                <Lock className="h-12 w-12 text-medical-primary animate-pulse" />
              )}
              {status === 'success' && (
                <CheckCircle className="h-12 w-12 text-medical-success" />
              )}
              {status === 'error' && (
                <XCircle className="h-12 w-12 text-medical-error" />
              )}
              {status === 'reset-password' && (
                <Lock className="h-12 w-12 text-medical-primary" />
              )}
            </div>
            <CardTitle className="text-medical-navy">
              {status === 'loading' && 'Processing...'}
              {status === 'success' && 'Success!'}
              {status === 'error' && 'Error'}
              {status === 'reset-password' && 'Set New Password'}
            </CardTitle>
            <CardDescription className="text-medical-gray-600">
              {message}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {status === 'reset-password' && (
              <form onSubmit={handlePasswordReset} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-medical-navy">New Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="border-medical-gray-300 focus:border-medical-primary pr-10"
                      placeholder="Enter new password"
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 text-medical-gray-600 hover:text-medical-primary"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-medical-navy">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="border-medical-gray-300 focus:border-medical-primary"
                    placeholder="Confirm new password"
                    required
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full bg-medical-primary hover:bg-medical-primary-dark text-white"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Updating...' : 'Update Password'}
                </Button>
              </form>
            )}
            
            {status === 'success' && (
              <div className="text-center">
                <p className="text-sm text-medical-gray-600 mb-4">
                  Redirecting to login...
                </p>
                <Link href="/login">
                  <Button className="w-full bg-medical-primary hover:bg-medical-primary-dark text-white">
                    Continue to Login
                  </Button>
                </Link>
              </div>
            )}
            
            {status === 'error' && (
              <div className="space-y-3">
                <Link href="/reset-password">
                  <Button className="w-full bg-medical-primary hover:bg-medical-primary-dark text-white">
                    Request New Link
                  </Button>
                </Link>
                <Link href="/login">
                  <Button variant="outline" className="w-full border-medical-gray-300 text-medical-gray-600 hover:bg-medical-gray-50">
                    Back to Login
                  </Button>
                </Link>
              </div>
            )}

            <div className="text-center pt-4">
              <Link href="/" className="inline-flex items-center text-sm text-medical-gray-600 hover:text-medical-primary">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to Home
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function ConfirmPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Lock className="h-12 w-12 text-medical-primary animate-pulse" />
      </div>
    }>
      <ConfirmContent />
    </Suspense>
  )
}
