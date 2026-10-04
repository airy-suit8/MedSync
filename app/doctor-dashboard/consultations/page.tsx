"use client"

import { useEffect, useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Activity, Users, Video, Phone, MessageSquare, Calendar, ArrowLeft, CheckCircle, Clock } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { format, parseISO } from "date-fns"
import dynamic from "next/dynamic"

const MedicalVideoCall = dynamic(() => import("@/components/medical-video-call"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white p-8 text-center">
        <Activity className="h-8 w-8 animate-spin mx-auto mb-4" />
        <span className="text-xs font-mono uppercase tracking-widest text-black/60">Loading Video Module...</span>
      </div>
    </div>
  ),
})
import ScheduleAppointmentModal from "@/components/schedule-appointment-modal"

interface Consultation {
  id: string
  patient_name: string
  patient_id: string
  doctor_id: string
  doctor_name?: string
  appointment_date: string
  start_time: string
  end_time: string
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled'
  awaitingPatient: boolean
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

export default function ConsultationsPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [consultations, setConsultations] = useState<Consultation[]>([])
  const [selectedConsultation, setSelectedConsultation] = useState<Consultation | null>(null)
  const [isConsultationModalOpen, setIsConsultationModalOpen] = useState(false)
  const [consultationNotes, setConsultationNotes] = useState("")
  const [diagnosis, setDiagnosis] = useState("")
  const [prescription, setPrescription] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isVideoCallOpen, setIsVideoCallOpen] = useState(false)
  const [selectedConsultationForCall, setSelectedConsultationForCall] = useState<Consultation | null>(null)
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false)
  const [doctorId, setDoctorId] = useState<string>("")
  const [loadError, setLoadError] = useState<string | null>(null)
  const router = useRouter()
  const loadingRef = useRef(false)

  useEffect(() => {
    const checkUser = async () => {
      // Prevent multiple simultaneous loads
      if (loadingRef.current) {
        console.log('🔄 Already loading, skipping...')
        return
      }

      loadingRef.current = true
      setLoading(true)

      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          router.push("/login")
          return
        }

        if (user.app_metadata?.role !== "doctor") {
          router.push("/login")
          return
        }

        setUser(user)

        // Get the doctor ID from the doctors table
        const { data: doctorData } = await supabase
          .from('profile_directory')
          .select('id')
          .eq('id', user.id)
          .maybeSingle()

        if (doctorData) {
          setDoctorId(doctorData.id)
        } else {
          // Fallback to user id if no doctor record
          setDoctorId(user.id)
        }

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
  }, []) // Remove router dependency to prevent re-runs on tab switches

  // Add focus listener to refresh consultations when page becomes visible
  useEffect(() => {
    const handleFocus = () => {
      console.log('🔄 Page focused, refreshing consultations...')
      if (user && !loading) {
        loadConsultations(user.id)
      }
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [user, loading])

  const loadConsultations = async (doctorId: string) => {
    const supabase = createClient()

    try {
      console.log('🔍 Loading consultations for doctor ID:', doctorId)
      setIsLoading(true)
      setLoadError(null)

      // Doctor accounts are represented by their single safe directory row.
      const { data: doctorData, error: doctorError } = await supabase
        .from('profile_directory')
        .select('id, name')
        .eq('id', doctorId)
        .maybeSingle()

      console.log('🔍 Doctor lookup result:', { doctorData, doctorError })

      if (doctorData) {
        console.log('✅ Found doctor record:', doctorData)
      } else {
        console.log('⚠️ No doctor record found for this authenticated user:', doctorId)
        setConsultations([])
        setLoadError('Doctor profile not found for this account. Please contact support to link your doctor profile.')
        return
      }

      const actualDoctorId = doctorData.id

      // Load today's and upcoming consultations (including confirmed appointments)
      const today = format(new Date(), 'yyyy-MM-dd')
      console.log('🔍 Loading appointments for doctor:', actualDoctorId, 'from date:', today)

      const { data: appointments, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('doctor_id', actualDoctorId)
        .gte('appointment_date', today)
        .in('status', ['scheduled', 'confirmed', 'in-progress', 'completed'])
        .order('appointment_date', { ascending: true })
        .order('start_time', { ascending: true })

      console.log('🔍 Appointments query result:', { appointments, error })

      if (error) {
        console.error('❌ Error loading consultations:', error)

        // Check if table doesn't exist
        if (error.code === '42P01' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
          console.log('📋 Appointments table not found')
          setConsultations([])
          setLoadError('Appointments table is missing. Please run the database setup scripts.')
          return
        }

        // For other errors, show error and use demo data as fallback
        console.error('❌ Database error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        })
        setConsultations([])
        setLoadError(`Failed to load consultations: ${error.message}`)
        return
      }

      if (appointments && appointments.length > 0) {
        console.log('✅ Found', appointments.length, 'appointments')
        const consultationsData: Consultation[] = appointments.map((apt: any) => ({
          id: apt.id,
          patient_name: apt.patient_name || 'Unknown Patient',
          patient_id: apt.patient_id,
          doctor_id: apt.doctor_id,
          doctor_name: apt.doctor_name,
          appointment_date: apt.appointment_date,
          start_time: apt.start_time,
          end_time: apt.end_time,
          status: apt.status === 'confirmed' ? 'scheduled' : (apt.status || 'scheduled'), // Map confirmed to scheduled for consultations
          awaitingPatient: apt.status === 'scheduled', // patient hasn't confirmed the request yet
          consultation_type: apt.consultation_type || 'video',
          notes: apt.notes,
          symptoms: apt.symptoms,
          diagnosis: apt.diagnosis,
          prescription: apt.prescription
        }))
        setConsultations(consultationsData)
      } else {
        console.log('ℹ️ No appointments found for doctor', actualDoctorId)
        setConsultations([])
      }
    } catch (error) {
      console.error('❌ Error loading consultations:', error)
      setConsultations([])
      setLoadError('Unexpected error while loading consultations.')
    } finally {
      setIsLoading(false)
    }
  }

  const refreshConsultations = async () => {
    if (user) {
      console.log('🔄 Refreshing consultations...')
      await loadConsultations(user.id)
    }
  }

  const startConsultation = (consultation: Consultation) => {
    setSelectedConsultation(consultation)
    setIsConsultationModalOpen(true)
  }

  const startVideoCall = (consultation: Consultation) => {
    setSelectedConsultationForCall(consultation)
    setIsVideoCallOpen(true)
  }

  const endConsultation = async () => {
    if (!selectedConsultation) return

    try {
      const { updateAppointment } = await import('@/lib/appointment-utils')

      const result = await updateAppointment(selectedConsultation.id, {
        status: 'completed',
        notes: consultationNotes,
        diagnosis: diagnosis,
        prescription: prescription,
        completed_at: new Date().toISOString()
      })

      if (result.success) {
        // Update local state
        setConsultations(prev => prev.map(c =>
          c.id === selectedConsultation.id
            ? {
              ...c,
              status: 'completed' as const,
              notes: consultationNotes,
              diagnosis,
              prescription
            }
            : c
        ))

        // Use a more user-friendly notification instead of alert
        console.log('✅ Consultation completed:', result.message)
      } else {
        console.error('❌ Error updating consultation:', result.error)
        // Use a more user-friendly error notification
        console.error('Failed to complete consultation:', result.message)
      }
    } catch (error) {
      console.error('❌ Error ending consultation:', error)
      // Use a more user-friendly error notification
      console.error('An unexpected error occurred while completing the consultation')
    }

    setIsConsultationModalOpen(false)
    setSelectedConsultation(null)
    setConsultationNotes("")
    setDiagnosis("")
    setPrescription("")
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'scheduled': return <Badge className="bg-blue-100 text-blue-800">Scheduled</Badge>
      case 'in-progress': return <Badge className="bg-yellow-100 text-yellow-800">In Progress</Badge>
      case 'completed': return <Badge className="bg-green-100 text-green-800">Completed</Badge>
      case 'cancelled': return <Badge className="bg-red-100 text-red-800">Cancelled</Badge>
      default: return <Badge className="bg-gray-100 text-gray-800">{status}</Badge>
    }
  }

  const getConsultationTypeIcon = (type: string) => {
    switch (type) {
      case 'video': return <Video className="h-5 w-5 text-blue-600" />
      case 'audio': return <Phone className="h-5 w-5 text-green-600" />
      case 'chat': return <MessageSquare className="h-5 w-5 text-purple-600" />
      default: return <Video className="h-5 w-5 text-gray-600" />
    }
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
          <Activity className="h-8 w-8 animate-spin mb-4" />
          <span className="text-xs font-mono uppercase tracking-widest text-black/60">Loading Consultations...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-transparent p-12 max-w-7xl mx-auto">
      {/* Header */}
      <header className="border-b border-black/10 pb-8 mb-12 flex items-end justify-between">
        <div>
          <Link href="/doctor-dashboard" className="inline-flex items-center space-x-2 text-xs font-mono uppercase tracking-widest text-black/55 hover:text-black mb-4 transition-colors">
            <ArrowLeft className="h-3 w-3" />
            <span>Back to Dashboard</span>
          </Link>
          <h1 className="text-4xl font-bold tracking-tight uppercase mb-2">Patient Consultations</h1>
          <p className="text-black/60 font-light text-lg">
            Conduct virtual consultations and patient assessments with real-time communication tools
          </p>
        </div>
        <div className="text-right hidden md:block">
          <span className="text-[10px] font-mono uppercase tracking-widest text-black/55 block mb-1">
            Portal Status
          </span>
          <span className="text-xl font-mono border-b border-black inline-flex items-center gap-2">
            <span className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></span>
            ACTIVE
          </span>
        </div>
      </header>

      {/* Quick Stats */}
      <div className="grid md:grid-cols-4 gap-px bg-black/10 border border-black/10 mb-12">
        <div className="bg-white p-6">
          <div className="flex items-center space-x-3 mb-2">
             <Calendar className="h-5 w-5 text-black" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-black/60">Today&apos;s Total</span>
          </div>
          <div className="text-3xl font-bold">
             {consultations.filter(c => c.appointment_date === format(new Date(), 'yyyy-MM-dd')).length}
          </div>
        </div>

        <div className="bg-white p-6 border-b-4 border-yellow-400">
          <div className="flex items-center space-x-3 mb-2">
             <Activity className="h-5 w-5 text-yellow-600" />
             <span className="text-[10px] font-mono uppercase tracking-widest text-yellow-600">In Progress</span>
          </div>
          <div className="text-3xl font-bold text-yellow-600">
             {consultations.filter(c => c.status === 'in-progress').length}
          </div>
        </div>

        <div className="bg-white p-6 border-b-4 border-green-500">
          <div className="flex items-center space-x-3 mb-2">
             <CheckCircle className="h-5 w-5 text-green-600" />
             <span className="text-[10px] font-mono uppercase tracking-widest text-green-600">Completed</span>
          </div>
          <div className="text-3xl font-bold text-green-600">
             {consultations.filter(c => c.status === 'completed').length}
          </div>
        </div>

        <div className="bg-white p-6">
          <div className="flex items-center space-x-3 mb-2">
             <Clock className="h-5 w-5 text-black" />
             <span className="text-[10px] font-mono uppercase tracking-widest text-black/60">Upcoming</span>
          </div>
          <div className="text-3xl font-bold">
             {consultations.filter(c => c.appointment_date > format(new Date(), 'yyyy-MM-dd')).length}
          </div>
        </div>
      </div>

      {/* Consultations List */}
      <div className="border border-black/10 bg-white">
        <div className="p-6 border-b border-black/10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold uppercase flex items-center gap-2">
              <span className="h-2 w-2 bg-black rounded-full"></span>
               Today&apos;s Consultations
            </h2>
          </div>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              onClick={refreshConsultations}
              disabled={isLoading}
              className="border-black rounded-none font-mono uppercase text-xs h-10"
            >
              <Activity className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button 
              onClick={() => setIsScheduleModalOpen(true)}
              className="bg-black hover:bg-black/80 text-white rounded-none font-mono uppercase text-xs h-10"
            >
              <Calendar className="h-4 w-4 mr-2" />
              Schedule New
            </Button>
          </div>
        </div>
        
        <div>
          {loadError && (
            <div className="p-6 border-b border-red-200 bg-red-50 text-red-700 text-sm font-mono">
              {loadError}
            </div>
          )}
          {consultations.length > 0 ? (
            consultations.map((consultation) => (
              <div
                key={consultation.id}
                className="flex flex-col md:flex-row md:items-center justify-between p-6 border-b border-black/5 hover:bg-black/[0.02] transition-colors gap-4"
              >
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-black text-white flex items-center justify-center">
                    {getConsultationTypeIcon(consultation.consultation_type)}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold uppercase">{consultation.patient_name}</h3>
                    <p className="text-xs font-mono text-black/60 uppercase">
                      TYPE: {getConsultationTypeLabel(consultation.consultation_type)}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-6">
                  <div className="text-left md:text-right">
                    <p className="text-sm font-bold uppercase">
                      {format(parseISO(consultation.appointment_date), 'MMM d, yyyy')}
                    </p>
                    <p className="text-xs font-mono text-black/60 uppercase">
                      {consultation.start_time} - {consultation.end_time}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`px-2 py-0.5 text-[10px] font-mono uppercase font-bold border tracking-tighter ${
                      consultation.status === 'in-progress' ? 'border-amber-600 text-amber-600 bg-amber-50' : 
                      consultation.status === 'completed' ? 'border-emerald-600 text-emerald-600 bg-emerald-50' : 
                      consultation.status === 'cancelled' ? 'border-red-600 text-red-600 bg-red-50' : 
                      'border-indigo-600 text-indigo-600 bg-indigo-50'
                    }`}>
                      {consultation.status}
                    </span>
                    {consultation.awaitingPatient && (
                      <span className="px-2 py-0.5 text-[10px] font-mono uppercase font-bold border tracking-tighter border-black/30 text-black/60">
                        Awaiting patient
                      </span>
                    )}

                    <div className="flex gap-2">
                      {consultation.status === 'scheduled' && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => startVideoCall(consultation)}
                            className="bg-black hover:bg-black/80 text-white rounded-none font-mono uppercase text-xs"
                          >
                            Start Video Call
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => startConsultation(consultation)}
                            className="border-black rounded-none font-mono uppercase text-xs"
                          >
                            Start Chat
                          </Button>
                        </>
                      )}
                      {consultation.status === 'in-progress' && (
                        <Button
                          size="sm"
                          onClick={() => startVideoCall(consultation)}
                          className="bg-black hover:bg-black/80 text-white rounded-none font-mono uppercase text-xs"
                        >
                          Join
                        </Button>
                      )}
                      {consultation.status === 'completed' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => startConsultation(consultation)}
                          className="border-black rounded-none font-mono uppercase text-xs"
                        >
                          View Notes
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-20 bg-white">
              <Users className="h-12 w-12 text-black/20 mx-auto mb-4" />
              <h3 className="text-xl font-bold uppercase mb-2">No Consultations</h3>
              <p className="text-black/60 font-light text-sm">You have no consultations scheduled for today.</p>
            </div>
          )}
        </div>
      </div>

      {/* Consultation Modal */}
      <Dialog open={isConsultationModalOpen} onOpenChange={setIsConsultationModalOpen}>
        <DialogContent className="max-w-2xl border border-black/10 rounded-none bg-white p-0 shadow-2xl">
          <div className="p-6 border-b border-black/10 bg-black/[0.02] flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl font-bold uppercase">Patient Consultation</DialogTitle>
              <DialogDescription className="text-xs font-mono mt-1 text-black/60 uppercase">
                {selectedConsultation?.patient_name} - {getConsultationTypeLabel(selectedConsultation?.consultation_type || 'video')}
              </DialogDescription>
            </div>
          </div>

          <div className="p-8 space-y-8">
            {/* Patient Info */}
            <div className="grid grid-cols-2 gap-px bg-black/10 border border-black/10">
              <div className="p-4 bg-white">
                <p className="text-[10px] font-mono uppercase text-black/55 mb-1">Patient Name</p>
                <p className="text-sm font-bold uppercase">{selectedConsultation?.patient_name}</p>
              </div>
              <div className="p-4 bg-white">
                <p className="text-[10px] font-mono uppercase text-black/55 mb-1">Type</p>
                <p className="text-sm font-mono uppercase">{getConsultationTypeLabel(selectedConsultation?.consultation_type || 'video')}</p>
              </div>
              <div className="p-4 bg-white">
                <p className="text-[10px] font-mono uppercase text-black/55 mb-1">Date & Time</p>
                <p className="text-sm font-mono">
                  {selectedConsultation?.appointment_date && format(parseISO(selectedConsultation.appointment_date), 'MMM d, yyyy')} | {selectedConsultation?.start_time}
                </p>
              </div>
              <div className="p-4 bg-white">
                <p className="text-[10px] font-mono uppercase text-black/55 mb-1">Status</p>
                <span className={`px-2 py-0.5 text-[10px] font-mono uppercase font-bold border border-black`}>
                  {selectedConsultation?.status}
                </span>
              </div>
            </div>

            {/* Symptoms */}
            {selectedConsultation?.symptoms && (
              <div>
                <p className="text-[10px] font-mono uppercase text-black/55 mb-2">Reported Symptoms</p>
                <div className="p-4 border border-black/10 bg-black/[0.02]">
                  <p className="text-sm font-mono">{selectedConsultation.symptoms}</p>
                </div>
              </div>
            )}

            {/* Consultation Notes */}
            <div>
              <p className="text-[10px] font-mono uppercase text-black/55 mb-2">Consultation Notes</p>
              <Textarea
                placeholder="ENTER CONSULTATION NOTES..."
                value={consultationNotes}
                onChange={(e) => setConsultationNotes(e.target.value)}
                rows={4}
                className="border-black/20 rounded-none focus:border-black font-mono text-sm uppercase placeholder:text-black/55 resize-none"
              />
            </div>

            {/* Diagnosis */}
            <div>
              <p className="text-[10px] font-mono uppercase text-black/55 mb-2">Diagnosis</p>
              <Input
                placeholder="ENTER DIAGNOSIS..."
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                className="border-black/20 rounded-none focus:border-black font-mono text-sm uppercase placeholder:text-black/55"
              />
            </div>

            {/* Prescription */}
            <div>
              <p className="text-[10px] font-mono uppercase text-black/55 mb-2">Prescription</p>
              <Textarea
                placeholder="ENTER PRESCRIPTION DETAILS..."
                value={prescription}
                onChange={(e) => setPrescription(e.target.value)}
                rows={3}
                className="border-black/20 rounded-none focus:border-black font-mono text-sm uppercase placeholder:text-black/55 resize-none"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 pt-4 border-t border-black/10">
              {selectedConsultation?.status === 'scheduled' && (
                <Button
                  className="flex-1 bg-black hover:bg-black/80 text-white rounded-none font-mono uppercase text-xs h-12"
                  onClick={() => {
                    setConsultations(prev => prev.map(c =>
                      c.id === selectedConsultation.id ? { ...c, status: 'in-progress' } : c
                    ))
                    setSelectedConsultation({ ...selectedConsultation, status: 'in-progress' })
                  }}
                >
                  Start Consultation
                </Button>
              )}
              {selectedConsultation?.status === 'in-progress' && (
                <Button
                  className="flex-1 bg-black hover:bg-black/80 text-white rounded-none font-mono uppercase text-xs h-12"
                  onClick={endConsultation}
                >
                  End Consultation
                </Button>
              )}
              <Button 
                variant="outline" 
                onClick={() => setIsConsultationModalOpen(false)}
                className="border-black/20 hover:border-black rounded-none font-mono uppercase text-xs h-12 px-8"
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Video Call Component */}
      {selectedConsultationForCall && (
        <MedicalVideoCall
          isOpen={isVideoCallOpen}
          onClose={() => {
            setIsVideoCallOpen(false)
            setSelectedConsultationForCall(null)
          }}
          consultation={selectedConsultationForCall}
          userRole="doctor"
        />
      )}

      {/* Schedule Appointment Modal */}
      <ScheduleAppointmentModal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        onSuccess={() => user && loadConsultations(user.id)}
        doctorId={doctorId}
        doctorName={user?.user_metadata?.name}
      />
    </div>
  )
} 
