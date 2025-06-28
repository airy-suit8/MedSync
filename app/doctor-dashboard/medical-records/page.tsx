"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Activity, Users, FileText, Calendar, Clock, User, Stethoscope, Search, Filter, Download, Eye, Plus } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { format, parseISO } from "date-fns"
import Link from "next/link"

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

      if (user.user_metadata?.role !== "doctor") {
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
      // Load patients for this doctor
      const { data: patientsData, error: patientsError } = await supabase
        .from('patients')
        .select('*')
        .eq('doctor_id', doctorId)
        .order('name', { ascending: true })

      if (patientsError) {
        console.error('Error loading patients:', patientsError)
        // Only use demo data if table does not exist
        if (patientsError.code === '42P01' || patientsError.message?.includes('relation') || patientsError.message?.includes('does not exist')) {
          loadDemoData()
          return
        }
        // For other errors, show error and do not use demo data
        alert('Failed to load patients: ' + patientsError.message)
        return
      }

      if (patientsData && patientsData.length > 0) {
        const patientsList: Patient[] = patientsData.map(p => ({
          id: p.id,
          name: p.name,
          age: p.age || 0,
          gender: p.gender || 'Unknown',
          email: p.email || '',
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

        if (!recordsError && recordsData) {
          const recordsList: MedicalRecord[] = recordsData.map(r => ({
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
          alert('Failed to load medical records: ' + (recordsError?.message || 'Unknown error'))
          setMedicalRecords([])
        }
      } else {
        // Only use demo data if there are truly no patients
        loadDemoData()
      }
    } catch (error) {
      console.error('Error loading medical records:', error)
      alert('An error occurred while loading medical records.')
    }
  }

  const loadDemoData = () => {
    const demoPatients: Patient[] = [
      {
        id: 'patient-001',
        name: 'John Doe',
        age: 45,
        gender: 'Male',
        email: 'john.doe@email.com',
        phone: '+1 (555) 123-4567',
        last_visit: format(new Date(), 'yyyy-MM-dd'),
        total_visits: 12,
        primary_condition: 'Hypertension',
        medications: ['Lisinopril', 'Metformin'],
        allergies: ['Penicillin', 'Sulfa drugs']
      },
      {
        id: 'patient-002',
        name: 'Sarah Smith',
        age: 32,
        gender: 'Female',
        email: 'sarah.smith@email.com',
        phone: '+1 (555) 234-5678',
        last_visit: format(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
        total_visits: 8,
        primary_condition: 'Diabetes Type 2',
        medications: ['Metformin', 'Glipizide'],
        allergies: ['Latex']
      },
      {
        id: 'patient-003',
        name: 'Mike Johnson',
        age: 58,
        gender: 'Male',
        email: 'mike.johnson@email.com',
        phone: '+1 (555) 345-6789',
        last_visit: format(new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
        total_visits: 15,
        primary_condition: 'Heart Disease',
        medications: ['Atorvastatin', 'Amlodipine', 'Aspirin'],
        allergies: ['Shellfish']
      }
    ]
    setPatients(demoPatients)
    loadDemoMedicalRecords(demoPatients)
  }

  const loadDemoMedicalRecords = (patientsList: Patient[]) => {
    const demoRecords: MedicalRecord[] = [
      {
        id: 'record-001',
        patient_id: 'patient-001',
        patient_name: 'John Doe',
        record_type: 'consultation',
        date: format(new Date(), 'yyyy-MM-dd'),
        doctor_name: 'Dr. Smith',
        diagnosis: 'Hypertension - Well controlled',
        treatment: 'Continue current medication regimen',
        notes: 'Patient reports good compliance with medications. Blood pressure readings are stable.',
        status: 'active'
      },
      {
        id: 'record-002',
        patient_id: 'patient-001',
        patient_name: 'John Doe',
        record_type: 'lab_result',
        date: format(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
        doctor_name: 'Dr. Smith',
        diagnosis: 'Blood work normal',
        notes: 'All values within normal range. Cholesterol levels improved.',
        status: 'active'
      },
      {
        id: 'record-003',
        patient_id: 'patient-002',
        patient_name: 'Sarah Smith',
        record_type: 'consultation',
        date: format(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
        doctor_name: 'Dr. Smith',
        diagnosis: 'Diabetes Type 2 - Stable',
        treatment: 'Adjust Metformin dosage',
        notes: 'Blood sugar levels slightly elevated. Increase Metformin to 1000mg twice daily.',
        status: 'active'
      },
      {
        id: 'record-004',
        patient_id: 'patient-003',
        patient_name: 'Mike Johnson',
        record_type: 'imaging',
        date: format(new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
        doctor_name: 'Dr. Smith',
        diagnosis: 'Chest X-ray normal',
        notes: 'No significant findings. Heart size normal.',
        status: 'active'
      }
    ]
    setMedicalRecords(demoRecords)
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
      case 'consultation': return <Stethoscope className="h-5 w-5 text-blue-600" />
      case 'lab_result': return <FileText className="h-5 w-5 text-green-600" />
      case 'imaging': return <FileText className="h-5 w-5 text-purple-600" />
      case 'prescription': return <FileText className="h-5 w-5 text-orange-600" />
      case 'vaccination': return <FileText className="h-5 w-5 text-indigo-600" />
      case 'surgery': return <FileText className="h-5 w-5 text-red-600" />
      default: return <FileText className="h-5 w-5 text-gray-600" />
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
    switch (type) {
      case 'consultation': return <Badge className="bg-blue-100 text-blue-800">Consultation</Badge>
      case 'lab_result': return <Badge className="bg-green-100 text-green-800">Lab Result</Badge>
      case 'imaging': return <Badge className="bg-purple-100 text-purple-800">Imaging</Badge>
      case 'prescription': return <Badge className="bg-orange-100 text-orange-800">Prescription</Badge>
      case 'vaccination': return <Badge className="bg-indigo-100 text-indigo-800">Vaccination</Badge>
      case 'surgery': return <Badge className="bg-red-100 text-red-800">Surgery</Badge>
      default: return <Badge className="bg-gray-100 text-gray-800">{type}</Badge>
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center">
        <div className="text-center">
          <Activity className="h-8 w-8 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading medical records...</p>
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Medical Records</h1>
          <p className="text-gray-600">
            Access comprehensive patient medical histories, lab results, and treatment records.
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card className="border-blue-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Patients</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{patients.length}</div>
              <p className="text-xs text-gray-500">Under care</p>
            </CardContent>
          </Card>

          <Card className="border-green-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Medical Records</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{medicalRecords.length}</div>
              <p className="text-xs text-gray-500">Total records</p>
            </CardContent>
          </Card>

          <Card className="border-purple-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                {medicalRecords.filter(r => {
                  const recordDate = new Date(r.date)
                  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                  return recordDate >= weekAgo
                }).length}
              </div>
              <p className="text-xs text-gray-500">Last 7 days</p>
            </CardContent>
          </Card>

          <Card className="border-orange-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Active Records</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {medicalRecords.filter(r => r.status === 'active').length}
              </div>
              <p className="text-xs text-gray-500">Current</p>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search patients, diagnoses, or notes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <div className="flex space-x-2">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Records</option>
              <option value="consultation">Consultations</option>
              <option value="lab_result">Lab Results</option>
              <option value="imaging">Imaging</option>
              <option value="prescription">Prescriptions</option>
              <option value="vaccination">Vaccinations</option>
              <option value="surgery">Surgeries</option>
            </select>
            <Button variant="outline">
              <Filter className="h-4 w-4 mr-2" />
              Filter
            </Button>
          </div>
        </div>

        {/* Patients List */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Patients</span>
                <Button size="sm" variant="outline" disabled>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Patient
                </Button>
              </CardTitle>
              <CardDescription>Your patient roster with medical history</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {patients.map((patient) => (
                  <div 
                    key={patient.id} 
                    className="flex items-center justify-between p-4 border rounded-lg hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => viewPatientDetails(patient)}
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <User className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{patient.name}</p>
                        <p className="text-sm text-gray-600">{patient.age} years, {patient.gender}</p>
                        <p className="text-xs text-gray-500">{patient.primary_condition}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">{patient.total_visits} visits</p>
                      <p className="text-xs text-gray-500">
                        Last: {format(parseISO(patient.last_visit), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Medical Records */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Medical Records</span>
                <Button size="sm" variant="outline" onClick={handleExportRecords}>
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </CardTitle>
              <CardDescription>Recent medical records and updates</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredRecords.length > 0 ? (
                  filteredRecords.slice(0, 10).map((record) => (
                    <div 
                      key={record.id} 
                      className="flex items-center justify-between p-4 border rounded-lg hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => viewRecordDetails(record)}
                    >
                      <div className="flex items-center space-x-4">
                        {getRecordTypeIcon(record.record_type)}
                        <div>
                          <p className="font-medium text-gray-900">{record.patient_name}</p>
                          <p className="text-sm text-gray-600">{record.diagnosis}</p>
                          <p className="text-xs text-gray-500">
                            {format(parseISO(record.date), 'MMM d, yyyy')} - {record.doctor_name}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {getRecordTypeBadge(record.record_type)}
                        <Button size="sm" variant="outline">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <FileText className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <p>No medical records found</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Patient Details Modal */}
      <Dialog open={isPatientModalOpen} onOpenChange={setIsPatientModalOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Patient Details</DialogTitle>
            <DialogDescription>
              {selectedPatient?.name} - Medical History
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Patient Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="font-medium text-gray-900">Name</p>
                <p className="text-sm text-gray-600">{selectedPatient?.name}</p>
              </div>
              <div>
                <p className="font-medium text-gray-900">Age & Gender</p>
                <p className="text-sm text-gray-600">{selectedPatient?.age} years, {selectedPatient?.gender}</p>
              </div>
              <div>
                <p className="font-medium text-gray-900">Email</p>
                <p className="text-sm text-gray-600">{selectedPatient?.email}</p>
              </div>
              <div>
                <p className="font-medium text-gray-900">Phone</p>
                <p className="text-sm text-gray-600">{selectedPatient?.phone}</p>
              </div>
            </div>

            {/* Medical Info */}
            <div>
              <p className="font-medium text-gray-900 mb-2">Primary Condition</p>
              <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">{selectedPatient?.primary_condition || 'None specified'}</p>
            </div>

            {/* Medications */}
            {selectedPatient?.medications && selectedPatient.medications.length > 0 && (
              <div>
                <p className="font-medium text-gray-900 mb-2">Current Medications</p>
                <div className="flex flex-wrap gap-2">
                  {selectedPatient.medications.map((med, index) => (
                    <Badge key={index} className="bg-blue-100 text-blue-800">{med}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Allergies */}
            {selectedPatient?.allergies && selectedPatient.allergies.length > 0 && (
              <div>
                <p className="font-medium text-gray-900 mb-2">Allergies</p>
                <div className="flex flex-wrap gap-2">
                  {selectedPatient.allergies.map((allergy, index) => (
                    <Badge key={index} className="bg-red-100 text-red-800">{allergy}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Visit History */}
            <div>
              <p className="font-medium text-gray-900 mb-2">Visit History</p>
              <p className="text-sm text-gray-600">
                Total visits: {selectedPatient?.total_visits} | 
                Last visit: {selectedPatient?.last_visit && format(parseISO(selectedPatient.last_visit), 'MMM d, yyyy')}
              </p>
            </div>

            <div className="flex space-x-2">
              <Button className="flex-1" onClick={() => router.push(`/doctor-dashboard/consultations?patient=${selectedPatient?.id}`)}>
                Schedule Consultation
              </Button>
              <Button variant="outline" onClick={() => setIsPatientModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Record Details Modal */}
      <Dialog open={isRecordModalOpen} onOpenChange={setIsRecordModalOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Medical Record Details</DialogTitle>
            <DialogDescription>
              {selectedRecord?.patient_name} - {getRecordTypeLabel(selectedRecord?.record_type || 'consultation')}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Record Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="font-medium text-gray-900">Patient</p>
                <p className="text-sm text-gray-600">{selectedRecord?.patient_name}</p>
              </div>
              <div>
                <p className="font-medium text-gray-900">Record Type</p>
                {selectedRecord && getRecordTypeBadge(selectedRecord.record_type)}
              </div>
              <div>
                <p className="font-medium text-gray-900">Date</p>
                <p className="text-sm text-gray-600">
                  {selectedRecord?.date && format(parseISO(selectedRecord.date), 'MMM d, yyyy')}
                </p>
              </div>
              <div>
                <p className="font-medium text-gray-900">Doctor</p>
                <p className="text-sm text-gray-600">{selectedRecord?.doctor_name}</p>
              </div>
            </div>

            {/* Diagnosis */}
            {selectedRecord?.diagnosis && (
              <div>
                <p className="font-medium text-gray-900 mb-2">Diagnosis</p>
                <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">{selectedRecord.diagnosis}</p>
              </div>
            )}

            {/* Treatment */}
            {selectedRecord?.treatment && (
              <div>
                <p className="font-medium text-gray-900 mb-2">Treatment</p>
                <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">{selectedRecord.treatment}</p>
              </div>
            )}

            {/* Notes */}
            {selectedRecord?.notes && (
              <div>
                <p className="font-medium text-gray-900 mb-2">Notes</p>
                <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">{selectedRecord.notes}</p>
              </div>
            )}

            <div className="flex space-x-2">
              <Button className="flex-1">
                <Download className="h-4 w-4 mr-2" />
                Download Record
              </Button>
              <Button variant="outline" onClick={() => setIsRecordModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
} 