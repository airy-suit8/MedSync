"use client"

import type React from "react"
import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import DashboardShell from "@/components/medical/common/DashboardShell"
import HealthTimeline from "@/components/medical/HealthTimeline"
import PrescriptionList from "@/components/medical/PrescriptionList"
import { createClient } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"

const LABEL = "font-mono text-[11px] uppercase tracking-widest text-black/60"
const FIELD = "rounded-none border-black/20 focus:border-black"
const SELECT = "h-11 w-full border border-black/20 bg-white px-3 text-sm focus:border-black focus:outline-none"
const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]

type Profile = {
  date_of_birth: string; gender: string; blood_type: string; height_cm: string; weight_kg: string
  allergies: string; current_medications: string; chronic_conditions: string
  emergency_contact: string; phone: string; address: string
}
const EMPTY: Profile = {
  date_of_birth: "", gender: "", blood_type: "", height_cm: "", weight_kg: "",
  allergies: "", current_medications: "", chronic_conditions: "", emergency_contact: "", phone: "", address: "",
}

export default function PatientHealthPage() {
  return (
    <DashboardShell role="patient" label="HEALTH RECORD" title="My health record"
      intro="Your doctors see this profile, so keep allergies and medicines up to date. Below is everything in your care, newest first.">
      {(user) => <HealthRecord patientId={user.id} />}
    </DashboardShell>
  )
}

function HealthRecord({ patientId }: { patientId: string }) {
  const [profile, setProfile] = useState<Profile>(EMPTY)
  const [doctorCount, setDoctorCount] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const [{ data }, { count }] = await Promise.all([
        supabase.from("profiles").select("date_of_birth, gender, blood_type, height_cm, weight_kg, allergies, current_medications, chronic_conditions, emergency_contact, phone, address")
          .eq("id", patientId).maybeSingle(),
        supabase.from("doctor_patient_assignments").select("id", { count: "exact", head: true }).eq("patient_id", patientId).eq("is_active", true),
      ])
      if (data) setProfile(Object.fromEntries(Object.keys(EMPTY).map((k) => [k, data[k] == null ? "" : String(data[k])])) as Profile)
      setDoctorCount(count ?? 0)
    }
    load()
  }, [patientId])

  const set = (field: keyof Profile) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setProfile((p) => ({ ...p, [field]: e.target.value }))

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const text = (v: string) => v.trim() || null
    const num = (v: string) => (v.trim() ? Number(v) : null)
    const { error } = await createClient().from("profiles").update({
      date_of_birth: profile.date_of_birth || null,
      gender: text(profile.gender),
      blood_type: text(profile.blood_type),
      height_cm: num(profile.height_cm),
      weight_kg: num(profile.weight_kg),
      allergies: text(profile.allergies),
      current_medications: text(profile.current_medications),
      chronic_conditions: text(profile.chronic_conditions),
      emergency_contact: text(profile.emergency_contact),
      phone: text(profile.phone),
      address: text(profile.address),
    }).eq("id", patientId)
    setSaving(false)
    if (error) {
      toast({ title: "Could not save", description: error.message, variant: "destructive" })
      return
    }
    toast({ title: "Health profile saved", description: "Your doctors see the update straight away." })
  }

  return (
    <div className="space-y-16">
      <div className="grid gap-12 lg:grid-cols-12">
        <form onSubmit={save} className="space-y-6 lg:col-span-7" aria-labelledby="profile-heading">
          <h2 id="profile-heading" className="text-xl font-bold tracking-tight">Health profile</h2>

          <div className="space-y-2">
            <Label htmlFor="allergies" className={LABEL}>Allergies</Label>
            <Textarea id="allergies" value={profile.allergies} onChange={set("allergies")} maxLength={1000} rows={2}
              placeholder="e.g. Penicillin, peanuts. Write 'None' if you have none." className={`${FIELD} placeholder:text-black/55`} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="medicines" className={LABEL}>Medicines you take now</Label>
            <Textarea id="medicines" value={profile.current_medications} onChange={set("current_medications")} maxLength={1000} rows={2}
              placeholder="Name and how often, e.g. Metformin 500 mg twice a day" className={`${FIELD} placeholder:text-black/55`} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="conditions" className={LABEL}>Long-term conditions</Label>
            <Textarea id="conditions" value={profile.chronic_conditions} onChange={set("chronic_conditions")} maxLength={1000} rows={2}
              placeholder="e.g. Diabetes, asthma" className={`${FIELD} placeholder:text-black/55`} />
          </div>

          <div className="grid gap-6 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="dob" className={LABEL}>Date of birth</Label>
              <Input id="dob" type="date" value={profile.date_of_birth} onChange={set("date_of_birth")} max={new Date().toISOString().slice(0, 10)} className={`h-11 ${FIELD}`} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gender" className={LABEL}>Gender</Label>
              <select id="gender" value={profile.gender} onChange={set("gender")} className={SELECT}>
                <option value="">Not set</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="blood" className={LABEL}>Blood group</Label>
              <select id="blood" value={profile.blood_type} onChange={set("blood_type")} className={SELECT}>
                <option value="">Not known</option>
                {BLOOD_TYPES.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="height" className={LABEL}>Height (cm)</Label>
              <Input id="height" type="number" min={30} max={250} value={profile.height_cm} onChange={set("height_cm")} className={`h-11 ${FIELD}`} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="weight" className={LABEL}>Weight (kg)</Label>
              <Input id="weight" type="number" min={1} max={400} step="0.1" value={profile.weight_kg} onChange={set("weight_kg")} className={`h-11 ${FIELD}`} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone" className={LABEL}>Phone</Label>
              <Input id="phone" type="tel" autoComplete="tel" value={profile.phone} onChange={set("phone")} maxLength={20} className={`h-11 ${FIELD}`} />
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="emergency" className={LABEL}>Emergency contact</Label>
              <Input id="emergency" value={profile.emergency_contact} onChange={set("emergency_contact")} maxLength={200}
                placeholder="Name and phone" className={`h-11 ${FIELD} placeholder:text-black/55`} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address" className={LABEL}>Address</Label>
              <Input id="address" autoComplete="street-address" value={profile.address} onChange={set("address")} maxLength={300} className={`h-11 ${FIELD}`} />
            </div>
          </div>

          <Button type="submit" disabled={saving} className="h-12 rounded-none bg-black px-8 text-white hover:bg-black/90 font-mono text-xs uppercase tracking-widest">
            {saving ? "Saving…" : "Save health profile"}
          </Button>
        </form>

        <aside className="space-y-10 lg:col-span-5">
          <section className="border border-black p-6">
            <h2 className="font-mono text-[11px] uppercase tracking-widest text-black/60">Who can see your record</h2>
            <p className="mt-2">
              {doctorCount === null ? "…" : doctorCount === 0 ? "No doctors yet. Only you." : `You and your ${doctorCount === 1 ? "doctor" : `${doctorCount} doctors`}.`}
            </p>
            <Link href="/patient-dashboard/doctors" className="mt-3 inline-block text-sm underline underline-offset-4">Manage your doctors</Link>
          </section>
          <section aria-labelledby="rx-heading" className="space-y-4">
            <h2 id="rx-heading" className="text-xl font-bold tracking-tight">Prescriptions</h2>
            <PrescriptionList patientId={patientId} emptyText="No prescriptions yet." />
          </section>
        </aside>
      </div>

      <section aria-labelledby="timeline-heading" className="space-y-6">
        <h2 id="timeline-heading" className="text-xl font-bold tracking-tight">Timeline</h2>
        <HealthTimeline patientId={patientId} viewer="patient" />
      </section>
    </div>
  )
}
