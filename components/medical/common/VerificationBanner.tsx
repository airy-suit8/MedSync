"use client"

import type React from "react"
import { useCallback, useEffect, useState } from "react"
import { ShieldAlert } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { MEDICAL_COUNCILS } from "@/lib/constants"

type Me = {
  id: string; verified: boolean; verification_note: string | null; verification_reviewed_at: string | null
  license_number: string | null; medical_council: string | null; qualification: string | null
}

const FIELD = "h-10 w-full border border-black/20 bg-white px-3 font-mono text-sm text-black focus:border-black focus:outline-none"

// Unverified doctors and labs can sign in but can't see patients (or schedule / upload)
// until an admin checks their registration number, unless they signed up with an invite
// code. If an admin turned them down, they see why, fix their details and ask again.
export default function VerificationBanner({ role = "doctor" }: { role?: "doctor" | "lab" }) {
  const [me, setMe] = useState<Me | null>(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ license_number: "", medical_council: "", qualification: "" })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from("profiles")
      .select("id, verified, verification_note, verification_reviewed_at, license_number, medical_council, qualification")
      .eq("id", user.id).maybeSingle()
    if (!data) return
    setMe(data)
    setForm({ license_number: data.license_number || "", medical_council: data.medical_council || "", qualification: data.qualification || "" })
  }, [])

  useEffect(() => { load() }, [load])

  if (!me || me.verified !== false) return null
  const turnedDown = !!me.verification_reviewed_at

  const resubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError("")
    const supabase = createClient()
    const details = role === "doctor"
      ? { license_number: form.license_number.trim(), medical_council: form.medical_council, qualification: form.qualification.trim() }
      : { license_number: form.license_number.trim() }
    const { error: saveError } = await supabase.from("profiles").update(details).eq("id", me.id)
    const { error: askError } = saveError ? { error: saveError } : await supabase.rpc("request_verification_review")
    setBusy(false)
    if (askError) return setError(askError.message)
    setEditing(false)
    load()
  }

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((current) => ({ ...current, [field]: e.target.value }))

  return (
    <div role="status" className={`flex items-start gap-3 border-b px-6 py-3 text-sm ${turnedDown ? "border-red-700/30 bg-red-50 text-red-900" : "border-amber-600/30 bg-amber-50 text-amber-900"}`}>
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {turnedDown ? (
          <p>
            <strong className="font-mono uppercase text-xs tracking-wide">Not verified.</strong>{" "}
            {me.verification_note} Fix your registration details below and ask to be checked again.
          </p>
        ) : (
          <p>
            <strong className="font-mono uppercase text-xs tracking-wide">Verification pending.</strong>{" "}
            {role === "lab"
              ? <>An admin is checking your lab registration number. Until then you can&apos;t upload reports or see patient records.</>
              : <>An admin is checking your medical registration number. Until then you can&apos;t schedule appointments or see patient records.</>}
          </p>
        )}

        {turnedDown && !editing && (
          <button type="button" onClick={() => setEditing(true)} className="mt-2 font-mono text-xs uppercase tracking-widest underline underline-offset-4">
            Fix my details
          </button>
        )}

        {editing && (
          <form onSubmit={resubmit} className="mt-3 grid max-w-3xl gap-3 sm:grid-cols-3">
            {role === "doctor" && (
              <label className="space-y-1">
                <span className="block font-mono text-[11px] uppercase tracking-widest">Medical council</span>
                <select value={form.medical_council} onChange={set("medical_council")} required className={FIELD}>
                  <option value="">Choose</option>
                  {MEDICAL_COUNCILS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
            )}
            <label className="space-y-1">
              <span className="block font-mono text-[11px] uppercase tracking-widest">Registration number</span>
              <input value={form.license_number} onChange={set("license_number")} required maxLength={64} className={FIELD} />
            </label>
            {role === "doctor" && (
              <label className="space-y-1">
                <span className="block font-mono text-[11px] uppercase tracking-widest">Qualification</span>
                <input value={form.qualification} onChange={set("qualification")} required maxLength={120} className={FIELD} />
              </label>
            )}
            {error && <p role="alert" className="sm:col-span-3 text-red-800">{error}</p>}
            <div className="flex gap-2 sm:col-span-3">
              <button type="submit" disabled={busy} className="h-10 bg-black px-5 font-mono text-xs uppercase tracking-widest text-white disabled:opacity-60">
                {busy ? "Sending…" : "Send for review"}
              </button>
              <button type="button" onClick={() => setEditing(false)} className="h-10 border border-black/30 px-5 font-mono text-xs uppercase tracking-widest">
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
