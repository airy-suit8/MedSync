"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle, XCircle, Mail, ArrowLeft, Loader2 } from "lucide-react"
import Link from "next/link"
import Image from "next/image"

import { Suspense } from "react"

function VerifyEmailContent() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const verifyEmail = async () => {
      try {
        const supabase = createClient()

        // Supabase handles email verification automatically via the email link
        // Just check if user is now authenticated
        const { data: { user }, error } = await supabase.auth.getUser()

        if (error || !user) {
          setStatus('error')
          setMessage('Verification failed. The link may be invalid or expired.')
          return
        }

        setStatus('success')
        setMessage('Your email has been verified successfully!')

        // Redirect to login after 3 seconds
        setTimeout(() => {
          router.push('/login')
        }, 3000)
      } catch (error) {
        setStatus('error')
        setMessage('An unexpected error occurred during verification.')
      }
    }

    verifyEmail()
  }, [router])

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-4">
            <Image src="/medi.png" alt="MedSync Logo" width={48} height={48} />
            <span className="text-3xl font-bold ml-3">MedSync</span>
          </div>
          <div className="mb-2">
            <span className="text-xs font-mono tracking-widest text-black/55 uppercase">
               &quot;EMAIL VERIFICATION&quot;
            </span>
          </div>
        </div>

        <Card className="border-black/10">
          <CardHeader className="text-center pb-8">
            <div className="mx-auto mb-4">
              {status === 'loading' && (
                <Loader2 className="h-12 w-12 animate-spin text-black/55" />
              )}
              {status === 'success' && (
                <CheckCircle className="h-12 w-12" />
              )}
              {status === 'error' && (
                <XCircle className="h-12 w-12 text-red-500" />
              )}
            </div>
            <CardTitle className="text-2xl font-bold">
              {status === 'loading' && 'Verifying Your Email...'}
              {status === 'success' && 'Email Verified!'}
              {status === 'error' && 'Verification Failed'}
            </CardTitle>
            <CardDescription className="text-black/60 mt-2">
              {status === 'loading' && 'Please wait while we verify your email address.'}
              {status === 'success' && 'Redirecting to login...'}
              {status === 'error' && message}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {status === 'success' && (
              <div className="text-center">
                <p className="text-sm text-black/60 mb-4">
                  You will be redirected automatically in a few seconds.
                </p>
                <Button className="w-full bg-black hover:bg-black/90 text-white h-12" asChild>
                  <Link href="/login">
                    Continue to Login →
                  </Link>
                </Button>
              </div>
            )}

            {status === 'error' && (
              <div className="space-y-3">
                <Button className="w-full bg-black hover:bg-black/90 text-white h-12" asChild>
                  <Link href="/signup">
                    Sign Up Again →
                  </Link>
                </Button>
                <Button variant="outline" className="w-full border-black/20 h-12" asChild>
                  <Link href="/login">
                    Back to Login
                  </Link>
                </Button>
              </div>
            )}

            <div className="text-center pt-4">
              <Link href="/" className="inline-flex items-center text-sm text-black/60 hover:text-black font-mono">
                <ArrowLeft className="h-4 w-4 mr-1" />
                HOME
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-black/55" />
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  )
}
