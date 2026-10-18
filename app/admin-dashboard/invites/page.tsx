"use client"

import type React from "react"
import { useCallback, useEffect, useState } from "react"
import { format, parseISO } from "date-fns"
import { Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import DashboardShell from "@/components/medical/common/DashboardShell"
import { createClient } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import { codeStatus, type SignupCode } from "@/lib/admin"

const LABEL = "font-mono text-[11px] uppercase tracking-widest text-black/60"
const FIELD = "h-12 rounded-none border-black/20 focus:border-black"
const STATUS_TEXT = { open: "Open", used: "Used", expired: "Expired", revoked: "Revoked" }

export default function InvitesPage() {
  return (
    <DashboardShell role="admin" label="INVITE CODES" title="Invite codes"
      intro="Give a code to a doctor or lab whose registration you've checked. They enter it when signing up and are active as soon as they confirm their email.">
      {() => <Invites />}
    </DashboardShell>
  )
}

function Invites() {
  const [codes, setCodes] = useState<SignupCode[] | null>(null)
  const [error, setError] = useState("")
  const [showAll, setShowAll] = useState(false)
  const [created, setCreated] = useState<string[]>([])
  const [form, setForm] = useState({ role: "doctor", count: "1", email: "", days: "14", note: "" })
  const [busy, setBusy] = useState(false)
  const { toast } = useToast()

  const load = useCallback(async () => {
    const { data, error } = await createClient().rpc("admin_list_signup_codes")
    if (error) return setError(error.message)
    setCodes(data || [])
  }, [])

  useEffect(() => { load() }, [load])

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const email = form.email.trim()
    const { data, error } = await createClient().rpc("admin_create_signup_codes", {
      p_role: form.role, p_count: email ? 1 : Number(form.count), p_email: email || null, p_days: Number(form.days), p_note: form.note.trim() || null,
    })
    setBusy(false)
    if (error) return toast({ title: "Couldn't make the codes", description: error.message, variant: "destructive" })
    setCreated(data || [])
    setForm((f) => ({ ...f, email: "", note: "" }))
    load()
  }

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast({ title: `${what} copied` })
    } catch {
      toast({ title: "Couldn't copy", description: "Select the code and copy it by hand.", variant: "destructive" })
    }
  }

  const revoke = async (code: string) => {
    const { error } = await createClient().rpc("admin_revoke_signup_code", { p_code: code })
    if (error) return toast({ title: "Couldn't revoke the code", description: error.message, variant: "destructive" })
    toast({ title: "Code revoked", description: "Nobody can sign up with it now." })
    load()
  }

  const signupUrl = typeof window === "undefined" ? "/signup" : `${window.location.origin}/signup`
  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }))
  const shown = (codes || []).filter((c) => showAll || codeStatus(c) === "open")

  return (
    <div className="grid gap-12 lg:grid-cols-12">
      <section aria-labelledby="new-codes" className="space-y-6 lg:col-span-5">
        <h2 id="new-codes" className="text-xl font-bold tracking-tight">Make codes</h2>
        <form onSubmit={create} className="space-y-5">
          <fieldset>
            <legend className={`${LABEL} mb-2`}>For</legend>
            <div className="grid grid-cols-2 gap-px border border-black/10 bg-black/10">
              {[["doctor", "Doctors"], ["lab", "Labs"]].map(([value, label]) => (
                <label key={value} className="cursor-pointer bg-white p-3 text-center font-mono text-xs uppercase tracking-widest has-[:checked]:bg-black has-[:checked]:text-white has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-black">
                  <input type="radio" name="role" value={value} checked={form.role === value} onChange={set("role")} className="sr-only" />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="space-y-2">
            <Label htmlFor="invite-email" className={LABEL}>Only for this email (optional)</Label>
            <Input id="invite-email" type="email" value={form.email} onChange={set("email")} placeholder="doctor@hospital.in" className={FIELD} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="invite-count" className={LABEL}>How many</Label>
              <Input id="invite-count" type="number" min={1} max={50} required value={form.email.trim() ? "1" : form.count}
                disabled={!!form.email.trim()} onChange={set("count")} className={FIELD} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-days" className={LABEL}>Valid for</Label>
              <select id="invite-days" value={form.days} onChange={set("days")}
                className="h-12 w-full border border-black/20 bg-white px-3 text-sm focus:border-black focus:outline-none">
                {[7, 14, 30, 90].map((d) => <option key={d} value={d}>{d} days</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-note" className={LABEL}>Note (for you)</Label>
            <Input id="invite-note" value={form.note} onChange={set("note")} maxLength={200} placeholder="e.g. City Hospital, radiology team" className={FIELD} />
          </div>
          <Button type="submit" disabled={busy} className="h-12 w-full rounded-none bg-black text-white hover:bg-black/90 font-mono text-xs uppercase tracking-widest">
            {busy ? "Making…" : "Make codes"}
          </Button>
        </form>

        {created.length > 0 && (
          <div role="status" className="space-y-3 border border-black p-5">
            <p className="font-bold">New {created.length === 1 ? "code" : "codes"}</p>
            <p className="text-sm text-black/70">Send each one with the sign-up link: <span className="font-mono">{signupUrl}</span></p>
            <ul className="space-y-2">
              {created.map((c) => (
                <li key={c} className="flex items-center justify-between gap-3 border border-black/10 px-3 py-2">
                  <span className="font-mono text-lg tracking-wider">{c}</span>
                  <button type="button" onClick={() => copy(c, "Code")} aria-label={`Copy ${c}`} className="p-2 hover:bg-black/5">
                    <Copy className="h-4 w-4" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
            {created.length > 1 && (
              <Button type="button" variant="outline" onClick={() => copy(created.join("\n"), "Codes")}
                className="h-10 rounded-none border-black font-mono text-xs uppercase tracking-widest">
                Copy all
              </Button>
            )}
          </div>
        )}
      </section>

      <section aria-labelledby="all-codes" className="space-y-4 lg:col-span-7">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h2 id="all-codes" className="text-xl font-bold tracking-tight">{showAll ? "All codes" : "Open codes"}</h2>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} className="h-4 w-4 accent-black" />
            Show used, expired and revoked
          </label>
        </div>
        {error && <p role="alert" className="border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
        {!codes ? (
          <p className="text-sm text-black/60">Loading…</p>
        ) : shown.length === 0 ? (
          <p className="border border-dashed border-black/20 p-6 text-sm text-black/60">No {showAll ? "" : "open "}codes yet.</p>
        ) : (
          <ul className="divide-y divide-black/10 border-y border-black/10">
            {shown.map((c) => {
              const status = codeStatus(c)
              return (
                <li key={c.code} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-4">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="font-mono tracking-wider">{c.code}</span>
                      <span className="border border-black/20 px-1.5 font-mono text-[10px] uppercase">{c.role}</span>
                      <span className={`border px-1.5 font-mono text-[10px] uppercase ${status === "open" ? "border-black" : "border-black/20 text-black/60"}`}>{STATUS_TEXT[status]}</span>
                    </p>
                    <p className="mt-1 text-sm text-black/70">
                      {status === "used"
                        ? `Used by ${c.used_by_name || c.used_by_email || "an account"}${c.used_at ? ` on ${format(parseISO(c.used_at), "d MMM yyyy")}` : ""}`
                        : `${c.email ? `Only for ${c.email}` : "Anyone"} · expires ${format(parseISO(c.expires_at), "d MMM yyyy")}`}
                      {c.note ? ` · ${c.note}` : ""}
                    </p>
                  </div>
                  {status === "open" && (
                    <div className="flex gap-2">
                      <button type="button" onClick={() => copy(c.code, "Code")} aria-label={`Copy ${c.code}`} className="p-2 hover:bg-black/5">
                        <Copy className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <Button type="button" variant="outline" onClick={() => revoke(c.code)}
                        className="h-9 rounded-none border-black/30 px-4 font-mono text-[11px] uppercase tracking-widest">
                        Revoke
                      </Button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
