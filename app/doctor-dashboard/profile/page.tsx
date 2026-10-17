"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import DashboardShell from "@/components/medical/common/DashboardShell"
import DoctorCard from "@/components/medical/DoctorCard"
import { createClient } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"

const LABEL = "font-mono text-[11px] uppercase tracking-widest text-black/60"
const FIELD = "rounded-none border-black/20 focus:border-black placeholder:text-black/55"

export default function DoctorProfilePage() {
  return (
    <DashboardShell
      role="doctor"
      label="PUBLIC PROFILE"
      title="Public profile"
      intro="Patients choose a doctor from this. Say what you treat and what they should share, so the right patients reach you."
    >
      {(user) => <ProfileForm doctorId={user.id} />}
    </DashboardShell>
  )
}

function ProfileForm({ doctorId }: { doctorId: string }) {
  const [name, setName] = useState("")
  const [verified, setVerified] = useState(true)
  const [form, setForm] = useState({ specialty: "", expertise: "", share_before: "" })
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    const load = async () => {
      const { data } = await createClient()
        .from("profiles")
        .select("name, verified, specialty, expertise, share_before")
        .eq("id", doctorId)
        .maybeSingle()
      if (!data) return
      setName(data.name || "")
      setVerified(data.verified !== false)
      setForm({ specialty: data.specialty || "", expertise: data.expertise || "", share_before: data.share_before || "" })
    }
    load()
  }, [doctorId])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const clean = (value: string) => value.trim() || null
    const { error } = await createClient()
      .from("profiles")
      .update({ specialty: clean(form.specialty), expertise: clean(form.expertise), share_before: clean(form.share_before) })
      .eq("id", doctorId)
    setSaving(false)
    if (error) {
      toast({ title: "Could not save your profile", description: error.message, variant: "destructive" })
      return
    }
    toast({ title: "Profile saved", description: "Patients see the new version straight away." })
  }

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((current) => ({ ...current, [field]: e.target.value }))

  return (
    <div className="grid gap-12 lg:grid-cols-12">
      <form onSubmit={save} className="space-y-6 lg:col-span-7">
        {!verified && (
          <p role="status" className="border border-amber-600/30 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Patients can&apos;t find you until your registration number is verified. You can fill this in now.
          </p>
        )}

        <div className="space-y-2">
          <Label htmlFor="specialty" className={LABEL}>Specialty</Label>
          <Input id="specialty" value={form.specialty} onChange={set("specialty")} maxLength={100}
            placeholder="e.g. Orthopaedics" className={`h-12 ${FIELD}`} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="expertise" className={LABEL}>What you treat</Label>
          <Textarea id="expertise" value={form.expertise} onChange={set("expertise")} maxLength={600} rows={4}
            aria-describedby="expertise-help"
            placeholder="e.g. Fractures, sports injuries, joint and back pain. Second opinions on X-rays."
            className={FIELD} />
          <p id="expertise-help" className="text-xs text-black/60">
            Patients search these words, so name the problems and body parts you see. {form.expertise.length}/600
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="share_before" className={LABEL}>What patients should share before a visit</Label>
          <Textarea id="share_before" value={form.share_before} onChange={set("share_before")} maxLength={400} rows={3}
            placeholder="e.g. Recent X-rays or MRI, current medicines, when the pain started"
            className={FIELD} />
          <p className="text-xs text-black/60">{form.share_before.length}/400</p>
        </div>

        <Button type="submit" disabled={saving} className="h-12 rounded-none bg-black px-8 text-white hover:bg-black/90 font-mono text-xs uppercase tracking-widest">
          {saving ? "Saving…" : "Save profile"}
        </Button>
      </form>

      <aside aria-label="Preview" className="lg:col-span-5">
        <p className={`${LABEL} mb-3`}>How patients see you</p>
        <div className="border border-black/10">
          <DoctorCard doctor={{ id: doctorId, name, specialty: form.specialty || null, expertise: form.expertise || null, share_before: form.share_before || null }} />
        </div>
      </aside>
    </div>
  )
}
