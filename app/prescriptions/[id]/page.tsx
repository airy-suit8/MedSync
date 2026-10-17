"use client"

import { use, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { format, parseISO } from "date-fns"
import { ArrowLeft, Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import type { Prescription } from "@/lib/prescriptions"

// A prescription as a printable sheet (browser print / "Save as PDF"). Readable by the
// patient and their current doctors (RLS); the doctor who wrote it can cancel it.
export default function PrescriptionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [rx, setRx] = useState<Prescription | null>(null)
  const [viewerId, setViewerId] = useState<string | null>(null)
  const [state, setState] = useState<"loading" | "ready" | "signed-out" | "missing">("loading")
  const [cancelling, setCancelling] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return setState("signed-out")
      setViewerId(user.id)
      const { data } = await supabase.from("prescriptions").select("*").eq("id", id).maybeSingle()
      if (!data) return setState("missing")
      setRx(data as Prescription)
      setState("ready")
    }
    load()
  }, [id])

  const cancel = async () => {
    if (!rx || !window.confirm("Cancel this prescription? The patient will be told not to use it.")) return
    setCancelling(true)
    const { error } = await createClient().rpc("cancel_prescription", { p_prescription_id: rx.id })
    setCancelling(false)
    if (error) {
      toast({ title: "Could not cancel", description: error.message, variant: "destructive" })
      return
    }
    setRx({ ...rx, status: "cancelled" })
  }

  if (state !== "ready" || !rx) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md border border-black p-10 text-center">
          <h1 className="mb-3 text-2xl font-bold uppercase">
            {state === "loading" ? "Loading…" : state === "signed-out" ? "Sign in to view" : "Prescription unavailable"}
          </h1>
          {state === "signed-out" && <Button asChild className="rounded-none bg-black text-white"><Link href="/login">Sign in</Link></Button>}
          {state === "missing" && <p className="text-sm text-black/70">It does not exist, or you are not the patient or one of their current doctors.</p>}
        </div>
      </main>
    )
  }

  const cancelled = rx.status === "cancelled"

  return (
    <main className="mx-auto max-w-3xl p-6 print:p-0">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button variant="ghost" onClick={() => router.back()} className="rounded-none font-mono text-xs uppercase tracking-widest">
          <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />Back
        </Button>
        <div className="flex gap-2">
          {viewerId === rx.doctor_id && !cancelled && (
            <Button variant="outline" onClick={cancel} disabled={cancelling} className="rounded-none border-red-700 text-red-700 font-mono text-xs uppercase tracking-widest">
              {cancelling ? "Cancelling…" : "Cancel prescription"}
            </Button>
          )}
          <Button onClick={() => window.print()} className="rounded-none bg-black text-white hover:bg-black/90 font-mono text-xs uppercase tracking-widest">
            <Printer className="mr-2 h-4 w-4" aria-hidden="true" />Print / Save as PDF
          </Button>
        </div>
      </div>

      <article className="relative border border-black bg-white p-8 sm:p-12 print:border-0">
        {cancelled && (
          <p role="status" className="mb-8 border-2 border-red-700 px-4 py-3 text-center font-mono text-sm font-bold uppercase tracking-widest text-red-700">
            Cancelled by the doctor. Do not use.
          </p>
        )}

        <header className="flex flex-col gap-6 border-b border-black pb-6 sm:flex-row sm:justify-between">
          <div>
            <p className="text-2xl font-bold">{rx.doctor_name}</p>
            {rx.doctor_specialty && <p className="text-sm text-black/70">{rx.doctor_specialty}</p>}
            <p className="mt-1 font-mono text-xs uppercase tracking-widest text-black/70">
              Reg. no. {rx.doctor_registration || "—"}
            </p>
          </div>
          <div className="text-left sm:text-right">
            <p className="font-bold tracking-tight">MedSync</p>
            <p className="font-mono text-xs text-black/70">{format(parseISO(rx.created_at), "d MMMM yyyy")}</p>
          </div>
        </header>

        <section className="grid gap-2 border-b border-black/20 py-6 sm:grid-cols-2">
          <p><span className="font-mono text-[11px] uppercase tracking-widest text-black/60">Patient </span>{rx.patient_name}</p>
          {rx.patient_short_id && <p className="sm:text-right"><span className="font-mono text-[11px] uppercase tracking-widest text-black/60">Patient ID </span><span className="font-mono">{rx.patient_short_id}</span></p>}
          {rx.diagnosis && <p className="sm:col-span-2"><span className="font-mono text-[11px] uppercase tracking-widest text-black/60">Diagnosis </span>{rx.diagnosis}</p>}
        </section>

        <section aria-labelledby="rx-items" className="py-6">
          <h2 id="rx-items" className="mb-4 text-3xl font-bold" aria-label="Prescribed medicines">℞</h2>
          <ol className="space-y-4">
            {rx.items.map((item, i) => (
              <li key={i} className="grid grid-cols-[2rem_1fr] gap-x-2">
                <span className="font-mono text-sm text-black/60 tabular-nums">{i + 1}.</span>
                <div>
                  <p className="font-bold">{item.medicine}</p>
                  <p className="text-sm">{[item.dose, item.frequency, item.duration && `for ${item.duration}`].filter(Boolean).join(" · ")}</p>
                  {item.instructions && <p className="text-sm text-black/70">{item.instructions}</p>}
                </div>
              </li>
            ))}
          </ol>
        </section>

        {rx.advice && (
          <section className="border-t border-black/20 py-6">
            <h2 className="mb-2 font-mono text-[11px] uppercase tracking-widest text-black/60">Advice</h2>
            <p className="whitespace-pre-line leading-relaxed">{rx.advice}</p>
          </section>
        )}

        <footer className="mt-6 border-t border-black pt-4 text-xs text-black/70">
          Issued electronically through MedSync by the doctor named above. Prescription ID {rx.id}.
        </footer>
      </article>
    </main>
  )
}
