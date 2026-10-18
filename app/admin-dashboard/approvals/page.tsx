"use client"

import { useCallback, useEffect, useState } from "react"
import { format, parseISO } from "date-fns"
import { ExternalLink } from "lucide-react"
import DashboardShell from "@/components/medical/common/DashboardShell"
import ReviewActions from "@/components/admin/ReviewActions"
import { createClient } from "@/lib/supabase"
import { accountStatus, NMC_REGISTER_URL, type Account } from "@/lib/admin"

export default function ApprovalsPage() {
  return (
    <DashboardShell role="admin" label="APPROVALS" title="Approvals"
      intro="Doctors and labs who signed up without an invite code. Check each registration number, then approve them or say what's wrong.">
      {() => <Approvals />}
    </DashboardShell>
  )
}

function Approvals() {
  const [accounts, setAccounts] = useState<Account[] | null>(null)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    const { data, error } = await createClient().rpc("admin_list_accounts")
    if (error) return setError(error.message)
    setAccounts((data || []).filter((a: Account) => (a.role === "doctor" || a.role === "lab") && !a.verified))
  }, [])

  useEffect(() => { load() }, [load])

  if (error) return <p role="alert" className="border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>
  if (!accounts) return <p className="text-sm text-black/60">Loading…</p>

  const waiting = accounts.filter((a) => accountStatus(a) === "pending")
  const turnedDown = accounts.filter((a) => accountStatus(a) === "turned_down")

  return (
    <div className="space-y-12">
      <p className="text-sm text-black/70">
        Doctors: search the number on the{" "}
        <a href={NMC_REGISTER_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline underline-offset-4">
          NMC&apos;s Indian Medical Register <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </a>{" "}
        or the State Medical Council&apos;s site, and check the name matches.
      </p>

      <Section title={`Waiting (${waiting.length})`} empty="Nobody is waiting." accounts={waiting} onDone={load} />
      {turnedDown.length > 0 && (
        <Section title={`Turned down (${turnedDown.length})`} empty="" accounts={turnedDown} onDone={load}
          hint="They see your reason and can fix their details; they come back to Waiting when they do." />
      )}
    </div>
  )
}

function Section({ title, empty, accounts, onDone, hint }: { title: string; empty: string; accounts: Account[]; onDone: () => void; hint?: string }) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-bold tracking-tight">{title}</h2>
        {hint && <p className="mt-1 text-sm text-black/60">{hint}</p>}
      </div>
      {accounts.length === 0 ? (
        <p className="border border-dashed border-black/20 p-6 text-sm text-black/60">{empty}</p>
      ) : (
        <ul className="space-y-4">
          {accounts.map((a) => (
            <li key={a.id} className="border border-black/10 bg-white p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-lg font-bold">{a.name || "No name"}</p>
                  <p className="truncate text-sm text-black/70">{a.email}</p>
                  <p className="mt-1 font-mono text-xs uppercase text-black/60">
                    {a.role === "lab" ? "Lab" : "Doctor"}
                    {a.created_at ? ` · signed up ${format(parseISO(a.created_at), "d MMM yyyy")}` : ""}
                    {a.email_confirmed ? "" : " · email not confirmed"}
                  </p>
                </div>
                <ReviewActions account={a} onDone={onDone} />
              </div>
              <dl className={`mt-5 grid gap-px border border-black/10 bg-black/10 ${a.role === "doctor" ? "sm:grid-cols-3" : ""}`}>
                <Fact label={a.role === "lab" ? "Lab registration no." : "Registration no."} value={a.license_number} mono />
                {a.role === "doctor" && <Fact label="Medical council" value={a.medical_council} />}
                {a.role === "doctor" && <Fact label="Qualification" value={a.qualification} />}
              </dl>
              {a.verification_note && (
                <p className="mt-4 border-l-2 border-red-700 bg-red-50 px-3 py-2 text-sm text-red-900">
                  <span className="font-mono text-[11px] uppercase tracking-widest">Your reason: </span>{a.verification_note}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function Fact({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div className="bg-white p-4">
      <dt className="font-mono text-[11px] uppercase tracking-widest text-black/55">{label}</dt>
      <dd className={`mt-1 ${mono ? "font-mono" : ""} ${value ? "" : "text-black/50"}`}>{value || "Not given"}</dd>
    </div>
  )
}
