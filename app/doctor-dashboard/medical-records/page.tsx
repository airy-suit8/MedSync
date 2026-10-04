"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Activity, Users, FileText, Calendar, Clock, User, Stethoscope, Search, Filter, Download, Eye, Plus, ArrowLeft } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { format, parseISO } from "date-fns"
import Link from "next/link"
import { pressable } from "@/lib/utils"

interface Patient {
  id: string
  name: string
  age: number
  gender: string
  email: string
  phone: string
  last_visit: string
  total_visits: number
  primary_condition?: string
  medications?: string[]
  allergies?: string[]
}

interface MedicalRecord {
  id: string
  patient_id: string
  patient_name: string
  record_type: 'consultation' | 'lab_result' | 'imaging' | 'prescription' | 'vaccination' | 'surgery'
  date: string
  doctor_name: string
  diagnosis?: string
  treatment?: string
  notes?: string
  attachments?: string[]
  status: 'active' | 'archived'
}

export default function MedicalRecordsPage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [patients, setPatients] = useState<Patient[]>([])
  const [medicalRecords, setMedicalRecords] = useState<MedicalRecord[]>([])
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [selectedRecord, setSelectedRecord] = useState<MedicalRecord | null>(null)
  const [isPatientModalOpen, setIsPatientModalOpen] = useState(false)
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterType, setFilterType] = useState<string>("all")
  const [showAddPatientModal, setShowAddPatientModal] = useState(false)
  const [newPatient, setNewPatient] = useState({ name: '', age: '', gender: '', email: '', phone: '' })
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

      if (user.app_metadata?.role !== "doctor") {
        router.push("/login")
        return
      }

      setUser(user)
      await loadMedicalRecords(user.id)
      setLoading(false)
    }

    checkUser()
  }, [router])

  const loadMedicalRecords = async (doctorId: string) => {
    const supabase = createClient()
    try {
      // Load patients assigned to this doctor using the relationship function
      let patientsData: any[] = []
      
      try {
        const { data: assignedPatients, error: patientsError } = await supabase
          .rpc('get_doctor_patients_bulletproof', { doctor_uuid: doctorId })
        
        if (patientsError) {
          console.error('Error loading assigned patients:', patientsError)
          throw patientsError
        }
        
        patientsData = assignedPatients || []
      } catch (rpcError) {
        console.error('Could not load assigned patients:', rpcError)
        throw rpcError
      }

      if (patientsData && patientsData.length > 0) {
        const patientsList: Patient[] = patientsData.map(p => ({
          id: p.patient_id || p.id,
          name: p.patient_name || p.name,
          age: p.age || 0,
          gender: p.gender || 'Unknown',
          email: p.patient_email || p.email || '',
          phone: p.phone || '',
          last_visit: p.last_visit || format(new Date(), 'yyyy-MM-dd'),
          total_visits: p.total_visits || 0,
          primary_condition: p.primary_condition,
          medications: p.medications || [],
          allergies: p.allergies || []
        }))
        setPatients(patientsList)

        // Load medical records for these patients
        const patientIds = patientsList.map(p => p.id)
        const { data: recordsData, error: recordsError } = await supabase
          .from('medical_records')
          .select('*')
          .in('patient_id', patientIds)
          .order('date', { ascending: false })

        if (recordsError) {
          console.error('Error loading medical records:', recordsError)
          
          // Check if table doesn't exist
          if (recordsError.code === '42P01' || recordsError.message?.includes('relation') || recordsError.message?.includes('does not exist')) {
            console.error('Medical records table is unavailable')
            setMedicalRecords([])
            return
          }
          
          console.error('Medical records error details:', {
            message: recordsError.message,
            details: recordsError.details,
            hint: recordsError.hint,
            code: recordsError.code
          })
          setMedicalRecords([])
        } else if (recordsData) {
          const recordsList: MedicalRecord[] = recordsData.map((r: any) => ({
            id: r.id,
            patient_id: r.patient_id,
            patient_name: r.patient_name || 'Unknown Patient',
            record_type: r.record_type || 'consultation',
            date: r.date,
            doctor_name: r.doctor_name || 'Dr. Smith',
            diagnosis: r.diagnosis,
            treatment: r.treatment,
            notes: r.notes,
            attachments: r.attachments || [],
            status: r.status || 'active'
          }))
          setMedicalRecords(recordsList)
        } else {
          setMedicalRecords([])
        }
      } else {
        setPatients([])
        setMedicalRecords([])
      }
    } catch (error) {
      console.error('Error loading medical records:', error)
      setPatients([])
      setMedicalRecords([])
    }
  }

  const viewPatientDetails = (patient: Patient) => {
    setSelectedPatient(patient)
    setIsPatientModalOpen(true)
  }

  const viewRecordDetails = (record: MedicalRecord) => {
    setSelectedRecord(record)
    setIsRecordModalOpen(true)
  }

  const getRecordTypeIcon = (type: string) => {
    switch (type) {
      case 'consultation': return <Stethoscope className="h-5 w-5 text-black" />
      case 'lab_result': return <FileText className="h-5 w-5 text-black" />
      case 'imaging': return <FileText className="h-5 w-5 text-black" />
      case 'prescription': return <FileText className="h-5 w-5 text-black" />
      case 'vaccination': return <FileText className="h-5 w-5 text-black" />
      case 'surgery': return <FileText className="h-5 w-5 text-black" />
      default: return <FileText className="h-5 w-5 text-black" />
    }
  }

  const getRecordTypeLabel = (type: string) => {
    switch (type) {
      case 'consultation': return 'Consultation'
      case 'lab_result': return 'Lab Result'
      case 'imaging': return 'Imaging'
      case 'prescription': return 'Prescription'
      case 'vaccination': return 'Vaccination'
      case 'surgery': return 'Surgery'
      default: return type
    }
  }

  const getRecordTypeBadge = (type: string) => {
    const baseClass = "bg-black text-white font-mono uppercase text-[10px] px-2 py-0.5 inline-block"
    switch (type) {
      case 'consultation': return <span className={baseClass}>Consultation</span>
      case 'lab_result': return <span className={baseClass}>Lab Result</span>
      case 'imaging': return <span className={baseClass}>Imaging</span>
      case 'prescription': return <span className={baseClass}>Prescription</span>
      case 'vaccination': return <span className={baseClass}>Vaccination</span>
      case 'surgery': return <span className={baseClass}>Surgery</span>
      default: return <span className={baseClass}>{type}</span>
    }
  }

  const filteredRecords = medicalRecords.filter(record => {
    const matchesSearch = record.patient_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         record.diagnosis?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         record.notes?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesFilter = filterType === 'all' || record.record_type === filterType
    return matchesSearch && matchesFilter
  })

  const handleExportRecords = () => {
    // Export medicalRecords as CSV
    const csvRows = [
      ['Patient Name', 'Record Type', 'Date', 'Doctor', 'Diagnosis', 'Treatment', 'Notes'],
      ...medicalRecords.map(r => [
        r.patient_name,
        r.record_type,
        r.date,
        r.doctor_name,
        r.diagnosis || '',
        r.treatment || '',
        r.notes || ''
      ])
    ]
    const csvContent = csvRows.map(e => e.map(x => '"' + String(x).replace(/"/g, '""') + '"').join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'medical_records.csv'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <div className="text-center flex flex-col items-center">
          <Activity className="h-8 w-8 text-black animate-spin mx-auto mb-4" />
          <p className="text-black/60 font-mono uppercase text-xs tracking-widest">Loading records...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-transparent p-6 md:p-12 max-w-[1600px] mx-auto">
      {/* Header */}
      <header className="border-b border-black/10 pb-6 mb-8 flex-shrink-0 flex items-end justify-between">
        <div>
          <Link href="/doctor-dashboard" className="inline-flex items-center space-x-2 text-xs font-mono uppercase tracking-widest text-black/55 hover:text-black mb-4 transition-colors">
            <ArrowLeft className="h-3 w-3" />
            <span>Back to Dashboard</span>
          </Link>
          <div className="flex items-center gap-4">
            <h1 className="text-4xl font-bold tracking-tight uppercase">Medical Records</h1>
          </div>
          <p className="text-sm font-mono text-black/60 uppercase mt-2">
            Patient History & Results
          </p>
        </div>
        <div className="text-right hidden md:block">
          <span className="text-[10px] font-mono uppercase tracking-widest text-black/55 block mb-1">
            System Status
          </span>
          <span className="text-xl font-mono border-b border-black inline-flex items-center gap-2">
            <span className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></span>
            ACTIVE
          </span>
        </div>
      </header>

      {/* Quick Stats */}
      <div className="grid md:grid-cols-4 gap-6 mb-12">
        <div className="border border-black/10 bg-white p-6 relative group hover:border-black transition-colors">
          <div className="absolute top-0 right-0 bg-black text-white text-[10px] font-mono px-2 py-1 uppercase">Total</div>
          <h3 className="text-xs font-mono text-black/60 uppercase mb-4 tracking-widest">Patients</h3>
          <div className="text-4xl font-bold">{patients.length}</div>
        </div>

        <div className="border border-black/10 bg-white p-6 relative group hover:border-black transition-colors">
          <div className="absolute top-0 right-0 bg-black text-white text-[10px] font-mono px-2 py-1 uppercase">Records</div>
          <h3 className="text-xs font-mono text-black/60 uppercase mb-4 tracking-widest">All Records</h3>
          <div className="text-4xl font-bold">{medicalRecords.length}</div>
        </div>

        <div className="border border-black/10 bg-white p-6 relative group hover:border-black transition-colors">
          <div className="absolute top-0 right-0 bg-black text-white text-[10px] font-mono px-2 py-1 uppercase">Activity</div>
          <h3 className="text-xs font-mono text-black/60 uppercase mb-4 tracking-widest">Last 7 Days</h3>
          <div className="text-4xl font-bold">
            {medicalRecords.filter(r => {
              const recordDate = new Date(r.date)
              const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
              return recordDate >= weekAgo
            }).length}
          </div>
        </div>

        <div className="border border-black/10 bg-white p-6 relative group hover:border-black transition-colors">
          <div className="absolute top-0 right-0 bg-black text-white text-[10px] font-mono px-2 py-1 uppercase">Current</div>
          <h3 className="text-xs font-mono text-black/60 uppercase mb-4 tracking-widest">Active Records</h3>
          <div className="text-4xl font-bold">
            {medicalRecords.filter(r => r.status === 'active').length}
          </div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-black/55 h-4 w-4" />
            <Input
              placeholder="SEARCH PATIENTS, DIAGNOSES..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 rounded-none border-black/20 focus:border-black font-mono text-sm uppercase placeholder:text-black/55 h-12"
            />
          </div>
        </div>
        <div className="flex space-x-4">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-2 border border-black/20 focus:border-black rounded-none font-mono text-sm uppercase bg-white outline-none h-12"
          >
            <option value="all">All Records</option>
            <option value="consultation">Consultations</option>
            <option value="lab_result">Lab Results</option>
            <option value="imaging">Imaging</option>
            <option value="prescription">Prescriptions</option>
            <option value="vaccination">Vaccinations</option>
            <option value="surgery">Surgeries</option>
          </select>
          <Button variant="outline" className="border-black rounded-none font-mono uppercase text-sm h-12 px-6">
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </Button>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-2 gap-12 mb-12">
        {/* Patients List */}
        <div>
          <div className="flex items-center justify-between mb-6 border-b border-black/10 pb-4">
            <h2 className="text-xl font-bold uppercase flex items-center">
              <Users className="mr-3 h-5 w-5" />
              Directory
            </h2>
            <Button size="sm" variant="outline" className="border-black rounded-none font-mono uppercase text-[10px]" disabled>
              <Plus className="h-3 w-3 mr-2" />
              Add
            </Button>
          </div>
          
          <div className="space-y-4">
            {patients.map((patient) => (
              <div 
                key={patient.id} 
                className="group border border-black/10 p-6 bg-white hover:border-black cursor-pointer transition-colors"
                {...pressable(() => viewPatientDetails(patient))}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4">
                    <div className="w-12 h-12 bg-black text-white flex items-center justify-center flex-shrink-0">
                      <User className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-bold text-lg uppercase group-hover:underline underline-offset-4">{patient.name}</p>
                      <div className="flex items-center gap-2 mt-1 mb-2">
                        <span className="text-[10px] font-mono border border-black px-1.5 py-0.5 uppercase">{patient.age} YRS</span>
                        <span className="text-[10px] font-mono border border-black px-1.5 py-0.5 uppercase">{patient.gender}</span>
                      </div>
                      <p className="text-[10px] font-mono text-black/60 uppercase line-clamp-1">{patient.primary_condition || 'NO PRIMARY CONDITION'}</p>
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end">
                    <span className="text-2xl font-bold font-mono">{patient.total_visits}</span>
                    <span className="text-[10px] font-mono text-black/60 uppercase">VISITS</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Medical Records */}
        <div>
          <div className="flex items-center justify-between mb-6 border-b border-black/10 pb-4">
            <h2 className="text-xl font-bold uppercase flex items-center">
              <FileText className="mr-3 h-5 w-5" />
              Records Log
            </h2>
            <Button size="sm" variant="outline" className="border-black rounded-none font-mono uppercase text-[10px]" onClick={handleExportRecords}>
              <Download className="h-3 w-3 mr-2" />
              Export
            </Button>
          </div>
          
          <div className="space-y-4">
            {filteredRecords.length > 0 ? (
              filteredRecords.slice(0, 10).map((record) => (
                <div 
                  key={record.id} 
                  className="group border border-black/10 p-6 bg-white hover:border-black cursor-pointer transition-colors"
                  {...pressable(() => viewRecordDetails(record))}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 border border-black flex items-center justify-center bg-black/[0.02]">
                        {getRecordTypeIcon(record.record_type)}
                      </div>
                      <p className="font-bold uppercase group-hover:underline underline-offset-4">{record.patient_name}</p>
                    </div>
                    {getRecordTypeBadge(record.record_type)}
                  </div>
                  
                  <p className="text-sm font-mono uppercase mb-3 line-clamp-1 border-l-2 border-black pl-3">{record.diagnosis || 'NO DIAGNOSIS LOGGED'}</p>
                  
                  <div className="flex items-center justify-between text-[10px] font-mono text-black/60 uppercase border-t border-black/10 pt-4 mt-2">
                    <span>{format(parseISO(record.date), 'dd MMM yyyy')}</span>
                    <span>{record.doctor_name}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 border border-black/10 bg-black/[0.02]">
                <FileText className="h-8 w-8 mx-auto mb-4 text-black/20" />
                <p className="font-mono text-xs uppercase tracking-widest text-black/55">NO RECORDS FOUND</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Patient Details Modal */}
      <Dialog open={isPatientModalOpen} onOpenChange={setIsPatientModalOpen}>
        <DialogContent className="sm:max-w-2xl rounded-none border-2 border-black shadow-2xl p-0 overflow-hidden bg-white">
          <div className="border-b border-black p-6 bg-black/[0.02] flex justify-between items-start">
            <div>
              <DialogTitle className="text-2xl font-bold uppercase mb-1">Patient Dossier</DialogTitle>
              <DialogDescription className="font-mono text-[10px] uppercase text-black/60">
                ID: {selectedPatient?.id.split('-').pop()} • {selectedPatient?.name}
              </DialogDescription>
            </div>
          </div>
          
          <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto">
            {/* Patient Info */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-black/10 border border-black/10">
              <div className="bg-white p-4">
                <p className="text-[10px] font-mono text-black/55 uppercase mb-1">Name</p>
                <p className="font-bold uppercase text-sm">{selectedPatient?.name}</p>
              </div>
              <div className="bg-white p-4">
                <p className="text-[10px] font-mono text-black/55 uppercase mb-1">Demographics</p>
                <p className="font-bold uppercase text-sm">{selectedPatient?.age}Y • {selectedPatient?.gender}</p>
              </div>
              <div className="bg-white p-4">
                <p className="text-[10px] font-mono text-black/55 uppercase mb-1">Email</p>
                <p className="font-bold uppercase text-sm truncate" title={selectedPatient?.email}>{selectedPatient?.email}</p>
              </div>
              <div className="bg-white p-4">
                <p className="text-[10px] font-mono text-black/55 uppercase mb-1">Phone</p>
                <p className="font-bold uppercase text-sm">{selectedPatient?.phone}</p>
              </div>
            </div>

            {/* Medical Info */}
            <div>
              <p className="text-[10px] font-mono text-black/55 uppercase mb-2">Primary Condition</p>
              <div className="border border-black/10 p-4 bg-black/[0.02]">
                <p className="font-mono text-sm uppercase">{selectedPatient?.primary_condition || 'NONE SPECIFIED'}</p>
              </div>
            </div>

            {/* Medications */}
            {selectedPatient?.medications && selectedPatient.medications.length > 0 && (
              <div>
                <p className="text-[10px] font-mono text-black/55 uppercase mb-2">Current Medications</p>
                <div className="flex flex-wrap gap-2">
                  {selectedPatient.medications.map((med, index) => (
                    <span key={index} className="border border-black px-2 py-1 font-mono text-[10px] uppercase bg-white">
                      {med}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Allergies */}
            {selectedPatient?.allergies && selectedPatient.allergies.length > 0 && (
              <div>
                <p className="text-[10px] font-mono text-black/55 uppercase mb-2">Known Allergies</p>
                <div className="flex flex-wrap gap-2">
                  {selectedPatient.allergies.map((allergy, index) => (
                    <span key={index} className="border border-red-500 text-red-600 bg-red-50 px-2 py-1 font-mono text-[10px] uppercase font-bold">
                      {allergy}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Visit History */}
            <div className="border-t border-black/10 pt-6">
              <div className="flex justify-between items-center bg-black text-white p-4">
                <div>
                  <p className="text-[10px] font-mono text-white/60 uppercase mb-1">Visit Metrics</p>
                  <p className="font-bold uppercase text-xl">{selectedPatient?.total_visits} TOTAL VISITS</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-mono text-white/60 uppercase mb-1">Last Interaction</p>
                  <p className="font-bold uppercase text-sm">
                    {selectedPatient?.last_visit && format(parseISO(selectedPatient.last_visit), 'dd MMM yyyy')}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex space-x-4 pt-4">
              <Button 
                className="flex-1 bg-black hover:bg-black/80 text-white rounded-none font-mono uppercase text-xs h-12" 
                onClick={() => router.push(`/doctor-dashboard/consultations?patient=${selectedPatient?.id}`)}
              >
                Schedule Consult
              </Button>
              <Button 
                variant="outline" 
                className="flex-1 border-black rounded-none font-mono uppercase text-xs h-12 hover:bg-black/5"
                onClick={() => setIsPatientModalOpen(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Record Details Modal */}
      <Dialog open={isRecordModalOpen} onOpenChange={setIsRecordModalOpen}>
        <DialogContent className="sm:max-w-2xl rounded-none border-2 border-black shadow-2xl p-0 overflow-hidden bg-white">
          <div className="border-b border-black p-6 bg-black/[0.02]">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 bg-black text-white flex items-center justify-center">
                {selectedRecord && getRecordTypeIcon(selectedRecord.record_type)}
              </div>
              <DialogTitle className="text-2xl font-bold uppercase">Record Entry</DialogTitle>
            </div>
            <DialogDescription className="font-mono text-[10px] uppercase text-black/60">
              {selectedRecord?.patient_name} • REF-{selectedRecord?.id.substring(0,8)}
            </DialogDescription>
          </div>
          
          <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto">
            {/* Record Info */}
            <div className="grid grid-cols-2 gap-px bg-black/10 border border-black/10">
              <div className="bg-white p-4">
                <p className="text-[10px] font-mono text-black/55 uppercase mb-1">Patient</p>
                <p className="font-bold uppercase text-sm">{selectedRecord?.patient_name}</p>
              </div>
              <div className="bg-white p-4">
                <p className="text-[10px] font-mono text-black/55 uppercase mb-1">Type</p>
                <div className="mt-1">
                  {selectedRecord && getRecordTypeBadge(selectedRecord.record_type)}
                </div>
              </div>
              <div className="bg-white p-4">
                <p className="text-[10px] font-mono text-black/55 uppercase mb-1">Date</p>
                <p className="font-bold uppercase text-sm font-mono">
                  {selectedRecord?.date && format(parseISO(selectedRecord.date), 'dd MMM yyyy')}
                </p>
              </div>
              <div className="bg-white p-4">
                <p className="text-[10px] font-mono text-black/55 uppercase mb-1">Attending</p>
                <p className="font-bold uppercase text-sm">{selectedRecord?.doctor_name}</p>
              </div>
            </div>

            {/* Diagnosis */}
            {selectedRecord?.diagnosis && (
              <div>
                <p className="text-[10px] font-mono text-black/55 uppercase mb-2">Diagnosis</p>
                <div className="border border-black p-4 bg-white relative">
                  <span className="absolute -top-2.5 left-4 bg-white px-2 font-bold text-[10px] tracking-widest uppercase">Dx</span>
                  <p className="font-mono text-sm leading-relaxed">{selectedRecord.diagnosis}</p>
                </div>
              </div>
            )}

            {/* Treatment */}
            {selectedRecord?.treatment && (
              <div>
                <p className="text-[10px] font-mono text-black/55 uppercase mb-2">Treatment Plan</p>
                <div className="border border-black/20 p-4 bg-black/[0.02]">
                  <p className="font-mono text-sm leading-relaxed">{selectedRecord.treatment}</p>
                </div>
              </div>
            )}

            {/* Notes */}
            {selectedRecord?.notes && (
              <div>
                <p className="text-[10px] font-mono text-black/55 uppercase mb-2">Clinical Notes</p>
                <div className="border border-black/20 p-4 bg-black/[0.02]">
                  <p className="font-mono text-sm leading-relaxed">{selectedRecord.notes}</p>
                </div>
              </div>
            )}

            <div className="flex space-x-4 pt-6 border-t border-black/10">
              <Button className="flex-1 bg-black hover:bg-black/80 text-white rounded-none font-mono uppercase text-xs h-12">
                <Download className="h-4 w-4 mr-2" />
                Export PDF
              </Button>
              <Button 
                variant="outline" 
                className="flex-1 border-black rounded-none font-mono uppercase text-xs h-12 hover:bg-black/5"
                onClick={() => setIsRecordModalOpen(false)}
              >
                Dismiss
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
} 
