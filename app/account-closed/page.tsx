"use client"

import { Suspense } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { format, parseISO } from "date-fns"
import { Button } from "@/components/ui/button"
import AuthFrame from "@/components/auth/AuthFrame"
import { CONTACT_EMAIL } from "@/lib/constants"

// Where someone lands after closing their account (AccountSettings).
function ClosedContent() {
  const params = useSearchParams()
  const until = params.get("until")
  const role = params.get("role")
  const untilDate = until && /^\d{4}-\d{2}-\d{2}$/.test(until) ? format(parseISO(until), "d MMMM yyyy") : null

  return (
    <div className="space-y-6">
      <p>You&apos;ve been signed out, and the account can no longer sign in.</p>
      {role === "patient" ? (
        <p className="text-black/70">
          {untilDate
            ? <>Your medical records are kept until <strong className="text-black">{untilDate}</strong>, as Indian medical record rules require, and then deleted for good.</>
            : <>Your medical records will be deleted.</>}
          {" "}Your contact details are already deleted.
        </p>
      ) : (
        <p className="text-black/70">Records you added stay in your patients&apos; records. Your contact details are deleted.</p>
      )}
      <p className="text-sm text-black/60">
        Closed it by mistake, or want a copy of your data? Email{" "}
        <a href={`mailto:${CONTACT_EMAIL}`} className="underline underline-offset-4">{CONTACT_EMAIL}</a>.
      </p>
      <Button asChild className="h-14 w-full rounded-none bg-black text-white hover:bg-black/90 font-mono text-sm uppercase tracking-widest">
        <Link href="/">Back to MedSync</Link>
      </Button>
    </div>
  )
}

export default function AccountClosedPage() {
  return (
    <AuthFrame label="ACCOUNT" title="ACCOUNT CLOSED." subtitle="Thank you for using MedSync.">
      <Suspense fallback={null}>
        <ClosedContent />
      </Suspense>
    </AuthFrame>
  )
}
