"use client"

import type React from "react"
import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { format, parseISO } from "date-fns"
import { Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import DashboardShell from "@/components/medical/common/DashboardShell"
import DoctorCard from "@/components/medical/DoctorCard"
import EndCareButton from "@/components/medical/EndCareButton"
import { createClient } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import { matchesDoctor, type DirectoryDoctor } from "@/lib/doctor-search"

type CareLink = { doctor_id: string; assigned_at: string | null }
type Pending = { id: string; doctor_id: string; appointment_date: string; start_time: string | null; symptoms: string | null }

const LABEL = "font-mono text-[11px] uppercase tracking-widest text-black/60"

export default function PatientDoctorsPage() {
  return (
    <DashboardShell
      role="patient"
      label="MY DOCTORS"
      title="Doctors"
      intro="See who looks after you, and find a doctor for anything new. Pick by what they treat; they reply to your request."
    >
      {(user) => <Doctors patientId={user.id} />}
    </DashboardShell>
  )
}

function Doctors({ patientId }: { patientId: string }) {
  const [links, setLinks] = useState<CareLink[]>([])
  const [pending, setPending] = useState<Pending[]>([])
  const [doctors, setDoctors] = useState<DirectoryDoctor[]>([])
  const [query, setQuery] = useState("")
  const [requestingId, setRequestingId] = useState<string | null>(null)
  const { toast } = useToast()

  const load = useCallback(async () => {
    const supabase = createClient()
    const [{ data: linkRows }, { data: pendingRows }, { data: doctorRows }] = await Promise.all([
      supabase.from("doctor_patient_assignments").select("doctor_id, assigned_at").eq("patient_id", patientId).eq("is_active", true),
      supabase.from("appointments").select("id, doctor_id, appointment_date, start_time, symptoms")
        .eq("patient_id", patientId).eq("status", "requested").order("appointment_date", { ascending: true }),
      supabase.from("profile_directory").select("id, name, specialty, expertise, share_before, qualification, license_number, medical_council").eq("role", "doctor").order("name"),
    ])
    setLinks(linkRows || [])
    setPending(pendingRows || [])
    setDoctors(doctorRows || [])
  }, [patientId])

  useEffect(() => { load() }, [load])

  const byId = new Map(doctors.map((d) => [d.id, d]))
  const linkedIds = new Set(links.map((l) => l.doctor_id))
  const pendingIds = new Set(pending.map((p) => p.doctor_id))
  const results = doctors.filter((d) => matchesDoctor(d, query))
  const nameOf = (id: string) => byId.get(id)?.name || "Doctor"

  const withdraw = async (id: string) => {
    const { error } = await createClient().rpc("withdraw_consultation_request", { p_appointment_id: id })
    if (error) {
      toast({ title: "Could not withdraw the request", description: error.message, variant: "destructive" })
      return
    }
    toast({ title: "Request withdrawn" })
    load()
  }

  return (
    <div className="space-y-16">
      <section aria-labelledby="my-doctors">
        <h2 id="my-doctors" className="mb-2 text-xl font-bold tracking-tight">Your doctors ({links.length})</h2>
        <p className="mb-6 text-sm text-black/60">Each doctor here can see all of your reports. Ending care removes their access; your records stay.</p>
        {links.length === 0 ? (
          <p className="border border-dashed border-black/20 p-6 text-sm text-black/60">No doctors yet. Find one below and send a request.</p>
        ) : (
          <ul className="divide-y divide-black/10 border-y border-black/10">
            {links.map((l) => (
              <li key={l.doctor_id} className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-bold">{nameOf(l.doctor_id)}</p>
                  <p className="font-mono text-xs text-black/60">
                    {byId.get(l.doctor_id)?.specialty || "General practice"}
                    {l.assigned_at && ` · since ${format(parseISO(l.assigned_at), "d MMM yyyy")}`}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="ghost" asChild className="rounded-none font-mono text-xs uppercase tracking-widest">
                    <Link href="/patient-dashboard/chat">Message</Link>
                  </Button>
                  <EndCareButton otherId={l.doctor_id} otherName={nameOf(l.doctor_id)} role="patient" onEnded={load} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {pending.length > 0 && (
        <section aria-labelledby="waiting">
          <h2 id="waiting" className="mb-6 text-xl font-bold tracking-tight">Waiting for a reply ({pending.length})</h2>
          <ul className="divide-y divide-black/10 border-y border-black/10">
            {pending.map((p) => (
              <li key={p.id} className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-bold">{nameOf(p.doctor_id)}</p>
                  <p className="font-mono text-xs text-black/60">
                    {format(parseISO(p.appointment_date), "EEE d MMM yyyy")}{p.start_time && ` · ${p.start_time.slice(0, 5)}`}
                  </p>
                  {p.symptoms && <p className="mt-1 max-w-xl text-sm text-black/60">“{p.symptoms}”</p>}
                </div>
                <Button variant="outline" onClick={() => withdraw(p.id)} className="rounded-none border-black/30 font-mono text-xs uppercase tracking-widest">
                  Withdraw
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="find">
        <h2 id="find" className="mb-6 text-xl font-bold tracking-tight">Find a doctor</h2>
        <div className="relative mb-8 max-w-xl">
          <Label htmlFor="doctor-search" className="sr-only">Search doctors</Label>
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-black/55" aria-hidden="true" />
          <Input
            id="doctor-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name, specialty or problem, e.g. fracture"
            className="h-12 rounded-none border-black/20 pl-11 focus:border-black"
          />
        </div>

        {results.length === 0 ? (
          <p className="text-sm text-black/60">No doctors match “{query}”. Try a broader word, like the body part or specialty.</p>
        ) : (
          <div className="grid gap-px border border-black/10 bg-black/10 md:grid-cols-2 xl:grid-cols-3">
            {results.map((doctor) => (
              <DoctorCard key={doctor.id} doctor={doctor}>
                {linkedIds.has(doctor.id) ? (
                  <p className={LABEL}>Your doctor</p>
                ) : pendingIds.has(doctor.id) ? (
                  <p className={LABEL}>Request sent</p>
                ) : requestingId === doctor.id ? (
                  <RequestForm doctor={doctor} onDone={(sent) => { setRequestingId(null); if (sent) load() }} />
                ) : (
                  <Button onClick={() => setRequestingId(doctor.id)} className="w-full rounded-none bg-black text-white hover:bg-black/90 font-mono text-xs uppercase tracking-widest">
                    Request consultation
                  </Button>
                )}
              </DoctorCard>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function RequestForm({ doctor, onDone }: { doctor: DirectoryDoctor; onDone: (sent: boolean) => void }) {
  const today = format(new Date(), "yyyy-MM-dd")
  const [date, setDate] = useState(today)
  const [time, setTime] = useState("10:00")
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const { toast } = useToast()

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const { error } = await createClient().rpc("request_consultation", {
      p_doctor_id: doctor.id, p_date: date, p_time: time, p_reason: reason,
    })
    setBusy(false)
    if (error) {
      toast({ title: "Could not send the request", description: error.message, variant: "destructive" })
      return
    }
    toast({ title: "Request sent", description: `${doctor.name || "The doctor"} will reply. Once they accept, they can see your reports.` })
    onDone(true)
  }

  const id = (field: string) => `${field}-${doctor.id}`

  return (
    <form onSubmit={send} className="space-y-4 border-t border-black/10 pt-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor={id("date")} className={LABEL}>Date</Label>
          <Input id={id("date")} type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} required className="h-11 rounded-none border-black/20" />
        </div>
        <div className="space-y-1">
          <Label htmlFor={id("time")} className={LABEL}>Time</Label>
          <Input id={id("time")} type="time" value={time} onChange={(e) => setTime(e.target.value)} required className="h-11 rounded-none border-black/20" />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor={id("reason")} className={LABEL}>What do you need help with?</Label>
        <Textarea id={id("reason")} value={reason} onChange={(e) => setReason(e.target.value)} required maxLength={1000} rows={3}
          placeholder="e.g. Cold and cough for a week; want a second opinion"
          className="rounded-none border-black/20 placeholder:text-black/55" />
      </div>
      <p className="text-xs text-black/60">If they accept, this doctor can see all of your reports.</p>
      <div className="flex gap-2">
        <Button type="submit" disabled={busy} className="flex-1 rounded-none bg-black text-white hover:bg-black/90 font-mono text-xs uppercase tracking-widest">
          {busy ? "Sending…" : "Send request"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => onDone(false)} disabled={busy} className="rounded-none font-mono text-xs uppercase tracking-widest">
          Cancel
        </Button>
      </div>
    </form>
  )
}
