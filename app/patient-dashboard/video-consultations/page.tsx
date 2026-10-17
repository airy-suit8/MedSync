"use client"

import { useEffect, useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Activity, Users, Video, ArrowLeft } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { format, parseISO } from "date-fns"
import dynamic from "next/dynamic"
import PrescriptionList from "@/components/medical/PrescriptionList"

const MedicalVideoCall = dynamic(() => import("@/components/medical-video-call"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white p-8 text-center">
        <Activity className="h-8 w-8 animate-spin mx-auto mb-4 text-black" />
        <span className="text-xs font-mono uppercase tracking-widest text-black/60">Loading Video Module...</span>
      </div>
    </div>
  ),
})

interface Consultation {
  id: string
  call_secret?: string
  awaitingConfirmation?: boolean
  doctor_name: string
  doctor_id: string
  patient_name: string
  patient_id: string
  appointment_date: string
  start_time: string
  end_time: string
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled'
  consultation_type: 'video' | 'audio' | 'chat'
  notes?: string
  symptoms?: string
  diagnosis?: string
  prescription?: string
}

interface User {
  id: string
  user_metadata?: {
    role?: string
    name?: string
  }
}

export default function PatientVideoConsultationsPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [consultations, setConsultations] = useState<Consultation[]>([])
  const [isVideoCallOpen, setIsVideoCallOpen] = useState(false)
  const [selectedConsultationForCall, setSelectedConsultationForCall] = useState<Consultation | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const router = useRouter()
  const loadingRef = useRef(false)

  useEffect(() => {
    const checkUser = async () => {
      if (loadingRef.current) return
      loadingRef.current = true
      setLoading(true)

      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user || user.app_metadata?.role !== "patient") {
          router.push("/login")
          return
        }

        setUser(user)
        await loadConsultations(user.id)
      } catch (error) {
        console.error('❌ Error in checkUser:', error)
      } finally {
        setLoading(false)
        loadingRef.current = false
      }
    }

    checkUser()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const handleFocus = () => {
      if (user?.id && !loading) {
        loadConsultations(user.id)
      }
    }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [user, loading])

  const loadConsultations = async (patientId: string) => {
    const supabase = createClient()
    try {
      setIsLoading(true)
      setLoadError(null)

      let actualPatientId = patientId

      const today = format(new Date(), 'yyyy-MM-dd')
      const { data: appointments, error } = await supabase
        .from('appointments')
        .select('*')
        .or(`patient_id.eq.${actualPatientId},patient_id.eq.${patientId}`)
        .gte('appointment_date', today)
        .in('status', ['scheduled', 'confirmed', 'in-progress', 'completed'])
        .order('appointment_date', { ascending: true })

      if (error) throw error

      if (appointments) {
        setConsultations(appointments.map((apt: any) => ({
          id: apt.id,
          call_secret: apt.call_secret,
          doctor_name: apt.doctor_name || 'Dr. Unknown',
          doctor_id: apt.doctor_id,
          patient_name: apt.patient_name || 'Unknown Patient',
          patient_id: apt.patient_id,
          appointment_date: apt.appointment_date,
          start_time: apt.start_time,
          end_time: apt.end_time,
          status: apt.status === 'confirmed' ? 'scheduled' : (apt.status || 'scheduled'),
          awaitingConfirmation: apt.status === 'scheduled', // a doctor's request the patient hasn't confirmed
          consultation_type: apt.consultation_type || 'video',
          notes: apt.notes,
          symptoms: apt.symptoms,
          diagnosis: apt.diagnosis,
          prescription: apt.prescription
        })))
      }
    } catch (error: any) {
      console.error('❌ Error loading consultations:', error)
      setLoadError(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const startVideoCall = (consultation: Consultation) => {
    setSelectedConsultationForCall(consultation)
    setIsVideoCallOpen(true)
  }

  const getConsultationTypeLabel = (type: string) => {
    switch (type) {
      case 'video': return 'Video Call'
      case 'audio': return 'Audio Call'
      case 'chat': return 'Chat'
      default: return 'Video Call'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-transparent">
        <div className="flex flex-col items-center">
          <Activity className="h-8 w-8 animate-spin mb-4 text-black" />
          <span className="text-xs font-mono uppercase tracking-widest text-black/60">Establishing Secure Uplink...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-transparent p-12 max-w-7xl mx-auto">
      <header className="border-b border-black/10 pb-8 mb-12 flex items-end justify-between">
        <div>
          <Link href="/patient-dashboard" className="inline-flex items-center space-x-2 text-xs font-mono uppercase tracking-widest text-black/55 hover:text-black mb-4 transition-colors">
            <ArrowLeft className="h-3 w-3" />
            <span>Portal Exit</span>
          </Link>
          <h1 className="text-4xl font-bold tracking-tight uppercase mb-2">Video Consultations</h1>
          <p className="text-black/60 font-light text-lg italic">Virtual clinical encounters and synchronous healthcare support</p>
        </div>
      </header>

      <div className="container mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-xl font-black uppercase tracking-tighter">Scheduled Encounters</h2>
          <Button variant="outline" className="rounded-none border-black/10 h-10 uppercase font-mono text-[10px] tracking-widest px-6" onClick={() => loadConsultations(user?.id || '')} disabled={isLoading}>
            <Activity className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh Node
          </Button>
        </div>

        <div className="space-y-6">
          {loadError && <div className="border border-red-200 bg-red-50 p-4 text-sm text-red-700 font-mono">{loadError}</div>}
          {consultations.length > 0 ? (
            consultations.map((consultation) => (
              <div key={consultation.id} className="group border border-black/10 bg-white p-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
                  <div className="flex items-center gap-6">
                    <div className="p-4 bg-black text-white"><Video className="h-6 w-6" aria-hidden="true" /></div>
                    <div>
                      <h3 className="text-2xl font-black uppercase tracking-tight">{consultation.doctor_name}</h3>
                      <p className="text-[11px] font-mono uppercase tracking-widest text-black/60 mt-1">
                        {getConsultationTypeLabel(consultation.consultation_type)} • SYMPTOMS: {consultation.symptoms || 'NOT SPECIFIED'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right mr-4">
                      <p className="text-sm font-bold uppercase tracking-tight">{format(parseISO(consultation.appointment_date), 'MMMM d, yyyy')}</p>
                      <p className="text-[11px] font-mono text-black/60 uppercase tracking-widest">{consultation.start_time?.slice(0, 5)}</p>
                    </div>
                    {consultation.status === 'completed' ? (
                      <span className="border border-black px-3 py-1 font-mono text-[11px] uppercase tracking-widest">Completed</span>
                    ) : consultation.awaitingConfirmation ? (
                      <Button asChild variant="outline" className="rounded-none border-black h-12 px-6 uppercase font-mono text-[11px] tracking-widest">
                        <Link href="/patient-dashboard">Confirm on your dashboard</Link>
                      </Button>
                    ) : consultation.status !== 'cancelled' ? (
                      <Button className="bg-black text-white rounded-none h-12 px-8 uppercase font-mono text-[11px] tracking-widest" onClick={() => startVideoCall(consultation)}>Establish Link</Button>
                    ) : null}
                  </div>
                </div>

                {consultation.status === 'completed' && (consultation.diagnosis || consultation.notes || consultation.prescription || user) && (
                  <div className="mt-8 grid gap-6 border-t border-black/10 pt-6 md:grid-cols-2">
                    {consultation.diagnosis && (
                      <div>
                        <h4 className="font-mono text-[11px] uppercase tracking-widest text-black/60 mb-1">Diagnosis</h4>
                        <p>{consultation.diagnosis}</p>
                      </div>
                    )}
                    {consultation.notes && (
                      <div>
                        <h4 className="font-mono text-[11px] uppercase tracking-widest text-black/60 mb-1">Doctor&apos;s notes</h4>
                        <p className="whitespace-pre-line">{consultation.notes}</p>
                      </div>
                    )}
                    {consultation.prescription && (
                      <div>
                        <h4 className="font-mono text-[11px] uppercase tracking-widest text-black/60 mb-1">Prescription notes</h4>
                        <p className="whitespace-pre-line">{consultation.prescription}</p>
                      </div>
                    )}
                    {user && (
                      <div className="md:col-span-2">
                        <h4 className="font-mono text-[11px] uppercase tracking-widest text-black/60 mb-2">Prescriptions</h4>
                        <PrescriptionList patientId={user.id} appointmentId={consultation.id} emptyText="No printable prescription for this consultation." />
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="border border-black/10 bg-white p-24 text-center">
              <Users className="h-12 w-12 text-black/20 mx-auto mb-6" />
              <h3 className="text-2xl font-black uppercase tracking-tight mb-2">No Active Links</h3>
            </div>
          )}
        </div>
      </div>

      {selectedConsultationForCall && (
        <MedicalVideoCall
          isOpen={isVideoCallOpen}
          onClose={() => {
            setIsVideoCallOpen(false)
            setSelectedConsultationForCall(null)
          }}
          consultation={selectedConsultationForCall}
          userRole="patient"
        />
      )}
    </div>
  )
}
