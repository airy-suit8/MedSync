"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Activity, Users, Video, Phone, MessageSquare, Calendar, Clock, User, FileText, Stethoscope } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { format, parseISO } from "date-fns"

interface Consultation {
  id: string
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

export default function ConsultationsPage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [consultations, setConsultations] = useState<Consultation[]>([])
  const [selectedConsultation, setSelectedConsultation] = useState<Consultation | null>(null)
  const [isConsultationModalOpen, setIsConsultationModalOpen] = useState(false)
  const [consultationNotes, setConsultationNotes] = useState("")
  const [diagnosis, setDiagnosis] = useState("")
  const [prescription, setPrescription] = useState("")
  const router = useRouter()

  useEffect(() => {
    const checkUser = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push("/login")
        return
      }

      if (user.user_metadata?.role !== "doctor") {
        router.push("/login")
        return
      }

      setUser(user)
      await loadConsultations(user.id)
      setLoading(false)
    }

    checkUser()
  }, [router])

  const loadConsultations = async (doctorId: string) => {
    const supabase = createClient()
    
    try {
      // Load today's consultations
      const today = format(new Date(), 'yyyy-MM-dd')
      const { data: appointments, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('doctor_id', doctorId)
        .gte('appointment_date', today)
        .order('appointment_date', { ascending: true })
        .order('start_time', { ascending: true })

      if (error) {
        console.error('Error loading consultations:', error)
        // Load demo data as fallback
        loadDemoConsultations()
        return
      }

      if (appointments && appointments.length > 0) {
        const consultationsData: Consultation[] = appointments.map(apt => ({
          id: apt.id,
          patient_name: apt.patient_name || 'Unknown Patient',
          patient_id: apt.patient_id,
          appointment_date: apt.appointment_date,
          start_time: apt.start_time,
          end_time: apt.end_time,
          status: apt.status || 'scheduled',
          consultation_type: apt.consultation_type || 'video',
          notes: apt.notes,
          symptoms: apt.symptoms,
          diagnosis: apt.diagnosis,
          prescription: apt.prescription
        }))
        setConsultations(consultationsData)
      } else {
        loadDemoConsultations()
      }
    } catch (error) {
      console.error('Error loading consultations:', error)
      loadDemoConsultations()
    }
  }

  const loadDemoConsultations = () => {
    const demoConsultations: Consultation[] = [
      {
        id: 'demo-1',
        patient_name: 'John Doe',
        patient_id: 'patient-001',
        appointment_date: format(new Date(), 'yyyy-MM-dd'),
        start_time: '09:00',
        end_time: '09:30',
        status: 'scheduled',
        consultation_type: 'video',
        symptoms: 'Headache, fever, fatigue'
      },
      {
        id: 'demo-2',
        patient_name: 'Sarah Smith',
        patient_id: 'patient-002',
        appointment_date: format(new Date(), 'yyyy-MM-dd'),
        start_time: '10:00',
        end_time: '10:30',
        status: 'in-progress',
        consultation_type: 'audio',
        symptoms: 'Chest pain, shortness of breath'
      },
      {
        id: 'demo-3',
        patient_name: 'Mike Johnson',
        patient_id: 'patient-003',
        appointment_date: format(new Date(), 'yyyy-MM-dd'),
        start_time: '11:00',
        end_time: '11:30',
        status: 'scheduled',
        consultation_type: 'chat',
        symptoms: 'Back pain, difficulty walking'
      },
      {
        id: 'demo-4',
        patient_name: 'Emily Davis',
        patient_id: 'patient-004',
        appointment_date: format(new Date(Date.now() + 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
        start_time: '14:00',
        end_time: '14:30',
        status: 'scheduled',
        consultation_type: 'video',
        symptoms: 'Skin rash, itching'
      }
    ]
    setConsultations(demoConsultations)
  }

  const startConsultation = (consultation: Consultation) => {
    setSelectedConsultation(consultation)
    setIsConsultationModalOpen(true)
  }

  const endConsultation = async () => {
    if (!selectedConsultation) return

    const supabase = createClient()
    
    try {
      // Update consultation status and notes
      const { error } = await supabase
        .from('appointments')
        .update({
          status: 'completed',
          notes: consultationNotes,
          diagnosis: diagnosis,
          prescription: prescription,
          completed_at: new Date().toISOString()
        })
        .eq('id', selectedConsultation.id)

      if (error) {
        console.error('Error updating consultation:', error)
      } else {
        // Update local state
        setConsultations(prev => prev.map(c => 
          c.id === selectedConsultation.id 
            ? { ...c, status: 'completed', notes: consultationNotes, diagnosis, prescription }
            : c
        ))
      }
    } catch (error) {
      console.error('Error ending consultation:', error)
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center">
        <div className="text-center">
          <Activity className="h-8 w-8 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading consultations...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Image src="/medi.png" alt="MedSync Logo" width={32} height={32} />
            <span className="text-2xl font-bold text-gray-900">MedSync</span>
            <Badge className="bg-blue-100 text-blue-800">Doctor Portal</Badge>
          </div>
          <div className="flex items-center space-x-4">
            <Link href="/doctor-dashboard">
              <Button variant="outline" className="bg-white text-blue-600 border-blue-200 hover:bg-blue-50">
                Back to Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Patient Consultations</h1>
          <p className="text-gray-600">
            Conduct virtual consultations and patient assessments with real-time communication tools.
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card className="border-blue-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Today's Consultations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {consultations.filter(c => c.appointment_date === format(new Date(), 'yyyy-MM-dd')).length}
              </div>
              <p className="text-xs text-gray-500">Scheduled</p>
            </CardContent>
          </Card>

          <Card className="border-green-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">In Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {consultations.filter(c => c.status === 'in-progress').length}
              </div>
              <p className="text-xs text-gray-500">Active</p>
            </CardContent>
          </Card>

          <Card className="border-purple-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Completed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                {consultations.filter(c => c.status === 'completed').length}
              </div>
              <p className="text-xs text-gray-500">Today</p>
            </CardContent>
          </Card>

          <Card className="border-orange-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Upcoming</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {consultations.filter(c => c.appointment_date > format(new Date(), 'yyyy-MM-dd')).length}
              </div>
              <p className="text-xs text-gray-500">Next 7 days</p>
            </CardContent>
          </Card>
        </div>

        {/* Consultations List */}
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Today's Consultations</span>
                <div className="flex space-x-2">
                  <Button variant="outline" size="sm">
                    <Calendar className="h-4 w-4 mr-2" />
                    Schedule New
                  </Button>
                </div>
              </CardTitle>
              <CardDescription>Manage your patient consultations and assessments</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {consultations.length > 0 ? (
                  consultations.map((consultation) => (
                    <div 
                      key={consultation.id} 
                      className="flex items-center justify-between p-4 border rounded-lg hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                          {getConsultationTypeIcon(consultation.consultation_type)}
                          <div>
                            <p className="font-medium text-gray-900">{consultation.patient_name}</p>
                            <p className="text-sm text-gray-600">{getConsultationTypeLabel(consultation.consultation_type)}</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <p className="text-sm font-medium text-gray-900">
                            {format(parseISO(consultation.appointment_date), 'MMM d, yyyy')}
                          </p>
                          <p className="text-sm text-gray-600">
                            {consultation.start_time} - {consultation.end_time}
                          </p>
                        </div>
                        {getStatusBadge(consultation.status)}
                        <div className="flex space-x-2">
                          {consultation.status === 'scheduled' && (
                            <Button 
                              size="sm" 
                              onClick={() => startConsultation(consultation)}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              Start
                            </Button>
                          )}
                          {consultation.status === 'in-progress' && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => startConsultation(consultation)}
                            >
                              Join
                            </Button>
                          )}
                          {consultation.status === 'completed' && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => startConsultation(consultation)}
                            >
                              View Notes
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Users className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <p>No consultations scheduled for today</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Consultation Modal */}
      <Dialog open={isConsultationModalOpen} onOpenChange={setIsConsultationModalOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Patient Consultation</DialogTitle>
            <DialogDescription>
              {selectedConsultation?.patient_name} - {getConsultationTypeLabel(selectedConsultation?.consultation_type || 'video')}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Patient Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="font-medium text-gray-900">Patient Name</p>
                <p className="text-sm text-gray-600">{selectedConsultation?.patient_name}</p>
              </div>
              <div>
                <p className="font-medium text-gray-900">Consultation Type</p>
                <p className="text-sm text-gray-600">{getConsultationTypeLabel(selectedConsultation?.consultation_type || 'video')}</p>
              </div>
              <div>
                <p className="font-medium text-gray-900">Date & Time</p>
                <p className="text-sm text-gray-600">
                  {selectedConsultation?.appointment_date && format(parseISO(selectedConsultation.appointment_date), 'MMM d, yyyy')} at {selectedConsultation?.start_time}
                </p>
              </div>
              <div>
                <p className="font-medium text-gray-900">Status</p>
                {selectedConsultation && getStatusBadge(selectedConsultation.status)}
              </div>
            </div>

            {/* Symptoms */}
            {selectedConsultation?.symptoms && (
              <div>
                <p className="font-medium text-gray-900 mb-2">Reported Symptoms</p>
                <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">{selectedConsultation.symptoms}</p>
              </div>
            )}

            {/* Consultation Notes */}
            <div>
              <p className="font-medium text-gray-900 mb-2">Consultation Notes</p>
              <Textarea
                placeholder="Enter consultation notes..."
                value={consultationNotes}
                onChange={(e) => setConsultationNotes(e.target.value)}
                rows={4}
              />
            </div>

            {/* Diagnosis */}
            <div>
              <p className="font-medium text-gray-900 mb-2">Diagnosis</p>
              <Input
                placeholder="Enter diagnosis..."
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
              />
            </div>

            {/* Prescription */}
            <div>
              <p className="font-medium text-gray-900 mb-2">Prescription</p>
              <Textarea
                placeholder="Enter prescription details..."
                value={prescription}
                onChange={(e) => setPrescription(e.target.value)}
                rows={3}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-2">
              {selectedConsultation?.status === 'scheduled' && (
                <Button 
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  onClick={() => {
                    // Update status to in-progress
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
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                  onClick={endConsultation}
                >
                  End Consultation
                </Button>
              )}
              <Button variant="outline" onClick={() => setIsConsultationModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
} 