"use client"

import { useEffect, useState } from "react"
import { format, parseISO } from "date-fns"
import { Inbox } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"

type Request = {
  id: string
  patient_name: string | null
  appointment_date: string
  start_time: string | null
  symptoms: string | null
}

// Patients who picked this doctor and asked for a consultation. Accepting links the
// patient (respond_to_consultation_request), which is what lets the doctor see their
// reports. The mirror of AppointmentRequests on the patient's dashboard.
export default function ConsultationRequests({ doctorId, onAnswered }: { doctorId: string; onAnswered?: () => void }) {
  const [requests, setRequests] = useState<Request[]>([])
  const [answeringId, setAnsweringId] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    const load = async () => {
      // patient_name on a request is written by request_consultation from the profile.
      const { data } = await createClient()
        .from("appointments")
        .select("id, patient_name, appointment_date, start_time, symptoms")
        .eq("doctor_id", doctorId)
        .eq("status", "requested")
        .order("appointment_date", { ascending: true })
      setRequests(data || [])
    }
    load()
  }, [doctorId])

  const respond = async (id: string, accept: boolean) => {
    setAnsweringId(id)
    const { error } = await createClient().rpc("respond_to_consultation_request", { p_appointment_id: id, p_accept: accept })
    setAnsweringId(null)
    if (error) {
      toast({ title: "Could not answer the request", description: error.message, variant: "destructive" })
      return
    }
    setRequests((current) => current.filter((r) => r.id !== id))
    onAnswered?.()
    toast({
      title: accept ? "Request accepted" : "Request declined",
      description: accept ? "The patient is now on your list and you can see their reports." : "The patient has been told and can ask another doctor.",
    })
  }

  if (requests.length === 0) return null

  return (
    <section aria-labelledby="consultation-requests" className="border border-black mb-16">
      <h2 id="consultation-requests" className="flex items-center gap-2 border-b border-black px-6 py-4 text-sm font-mono uppercase tracking-widest">
        <Inbox className="h-4 w-4" aria-hidden="true" />
        Consultation requests ({requests.length})
      </h2>
      <ul className="divide-y divide-black/10">
        {requests.map((r) => (
          <li key={r.id} className="flex flex-col gap-4 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-bold">{r.patient_name || "Patient"}</p>
              <p className="text-sm font-mono text-black/60">
                {format(parseISO(r.appointment_date), "EEE d MMM yyyy")}
                {r.start_time && ` · ${r.start_time.slice(0, 5)}`}
              </p>
              {r.symptoms && <p className="mt-1 max-w-xl text-sm">“{r.symptoms}”</p>}
              <p className="mt-1 text-xs text-black/60">Accepting lets you see this patient&apos;s reports.</p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => respond(r.id, true)}
                disabled={answeringId === r.id}
                className="rounded-none bg-black text-white hover:bg-black/90 font-mono text-xs uppercase tracking-widest"
              >
                Accept
              </Button>
              <Button
                variant="outline"
                onClick={() => respond(r.id, false)}
                disabled={answeringId === r.id}
                className="rounded-none border-black font-mono text-xs uppercase tracking-widest"
              >
                Decline
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
