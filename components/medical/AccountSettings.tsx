"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { format, parseISO } from "date-fns"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase"
import { CONTACT_EMAIL } from "@/lib/constants"

type Role = "patient" | "doctor" | "lab"
type Me = { name: string | null; email: string | null; short_id: string | null; created_at: string | null }

const WHAT_HAPPENS: Record<Role, string[]> = {
  patient: [
    "You're signed out and can't sign in again.",
    "Your doctors lose access to your records, and upcoming appointments are cancelled. They're told.",
    "Your phone number, address and emergency contact are deleted straight away.",
    "Your medical records (reports, scans, doctors' reviews, prescriptions and consultation notes) are kept for 3 years after your last report, consultation or prescription, as Indian medical record rules require. Then they're deleted for good.",
  ],
  doctor: [
    "You're signed out and can't sign in again.",
    "Patients can no longer find you. Your care of current patients ends and upcoming appointments are cancelled; they're told.",
    "Your phone number, address and public profile text are deleted straight away.",
    "Reviews and prescriptions you wrote stay in your patients' records, with your name and registration number.",
  ],
  lab: [
    "You're signed out and can't sign in again.",
    "Reports you uploaded stay in your patients' records.",
    "Your phone number and address are deleted straight away.",
  ],
}

// Account details, and closing the account (close_my_account). Shared by the patient,
// doctor and lab dashboards.
export default function AccountSettings({ userId, role }: { userId: string; role: Role }) {
  const [me, setMe] = useState<Me | null>(null)
  const [confirm, setConfirm] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()

  useEffect(() => {
    createClient().from("profiles").select("name, email, short_id, created_at").eq("id", userId).maybeSingle()
      .then(({ data }: { data: Me | null }) => setMe(data))
  }, [userId])

  const close = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError("")
    const supabase = createClient()
    const { data: deleteAfter, error } = await supabase.rpc("close_my_account")
    if (error) {
      setBusy(false)
      return setError(error.message)
    }
    await supabase.auth.signOut()
    const params = new URLSearchParams({ role })
    if (deleteAfter) params.set("until", String(deleteAfter).slice(0, 10))
    router.push(`/account-closed?${params}`)
  }

  const facts: [string, string | null | undefined][] = [
    ["Name", me?.name],
    ["Email", me?.email],
    [role === "patient" ? "Patient ID" : role === "doctor" ? "Doctor ID" : "Lab ID", me?.short_id],
    ["Member since", me?.created_at ? format(parseISO(me.created_at), "d MMM yyyy") : null],
  ]

  return (
    <div className="max-w-3xl space-y-12">
      <section aria-labelledby="details" className="space-y-4">
        <h2 id="details" className="text-xl font-bold tracking-tight">Your details</h2>
        <dl className="grid gap-px border border-black/10 bg-black/10 sm:grid-cols-2">
          {facts.map(([label, value]) => (
            <div key={label} className="bg-white p-4">
              <dt className="font-mono text-[11px] uppercase tracking-widest text-black/55">{label}</dt>
              <dd className="mt-1 break-words">{value || "—"}</dd>
            </div>
          ))}
        </dl>
        <p className="text-sm text-black/60">
          To see, correct or get a copy of your data, email{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="underline underline-offset-4">{CONTACT_EMAIL}</a>. We reply within 90 days.
        </p>
      </section>

      <section aria-labelledby="close" className="space-y-4 border border-red-700/40 p-5 sm:p-6">
        <h2 id="close" className="text-xl font-bold tracking-tight">Close your account</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-black/80">
          {WHAT_HAPPENS[role].map((line) => <li key={line}>{line}</li>)}
        </ul>
        <p className="text-sm text-black/60">
          Closed it by mistake? Email <a href={`mailto:${CONTACT_EMAIL}`} className="underline underline-offset-4">{CONTACT_EMAIL}</a> and we can reopen it.
        </p>
        <form onSubmit={close} className="space-y-3">
          <Label htmlFor="confirm-close" className="font-mono text-[11px] uppercase tracking-widest text-black/60">
            Type CLOSE to confirm
          </Label>
          <Input id="confirm-close" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off"
            className="h-12 max-w-xs rounded-none border-black/20 font-mono focus:border-black" />
          {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
          <Button type="submit" disabled={busy || confirm.trim().toUpperCase() !== "CLOSE"}
            className="h-12 rounded-none bg-red-700 px-6 font-mono text-xs uppercase tracking-widest text-white hover:bg-red-800">
            {busy ? "Closing…" : "Close my account"}
          </Button>
        </form>
      </section>
    </div>
  )
}
