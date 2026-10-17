"use client"

import type React from "react"
import { useState } from "react"
import Link from "next/link"
import { FileSignature, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import DictationButton from "@/components/medical/DictationButton"
import { createClient } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import { EMPTY_ITEM, FREQUENCIES, PRESCRIPTIONS_CHANGED, filledItems, type RxItem } from "@/lib/prescriptions"

const LABEL = "font-mono text-[11px] uppercase tracking-widest text-black/60"
const FIELD = "rounded-none border-black/20 focus:border-black"

// "Write prescription" button and dialog. The prescription is saved by
// create_prescription (which checks the doctor is treating the patient) and the patient
// is notified; it can then be opened and printed at /prescriptions/[id].
export default function PrescriptionForm({ patientId, patientName, reportId, appointmentId, onCreated, buttonLabel = "Write prescription" }: {
  patientId: string
  patientName: string
  reportId?: string
  appointmentId?: string
  onCreated?: (id: string) => void
  buttonLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<RxItem[]>([{ ...EMPTY_ITEM }])
  const [diagnosis, setDiagnosis] = useState("")
  const [advice, setAdvice] = useState("")
  const [saving, setSaving] = useState(false)
  const [createdId, setCreatedId] = useState<string | null>(null)
  const { toast } = useToast()

  const update = (index: number, field: keyof RxItem, value: string) =>
    setItems((rows) => rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)))

  const reset = () => {
    setItems([{ ...EMPTY_ITEM }])
    setDiagnosis("")
    setAdvice("")
    setCreatedId(null)
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    const rows = filledItems(items)
    if (!rows.length) {
      toast({ title: "Add at least one medicine", variant: "destructive" })
      return
    }
    setSaving(true)
    const { data, error } = await createClient().rpc("create_prescription", {
      p_patient_id: patientId,
      p_items: rows,
      p_diagnosis: diagnosis,
      p_advice: advice,
      p_report_id: reportId ?? null,
      p_appointment_id: appointmentId ?? null,
    })
    setSaving(false)
    if (error) {
      toast({ title: "Could not save the prescription", description: error.message, variant: "destructive" })
      return
    }
    setCreatedId(data as string)
    onCreated?.(data as string)
    window.dispatchEvent(new Event(PRESCRIPTIONS_CHANGED))
    toast({ title: "Prescription saved", description: `${patientName} has been told and can print it.` })
  }

  return (
    <>
      <Button type="button" variant="outline" onClick={() => { reset(); setOpen(true) }}
        className="h-12 rounded-none border-black px-6 font-mono text-xs uppercase tracking-widest">
        <FileSignature className="mr-2 h-4 w-4" aria-hidden="true" />
        {buttonLabel}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto rounded-none border-black">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold uppercase">Prescription</DialogTitle>
            <DialogDescription>For {patientName}. They are notified and can print it.</DialogDescription>
          </DialogHeader>

          {createdId ? (
            <div className="space-y-6">
              <p>Saved. You can open it to print, or write another.</p>
              <div className="flex flex-wrap gap-3">
                <Button asChild className="h-12 rounded-none bg-black px-6 text-white hover:bg-black/90 font-mono text-xs uppercase tracking-widest">
                  <Link href={`/prescriptions/${createdId}`} target="_blank">Open and print</Link>
                </Button>
                <Button variant="outline" onClick={reset} className="h-12 rounded-none border-black font-mono text-xs uppercase tracking-widest">Write another</Button>
              </div>
            </div>
          ) : (
            <form onSubmit={save} className="space-y-6">
              <fieldset className="space-y-4">
                <legend className={`${LABEL} mb-2`}>Medicines</legend>
                {items.map((item, i) => (
                  <div key={i} className="grid gap-2 border border-black/10 p-4 sm:grid-cols-12">
                    <div className="sm:col-span-5">
                      <Label htmlFor={`rx-med-${i}`} className="sr-only">Medicine {i + 1}</Label>
                      <Input id={`rx-med-${i}`} value={item.medicine} onChange={(e) => update(i, "medicine", e.target.value)}
                        placeholder="Medicine and strength, e.g. Paracetamol 500 mg" maxLength={120} className={FIELD} />
                    </div>
                    <div className="sm:col-span-2">
                      <Label htmlFor={`rx-dose-${i}`} className="sr-only">Dose</Label>
                      <Input id={`rx-dose-${i}`} value={item.dose || ""} onChange={(e) => update(i, "dose", e.target.value)}
                        placeholder="Dose, e.g. 1 tablet" maxLength={60} className={FIELD} />
                    </div>
                    <div className="sm:col-span-3">
                      <Label htmlFor={`rx-freq-${i}`} className="sr-only">How often</Label>
                      <Input id={`rx-freq-${i}`} list="rx-frequencies" value={item.frequency || ""} onChange={(e) => update(i, "frequency", e.target.value)}
                        placeholder="How often" maxLength={60} className={FIELD} />
                    </div>
                    <div className="sm:col-span-2">
                      <Label htmlFor={`rx-days-${i}`} className="sr-only">For how long</Label>
                      <Input id={`rx-days-${i}`} value={item.duration || ""} onChange={(e) => update(i, "duration", e.target.value)}
                        placeholder="e.g. 5 days" maxLength={60} className={FIELD} />
                    </div>
                    <div className="sm:col-span-11">
                      <Label htmlFor={`rx-note-${i}`} className="sr-only">Instructions</Label>
                      <Input id={`rx-note-${i}`} value={item.instructions || ""} onChange={(e) => update(i, "instructions", e.target.value)}
                        placeholder="Instructions, e.g. after food" maxLength={200} className={FIELD} />
                    </div>
                    <div className="flex items-center justify-end sm:col-span-1">
                      {items.length > 1 && (
                        <Button type="button" variant="ghost" size="icon" aria-label={`Remove medicine ${i + 1}`}
                          onClick={() => setItems((rows) => rows.filter((_, j) => j !== i))}>
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                <datalist id="rx-frequencies">{FREQUENCIES.map((f) => <option key={f} value={f} />)}</datalist>
                {items.length < 30 && (
                  <Button type="button" variant="ghost" onClick={() => setItems((rows) => [...rows, { ...EMPTY_ITEM }])}
                    className="rounded-none font-mono text-xs uppercase tracking-widest">
                    <Plus className="mr-2 h-4 w-4" aria-hidden="true" />Add medicine
                  </Button>
                )}
              </fieldset>

              <div className="space-y-2">
                <Label htmlFor="rx-diagnosis" className={LABEL}>Diagnosis (optional)</Label>
                <Input id="rx-diagnosis" value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} maxLength={500} className={`h-11 ${FIELD}`} />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="rx-advice" className={LABEL}>Advice (optional)</Label>
                  <DictationButton label="advice" onText={(t) => setAdvice((a) => (a ? `${a} ${t}` : t))} />
                </div>
                <Textarea id="rx-advice" value={advice} onChange={(e) => setAdvice(e.target.value)} maxLength={2000} rows={3}
                  placeholder="e.g. Rest, drink plenty of water, come back if the fever lasts more than 3 days"
                  className={`${FIELD} placeholder:text-black/55`} />
              </div>

              <Button type="submit" disabled={saving} className="h-12 w-full rounded-none bg-black text-white hover:bg-black/90 font-mono text-xs uppercase tracking-widest">
                {saving ? "Saving…" : "Save prescription"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
