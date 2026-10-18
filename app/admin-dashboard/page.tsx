"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import DashboardShell from "@/components/medical/common/DashboardShell"
import { createClient } from "@/lib/supabase"
import type { Overview } from "@/lib/admin"

export default function AdminOverviewPage() {
  return (
    <DashboardShell role="admin" label="ADMIN" title="Overview"
      intro="Approve doctors and labs, help people who are stuck, and hand out invite codes. Admins see account details, never medical records.">
      {() => <AdminOverview />}
    </DashboardShell>
  )
}

function AdminOverview() {
  const [data, setData] = useState<Overview | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    createClient().rpc("admin_overview").then(({ data, error }: { data: Overview | null; error: { message: string } | null }) => {
      if (error) setError(error.message)
      else setData(data)
    })
  }, [])

  if (error) return <p role="alert" className="border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>
  if (!data) return <p className="text-sm text-black/60">Loading…</p>

  const stats: [string, number, string | null][] = [
    ["Waiting for approval", data.pending, "/admin-dashboard/approvals"],
    ["Doctors", data.doctors, "/admin-dashboard/accounts?role=doctor"],
    ["Labs", data.labs, "/admin-dashboard/accounts?role=lab"],
    ["Patients", data.patients, "/admin-dashboard/accounts?role=patient"],
    ["Emails not confirmed", data.unconfirmed, "/admin-dashboard/accounts?show=unconfirmed"],
    ["Open invite codes", data.open_invites, "/admin-dashboard/invites"],
    ["Reports this week", data.reports_week, null],
    ["AI couldn't read (week)", data.ai_failed_week, null],
  ]

  const attention: { text: string; href?: string; action?: string }[] = []
  if (data.pending) attention.push({ text: `${data.pending} ${data.pending === 1 ? "doctor or lab is" : "doctors and labs are"} waiting for approval.`, href: "/admin-dashboard/approvals", action: "Review" })
  if (data.unconfirmed) attention.push({ text: `${data.unconfirmed} ${data.unconfirmed === 1 ? "account hasn't" : "accounts haven't"} confirmed their email. If the email never arrived, you can confirm it for them.`, href: "/admin-dashboard/accounts?show=unconfirmed", action: "See who" })
  if (data.turned_down) attention.push({ text: `${data.turned_down} turned down, waiting for them to fix their details.`, href: "/admin-dashboard/approvals" , action: "See them" })
  if (data.ai_failed_week) attention.push({ text: `The AI couldn't read ${data.ai_failed_week} ${data.ai_failed_week === 1 ? "report" : "reports"} this week. Doctors can run it again from the report; if this keeps happening, check the ML service.` })

  return (
    <div className="space-y-12">
      <section aria-labelledby="attention" className="space-y-4">
        <h2 id="attention" className="text-xl font-bold tracking-tight">Needs attention</h2>
        {attention.length === 0 ? (
          <p className="border border-dashed border-black/20 p-6 text-sm text-black/60">Nothing right now.</p>
        ) : (
          <ul className="divide-y divide-black/10 border-y border-black/10">
            {attention.map((a) => (
              <li key={a.text} className="flex flex-wrap items-center justify-between gap-4 py-4">
                <p className="max-w-2xl">{a.text}</p>
                {a.href && (
                  <Link href={a.href} className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest underline underline-offset-4">
                    {a.action} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <dl className="grid grid-cols-2 gap-px border border-black/10 bg-black/10 lg:grid-cols-4">
        {stats.map(([label, value, href]) => {
          const body = (
            <>
              <dt className="font-mono text-[11px] uppercase tracking-widest text-black/60">{label}</dt>
              <dd className="mt-2 text-4xl font-bold tracking-tight">{value}</dd>
            </>
          )
          return href
            ? <Link key={label} href={href} className="bg-white p-6 hover:bg-black/[0.02]">{body}</Link>
            : <div key={label} className="bg-white p-6">{body}</div>
        })}
      </dl>
    </div>
  )
}
