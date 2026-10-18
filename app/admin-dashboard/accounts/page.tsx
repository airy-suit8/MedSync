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
import { accountStatus, STATUS_LABEL, type Account } from "@/lib/admin"

type RoleFilter = "all" | Account["role"]
const ROLE_FILTERS: [RoleFilter, string][] = [["all", "All"], ["patient", "Patients"], ["doctor", "Doctors"], ["lab", "Labs"], ["admin", "Admins"]]
const STATUS_STYLE = { verified: "border-black", pending: "border-amber-700 text-amber-800", turned_down: "border-red-700 text-red-800", active: "border-black/20" }

export default function AccountsPage() {
  return (
    <DashboardShell role="admin" label="ACCOUNTS" title="Accounts"
      intro="Everyone with a MedSync account. Confirm an email that never arrived, or approve or withdraw a doctor or lab.">
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
  const [unconfirmedOnly, setUnconfirmedOnly] = useState(params.get("show") === "unconfirmed")
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
    (!unconfirmedOnly || !a.email_confirmed) &&
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
          <input type="checkbox" checked={unconfirmedOnly} onChange={(e) => setUnconfirmedOnly(e.target.checked)} className="h-4 w-4 accent-black" />
          Only emails not confirmed
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
                {(a.role === "doctor" || a.role === "lab") && <ReviewActions account={a} onDone={load} />}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
