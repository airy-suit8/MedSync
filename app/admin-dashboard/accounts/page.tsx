"use client"

import { Suspense, useCallback, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { format, parseISO } from "date-fns"
import { Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import DashboardShell from "@/components/medical/common/DashboardShell"
import ReviewActions from "@/components/admin/ReviewActions"
import { createClient } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import { accountStatus, dueForDeletion, STATUS_LABEL, type Account } from "@/lib/admin"

type RoleFilter = "all" | Account["role"]
const ROLE_FILTERS: [RoleFilter, string][] = [["all", "All"], ["patient", "Patients"], ["doctor", "Doctors"], ["lab", "Labs"], ["admin", "Admins"]]
const STATUS_STYLE = { closed: "border-black/40 bg-black/[0.04] text-black/60", verified: "border-black", pending: "border-amber-700 text-amber-800", turned_down: "border-red-700 text-red-800", active: "border-black/20" }
type Show = "all" | "unconfirmed" | "closed"

export default function AccountsPage() {
  return (
    <DashboardShell role="admin" label="ACCOUNTS" title="Accounts"
      intro="Everyone with a MedSync account. Confirm an email that never arrived, approve or withdraw a doctor or lab, and handle closed accounts.">
      {() => (
        <Suspense fallback={<p className="text-sm text-black/60">Loading…</p>}>
          <Accounts />
        </Suspense>
      )}
    </DashboardShell>
  )
}

function Accounts() {
  const params = useSearchParams()
  const [accounts, setAccounts] = useState<Account[] | null>(null)
  const [error, setError] = useState("")
  const [role, setRole] = useState<RoleFilter>((params.get("role") as RoleFilter) || "all")
  const [show, setShow] = useState<Show>((["unconfirmed", "closed"].includes(params.get("show") || "") ? params.get("show") : "all") as Show)
  const [query, setQuery] = useState("")
  const { toast } = useToast()

  const load = useCallback(async () => {
    const { data, error } = await createClient().rpc("admin_list_accounts")
    if (error) return setError(error.message)
    setAccounts(data || [])
  }, [])

  useEffect(() => { load() }, [load])

  const confirmEmail = async (a: Account) => {
    const { error } = await createClient().rpc("admin_confirm_email", { p_user: a.id })
    if (error) return toast({ title: "Couldn't confirm the email", description: error.message, variant: "destructive" })
    toast({ title: "Email confirmed", description: `${a.name || a.email} can sign in now.` })
    load()
  }

  if (error) return <p role="alert" className="border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>
  if (!accounts) return <p className="text-sm text-black/60">Loading…</p>

  const q = query.trim().toLowerCase()
  const shown = accounts.filter((a) =>
    (role === "all" || a.role === role) &&
    (show === "all" || (show === "unconfirmed" && !a.email_confirmed) || (show === "closed" && !!a.closed_at)) &&
    (!q || [a.name, a.email, a.short_id, a.license_number].some((s) => s?.toLowerCase().includes(q))))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-px border border-black/10 bg-black/10" role="group" aria-label="Show">
        {ROLE_FILTERS.map(([key, label]) => (
          <button key={key} type="button" onClick={() => setRole(key)} aria-pressed={role === key}
            className={`flex-1 px-4 py-3 font-mono text-xs uppercase tracking-widest ${role === key ? "bg-black text-white" : "bg-white hover:bg-black/[0.03]"}`}>
            {label} ({key === "all" ? accounts.length : accounts.filter((a) => a.role === key).length})
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="relative min-w-0 flex-1 basis-72">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-black/50" aria-hidden="true" />
          <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search accounts"
            placeholder="Search by name, email, ID or registration number" className="h-12 rounded-none border-black/20 pl-11 focus:border-black" />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <span className="font-mono text-[11px] uppercase tracking-widest text-black/60">Show</span>
          <select value={show} onChange={(e) => setShow(e.target.value as Show)}
            className="h-12 border border-black/20 bg-white px-3 text-sm focus:border-black focus:outline-none">
            <option value="all">Everyone</option>
            <option value="unconfirmed">Email not confirmed</option>
            <option value="closed">Closed accounts</option>
          </select>
        </label>
      </div>

      <p className="font-mono text-xs uppercase text-black/60">Showing {shown.length} of {accounts.length}</p>

      {shown.length === 0 ? (
        <p className="border border-dashed border-black/20 p-8 text-sm text-black/60">No accounts match.</p>
      ) : (
        <ul className="divide-y divide-black/10 border-y border-black/10">
          {shown.map((a) => {
            const status = accountStatus(a)
            return (
              <li key={a.id} className="space-y-3 py-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="font-bold">{a.name || "No name"}</span>
                      <span className="border border-black/20 px-1.5 font-mono text-[10px] uppercase">{a.role}</span>
                      <span className={`border px-1.5 font-mono text-[10px] uppercase ${STATUS_STYLE[status]}`}>{STATUS_LABEL[status]}</span>
                      {!a.email_confirmed && <span className="border border-amber-700 px-1.5 font-mono text-[10px] uppercase text-amber-800">Email not confirmed</span>}
                    </p>
                    <p className="mt-1 truncate text-sm text-black/70">{a.email}{a.short_id ? ` · ID ${a.short_id}` : ""}</p>
                    <p className="mt-0.5 font-mono text-xs uppercase text-black/60">
                      {a.created_at ? `Joined ${format(parseISO(a.created_at), "d MMM yyyy")}` : ""}
                      {` · last sign-in ${a.last_sign_in_at ? format(parseISO(a.last_sign_in_at), "d MMM yyyy") : "never"}`}
                      {a.invite_code ? ` · invite ${a.invite_code}` : ""}
                    </p>
                    {(a.role === "doctor" || a.role === "lab") && (
                      <p className="mt-1 text-sm text-black/70">
                        Reg. no. {a.license_number || "not given"}
                        {a.medical_council ? ` (${a.medical_council})` : ""}
                        {a.qualification ? ` · ${a.qualification}` : ""}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!a.email_confirmed && (
                      <Button type="button" variant="outline" onClick={() => confirmEmail(a)}
                        className="h-10 rounded-none border-black/30 px-5 font-mono text-xs uppercase tracking-widest">
                        Confirm email
                      </Button>
                    )}
                  </div>
                </div>
                {a.closed_at
                  ? <ClosedAccount account={a} onDone={load} />
                  : (a.role === "doctor" || a.role === "lab") && <ReviewActions account={a} onDone={load} />}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

// A closed account: when it closed, how long its records stay, and what an admin can do.
function ClosedAccount({ account: a, onDone }: { account: Account; onDone: () => void }) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const { toast } = useToast()
  const due = dueForDeletion(a)
  const day = (iso: string | null) => (iso ? format(parseISO(iso), "d MMM yyyy") : "")

  const reopen = async () => {
    setBusy(true)
    const { error } = await createClient().rpc("admin_reopen_account", { p_user: a.id })
    setBusy(false)
    if (error) return toast({ title: "Couldn't reopen the account", description: error.message, variant: "destructive" })
    toast({ title: "Account reopened", description: `${a.name || a.email} can sign in again.` })
    onDone()
  }

  const purge = async () => {
    setBusy(true)
    const res = await fetch("/api/admin/purge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: a.id }) })
    const body = await res.json().catch(() => ({}))
    setBusy(false)
    setConfirming(false)
    if (!res.ok) return toast({ title: "Couldn't delete the account", description: body.error || "Try again.", variant: "destructive" })
    toast({
      title: "Account deleted for good",
      description: body.fileErrors?.length ? `Some files could not be removed: ${body.fileErrors.join("; ")}` : `${body.filesRemoved} files removed.`,
    })
    onDone()
  }

  return (
    <div className="space-y-3 border-l-2 border-black/30 pl-4">
      <p className="text-sm text-black/70">
        Closed {day(a.closed_at)}.{" "}
        {a.role === "patient"
          ? due ? "The retention period is over: the account and its records can be deleted." : `Medical records are kept until ${day(a.delete_after)}.`
          : "Their reviews and prescriptions stay in their patients' records."}
      </p>
      {confirming ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-bold text-red-800">Delete this account, its records and its files for good?</p>
          <Button type="button" onClick={purge} disabled={busy} className="h-10 rounded-none bg-red-700 px-5 font-mono text-xs uppercase tracking-widest text-white hover:bg-red-800">
            {busy ? "Deleting…" : "Delete permanently"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setConfirming(false)} className="h-10 rounded-none px-5 font-mono text-xs uppercase tracking-widest">Cancel</Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={reopen} disabled={busy} className="h-10 rounded-none border-black/30 px-5 font-mono text-xs uppercase tracking-widest">
            Reopen
          </Button>
          {due && (
            <Button type="button" variant="outline" onClick={() => setConfirming(true)} className="h-10 rounded-none border-red-700 px-5 font-mono text-xs uppercase tracking-widest text-red-800">
              Delete permanently
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
