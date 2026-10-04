"use client"

import { useEffect, useState } from "react"
import { format, parseISO } from "date-fns"
import { CalendarCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"

type Request = {
  id: string
  doctor_name: string | null
  appointment_date: string
  start_time: string | null
  consultation_type: string | null
}

// Appointments a doctor requested for this patient. Confirming assigns the patient to
// that doctor (respond_to_appointment), which is what lets the doctor and their labs
// see the patient's reports. Declining cancels the request.
export default function AppointmentRequests({ patientId }: { patientId: string }) {
  const [requests, setRequests] = useState<Request[]>([])
  const [answeringId, setAnsweringId] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from("appointments")
        .select("id, doctor_id, appointment_date, start_time, consultation_type")
        .eq("patient_id", patientId)
        .eq("status", "scheduled")
        .gte("appointment_date", format(new Date(), "yyyy-MM-dd"))
        .order("appointment_date", { ascending: true })
      // appointments.doctor_name is written by the doctor's browser; show the profile name instead.
      const doctorIds = [...new Set((data || []).map((a: { doctor_id: string }) => a.doctor_id))]
      const { data: doctors } = doctorIds.length
        ? await supabase.from("profile_directory").select("id, name").in("id", doctorIds)
        : { data: [] }
      const names = new Map((doctors || []).map((d: { id: string; name: string | null }) => [d.id, d.name]))
      setRequests((data || []).map((a: Omit<Request, "doctor_name"> & { doctor_id: string }) => ({ ...a, doctor_name: names.get(a.doctor_id) ?? null })))
    }
    load()
  }, [patientId])

  const respond = async (id: string, accept: boolean) => {
    setAnsweringId(id)
    const { error } = await createClient().rpc("respond_to_appointment", { p_appointment_id: id, p_accept: accept })
    setAnsweringId(null)
    if (error) {
      toast({ title: "Could not update the appointment", description: error.message, variant: "destructive" })
      return
    }
    setRequests(current => current.filter(r => r.id !== id))
    toast({
      title: accept ? "Appointment confirmed" : "Appointment declined",
      description: accept ? "Your doctor can now see your reports." : "The doctor will see that you declined.",
    })
  }

  if (requests.length === 0) return null

  return (
    <section aria-labelledby="appointment-requests" className="border border-black mb-16">
      <h2 id="appointment-requests" className="flex items-center gap-2 border-b border-black px-6 py-4 text-sm font-mono uppercase tracking-widest">
        <CalendarCheck className="h-4 w-4" aria-hidden="true" />
        Appointment requests ({requests.length})
      </h2>
      <ul className="divide-y divide-black/10">
        {requests.map(r => (
          <li key={r.id} className="flex flex-col gap-4 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-bold">{r.doctor_name || "Doctor"}</p>
              <p className="text-sm font-mono text-black/60">
                {format(parseISO(r.appointment_date), "EEE d MMM yyyy")}
                {r.start_time && ` · ${r.start_time.slice(0, 5)}`}
                {r.consultation_type && ` · ${r.consultation_type}`}
              </p>
              <p className="mt-1 text-xs text-black/60">Confirming lets this doctor see your reports.</p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => respond(r.id, true)}
                disabled={answeringId === r.id}
                className="rounded-none bg-black text-white hover:bg-black/90 font-mono text-xs uppercase tracking-widest"
              >
                Confirm
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
