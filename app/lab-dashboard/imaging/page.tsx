"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Activity, Camera, ArrowLeft, Plus, Search, Filter, Clock, CheckCircle, AlertTriangle, Upload, Eye, X } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { UUID_REGEX } from "@/lib/constants"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { useToast } from "@/hooks/use-toast"

interface ImagingStudy {
  id: string
  patient_id: string
  patient_name: string
  study_type: string
  body_part: string
  scheduled_date: string
  status: 'scheduled' | 'in_progress' | 'completed' | 'urgent'
  priority: 'low' | 'normal' | 'high' | 'critical'
  radiologist?: string
  notes?: string
  image_count?: number
  file_paths?: string[]
}

export default function LabImagingPage() {
  const [user, setUser] = useState<any>(null)
  const [studies, setStudies] = useState<ImagingStudy[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [showViewModal, setShowViewModal] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [selectedStudy, setSelectedStudy] = useState<ImagingStudy | null>(null)
  const [scheduleForm, setScheduleForm] = useState({
    patient_id: "",
    patient_name: "",
    study_type: "",
    body_part: "",
    scheduled_date: "",
    priority: "normal",
    radiologist: "",
    notes: ""
  })
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null)
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    const checkUser = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user || user.user_metadata?.role !== "lab") {
        router.push("/login")
        return
      }

      setUser(user)
      await loadImagingStudies(user.id)
      setLoading(false)
    }

    checkUser()
  }, [router])

  const loadImagingStudies = async (labId: string) => {
    const { data, error } = await createClient()
      .from('imaging_studies')
      .select('*')
      .eq('lab_id', labId)
      .order('scheduled_date', { ascending: true })

    if (error) {
      console.error('Could not load imaging studies:', error)
      setStudies([])
      return
    }
    setStudies((data || []).map((study: any) => ({
      ...study,
      image_count: study.file_paths?.length || 0,
    })))
  }

  const handleScheduleStudy = () => {
    setShowScheduleModal(true)
  }

  const handleSubmitScheduleStudy = async () => {
    if (!user || !scheduleForm.patient_id.trim() || !scheduleForm.study_type || !scheduleForm.body_part || !scheduleForm.scheduled_date) {
      toast({
        title: "Missing fields",
        description: "Enter a patient, study type, body part, and scheduled time.",
        variant: "destructive",
      })
      return
    }

    const supabase = createClient()
    let patientQuery = supabase
      .from('profile_directory')
      .select('id, name')
      .eq('role', 'patient')
    patientQuery = UUID_REGEX.test(scheduleForm.patient_id.trim())
      ? patientQuery.eq('id', scheduleForm.patient_id.trim())
      : patientQuery.ilike('short_id', scheduleForm.patient_id.trim())
    const { data: patient, error: patientError } = await patientQuery.maybeSingle()
    if (patientError || !patient) {
      toast({
        title: "Patient not found",
        description: "Enter a valid patient ID or Short ID.",
        variant: "destructive",
      })
      return
    }

    const { data: study, error } = await supabase
      .from('imaging_studies')
      .insert({
        lab_id: user.id,
        patient_id: patient.id,
        patient_name: scheduleForm.patient_name.trim() || patient.name || 'Patient',
        study_type: scheduleForm.study_type,
        body_part: scheduleForm.body_part.trim(),
        scheduled_date: new Date(scheduleForm.scheduled_date).toISOString(),
        priority: scheduleForm.priority,
        radiologist: scheduleForm.radiologist.trim(),
        notes: scheduleForm.notes,
      })
      .select('*')
      .single()

    if (error || !study) {
      console.error('Could not schedule imaging study:', error)
      toast({
        title: "Scheduling failed",
        description: "Study scheduling failed. Please try again.",
        variant: "destructive",
      })
      return
    }
    
    toast({
      title: "Success",
      description: "Imaging study scheduled successfully.",
    })

    setStudies((current) => [{ ...study, image_count: 0 }, ...current])
    setShowScheduleModal(false)
    setScheduleForm({ patient_id: '', patient_name: '', study_type: '', body_part: '', scheduled_date: '', priority: 'normal', radiologist: '', notes: '' })
  }

  const handleViewStudy = (study: ImagingStudy) => {
    setSelectedStudy(study)
    setShowViewModal(true)
  }

  const handleUploadImages = (study: ImagingStudy) => {
    setSelectedStudy(study)
    setShowUploadModal(true)
  }

  const handleStatusUpdate = async (studyId: string, newStatus: 'scheduled' | 'in_progress' | 'completed' | 'urgent') => {
    if (!user) return
    const { data: updatedStudy, error } = await createClient()
      .from('imaging_studies')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', studyId)
      .eq('lab_id', user.id)
      .select('*')
      .single()

    if (error || !updatedStudy) {
      console.error('Could not update imaging status:', error)
      toast({
        title: "Update failed",
        description: "Could not update study status. Please try again.",
        variant: "destructive",
      })
      return
    }
    
    toast({
      title: "Status updated",
      description: `Study status changed to ${newStatus}.`,
    })
    setStudies((current) => current.map((study) => study.id === studyId
      ? { ...updatedStudy, image_count: updatedStudy.file_paths?.length || 0 }
      : study))
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800'
      case 'in_progress': return 'bg-yellow-100 text-yellow-800'
      case 'completed': return 'bg-green-100 text-green-800'
      case 'urgent': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'low': return 'bg-gray-100 text-gray-800'
      case 'normal': return 'bg-blue-100 text-blue-800'
      case 'high': return 'bg-orange-100 text-orange-800'
      case 'critical': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'scheduled': return <Clock className="h-4 w-4" />
      case 'in_progress': return <Activity className="h-4 w-4" />
      case 'completed': return <CheckCircle className="h-4 w-4" />
      case 'urgent': return <AlertTriangle className="h-4 w-4" />
      default: return <Clock className="h-4 w-4" />
    }
  }

  const filteredStudies = studies.filter(study => {
    const matchesSearch = study.patient_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      study.patient_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      study.study_type.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || study.status === statusFilter
    const matchesType = typeFilter === "all" || study.study_type === typeFilter

    return matchesSearch && matchesStatus && matchesType
  })

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-transparent">
        <div className="flex flex-col items-center">
          <Activity className="h-8 w-8 animate-spin mb-4 text-black" />
          <span className="text-xs font-mono uppercase tracking-widest text-black/60">Establishing Imaging Link...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-transparent p-12 max-w-7xl mx-auto">
      {/* Header */}
      <header className="border-b border-black/10 pb-8 mb-12 flex items-end justify-between">
        <div>
          <Link href="/lab-dashboard" className="inline-flex items-center space-x-2 text-xs font-mono uppercase tracking-widest text-black/40 hover:text-black mb-4 transition-colors">
            <ArrowLeft className="h-3 w-3" />
            <span>Return to Node</span>
          </Link>
          <h1 className="text-4xl font-bold tracking-tight uppercase mb-2">Imaging Center</h1>
          <p className="text-black/60 font-light text-lg italic">
            Telemetry capture and visualization systems
          </p>
        </div>
        <div className="text-right hidden md:block">
          <span className="text-[10px] font-mono uppercase tracking-widest text-black/40 block mb-1">
            System Hash
          </span>
          <span className="text-xl font-mono border-b-2 border-indigo-600">
            IMAGING_V1.0
          </span>
        </div>
      </header>

      {/* Filters and Search - Brutalist */}
      <div className="border border-black/10 bg-white p-10 relative mb-12">
        <div className="absolute top-0 left-0 w-full h-0.5 bg-indigo-600"></div>
        <div className="flex items-center justify-between mb-8 border-b border-black/10 pb-6">
          <h3 className="text-xl font-black uppercase tracking-tighter flex items-center gap-3">
            <Filter className="h-5 w-5" />
            Uplink Filters
          </h3>
          <Button
            className="bg-black text-white rounded-none hover:bg-indigo-600 h-10 px-6 font-mono text-[10px] uppercase tracking-widest transition-all"
            onClick={handleScheduleStudy}
          >
            <Plus className="h-4 w-4 mr-2" />
            Schedule Study
          </Button>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-black/20" />
            <Input
              placeholder="SEARCH BY PATIENT / TYPE..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 rounded-none border-black h-12 font-mono text-xs uppercase focus-visible:ring-0"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="rounded-none border-black h-12 font-mono text-xs uppercase focus:ring-0">
              <SelectValue placeholder="FILTER BY STATUS" />
            </SelectTrigger>
            <SelectContent className="rounded-none border-black">
              <SelectItem value="all">ALL STATUSES</SelectItem>
              <SelectItem value="scheduled">SCHEDULED</SelectItem>
              <SelectItem value="in_progress">IN PROGRESS</SelectItem>
              <SelectItem value="completed">COMPLETED</SelectItem>
              <SelectItem value="urgent">URGENT</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="rounded-none border-black h-12 font-mono text-xs uppercase focus:ring-0">
              <SelectValue placeholder="FILTER BY TYPE" />
            </SelectTrigger>
            <SelectContent className="rounded-none border-black">
              <SelectItem value="all">ALL TYPES</SelectItem>
              <SelectItem value="X-Ray">X-RAY</SelectItem>
              <SelectItem value="CT Scan">CT SCAN</SelectItem>
              <SelectItem value="MRI">MRI</SelectItem>
              <SelectItem value="Ultrasound">ULTRASOUND</SelectItem>
              <SelectItem value="Mammogram">MAMMOGRAM</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Imaging Studies List */}
      <div className="border border-black/10 bg-white p-10 relative">
        <div className="absolute top-0 left-0 w-full h-0.5 bg-black/10"></div>
        <div className="flex items-center justify-between mb-10 border-b border-black/10 pb-6">
          <h3 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-3">
            <Camera className="h-6 w-6" />
            Capture Logs
          </h3>
          <span className="text-[10px] font-mono text-black/40 uppercase tracking-widest">{filteredStudies.length} STUDIES FOUND</span>
        </div>

        <div className="space-y-6">
          {filteredStudies.length === 0 ? (
            <div className="text-center py-20 bg-black/[0.01] border border-dashed border-black/10">
              <Camera className="h-12 w-12 mx-auto mb-4 text-black/10" />
              <p className="text-xs font-mono uppercase text-black/40">NO IMAGING DATA IN CURRENT NODE</p>
            </div>
          ) : (
            filteredStudies.map((study) => (
              <div key={study.id} className="border border-black/10 p-8 hover:border-indigo-600/30 transition-all group flex items-center justify-between">
                <div className="flex items-center gap-10">
                  <div className="flex items-center gap-4 min-w-[200px]">
                    <div className="p-3 bg-black/[0.03] group-hover:bg-black group-hover:text-white transition-colors">
                      {getStatusIcon(study.status)}
                    </div>
                    <div>
                      <p className="font-black text-lg uppercase tracking-tight">{study.patient_name}</p>
                      <p className="text-[10px] font-mono text-black/40 uppercase">ID: {study.patient_id}</p>
                    </div>
                  </div>
                  <div>
                    <p className="font-bold text-sm uppercase">{study.study_type} - {study.body_part}</p>
                    <p className="text-[10px] font-mono text-black/40 uppercase">
                      SCHEDULED: {new Date(study.scheduled_date).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 border uppercase tracking-tighter ${
                    study.status === 'urgent' ? 'border-red-600 text-red-600 bg-red-50' :
                    study.status === 'completed' ? 'border-emerald-600 text-emerald-600 bg-emerald-50' :
                    study.status === 'in_progress' ? 'border-indigo-600 text-indigo-600 bg-indigo-50' :
                    'border-black/20 text-black/40 bg-black/[0.02]'
                  }`}>
                    {study.status.replace('_', ' ')}
                  </span>

                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 border uppercase tracking-tighter ${
                    study.priority === 'critical' ? 'border-red-600 text-red-600 bg-red-50' :
                    study.priority === 'high' ? 'border-amber-600 text-amber-600 bg-amber-50' :
                    'border-black/20 text-black/40 bg-black/[0.02]'
                  }`}>
                    {study.priority}
                  </span>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="rounded-none border-black h-12 px-6 font-mono text-[10px] uppercase tracking-widest hover:bg-black/5 transition-all"
                      onClick={() => handleViewStudy(study)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      VIEW
                    </Button>
                    <Button
                      className="bg-black text-white rounded-none h-12 px-6 font-mono text-[10px] uppercase tracking-widest hover:bg-indigo-600 transition-all"
                      onClick={() => handleUploadImages(study)}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      UPLOAD
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Schedule Study Modal - Brutalist */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-6">
          <div className="bg-white border-2 border-black w-full max-w-md relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-black"></div>
            <div className="p-8">
              <div className="flex items-center justify-between mb-10 border-b border-black/10 pb-6">
                <h3 className="text-2xl font-black uppercase tracking-tighter">Schedule Capture</h3>
                <Button variant="ghost" className="hover:bg-black/5 rounded-none" onClick={() => setShowScheduleModal(false)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-black/40">Patient ID</label>
                    <Input
                      value={scheduleForm.patient_id}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, patient_id: e.target.value })}
                      placeholder="ENTER ID..."
                      className="rounded-none border-black h-12 font-mono text-sm uppercase focus-visible:ring-0"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-black/40">Patient Name</label>
                    <Input
                      value={scheduleForm.patient_name}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, patient_name: e.target.value })}
                      placeholder="ENTER NAME..."
                      className="rounded-none border-black h-12 font-mono text-sm uppercase focus-visible:ring-0"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-black/40">Study Type</label>
                    <Select value={scheduleForm.study_type} onValueChange={(value) => setScheduleForm({ ...scheduleForm, study_type: value })}>
                      <SelectTrigger className="rounded-none border-black h-12 font-mono text-sm uppercase focus:ring-0">
                        <SelectValue placeholder="SELECT..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-none border-black">
                        <SelectItem value="X-Ray">X-RAY</SelectItem>
                        <SelectItem value="CT Scan">CT SCAN</SelectItem>
                        <SelectItem value="MRI">MRI</SelectItem>
                        <SelectItem value="Ultrasound">ULTRASOUND</SelectItem>
                        <SelectItem value="Mammogram">MAMMOGRAM</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-black/40">Body Part</label>
                    <Input
                      value={scheduleForm.body_part}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, body_part: e.target.value })}
                      placeholder="e.g. CHEST..."
                      className="rounded-none border-black h-12 font-mono text-sm uppercase focus-visible:ring-0"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-black/40">Scheduled Timestamp</label>
                  <Input
                    type="text"
                    value={scheduleForm.scheduled_date}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, scheduled_date: e.target.value })}
                    placeholder="YYYY-MM-DD HH:MM"
                    className="rounded-none border-black h-12 font-mono text-xs uppercase focus-visible:ring-0"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-black/40">Priority</label>
                    <Select value={scheduleForm.priority} onValueChange={(value) => setScheduleForm({ ...scheduleForm, priority: value })}>
                      <SelectTrigger className="rounded-none border-black h-12 font-mono text-sm uppercase focus:ring-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-none border-black">
                        <SelectItem value="low">LOW</SelectItem>
                        <SelectItem value="normal">NORMAL</SelectItem>
                        <SelectItem value="high">HIGH</SelectItem>
                        <SelectItem value="critical">CRITICAL</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-black/40">Radiologist</label>
                    <Input
                      value={scheduleForm.radiologist}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, radiologist: e.target.value })}
                      placeholder="NAME..."
                      className="rounded-none border-black h-12 font-mono text-sm uppercase focus-visible:ring-0"
                    />
                  </div>
                </div>

                <Button
                  className="w-full bg-black text-white rounded-none h-14 hover:bg-indigo-600 transition-all uppercase font-mono text-xs tracking-widest mt-4"
                  onClick={handleSubmitScheduleStudy}
                >
                  Establish Schedule
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Study Modal - Brutalist */}
      {showViewModal && selectedStudy && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-6">
          <div className="bg-white border-2 border-black w-full max-w-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-black"></div>
            <div className="p-10">
              <div className="flex items-center justify-between mb-10 border-b border-black/10 pb-6">
                <h3 className="text-3xl font-black uppercase tracking-tighter">Study: {selectedStudy.patient_name}</h3>
                <Button variant="ghost" className="hover:bg-black/5 rounded-none" onClick={() => setShowViewModal(false)}>
                  <X className="h-6 w-6" />
                </Button>
              </div>

              <div className="grid md:grid-cols-2 gap-10 mb-10">
                <div className="space-y-6">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-black/40 mb-1">Study Hash</p>
                    <p className="font-mono text-xl uppercase tracking-tighter">{selectedStudy.id}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-black/40 mb-1">Type / Region</p>
                    <p className="font-mono text-xl uppercase tracking-tighter">{selectedStudy.study_type} - {selectedStudy.body_part}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-black/40 mb-1">Scheduled Date</p>
                    <p className="font-mono text-sm uppercase text-black/60">{new Date(selectedStudy.scheduled_date).toLocaleString()}</p>
                  </div>
                </div>
                <div className="space-y-6">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-black/40 mb-1">Status</p>
                    <span className={`text-[10px] font-mono font-bold px-3 py-1 border uppercase tracking-widest inline-block ${
                      selectedStudy.status === 'urgent' ? 'border-red-600 text-red-600 bg-red-50' :
                      selectedStudy.status === 'completed' ? 'border-emerald-600 text-emerald-600 bg-emerald-50' :
                      selectedStudy.status === 'in_progress' ? 'border-indigo-600 text-indigo-600 bg-indigo-50' :
                      'border-black/20 text-black/40 bg-black/[0.02]'
                    }`}>
                      {selectedStudy.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-black/40 mb-1">Assigned Radiologist</p>
                    <p className="font-black text-xl uppercase text-indigo-600">{selectedStudy.radiologist || 'UNASSIGNED'}</p>
                  </div>
                </div>
              </div>

              {selectedStudy.notes && (
                <div className="p-6 bg-black/[0.02] border border-black/5 mb-10">
                  <p className="text-[10px] font-black uppercase tracking-widest text-black/40 mb-2">Technical Observations</p>
                  <p className="text-sm font-mono uppercase text-black/70 leading-relaxed italic">{selectedStudy.notes}</p>
                </div>
              )}

              <div className="flex gap-4">
                <Button
                  className="flex-1 bg-black text-white rounded-none h-16 hover:bg-indigo-600 transition-all uppercase font-mono text-xs tracking-widest"
                  onClick={() => {
                    setShowViewModal(false)
                    handleUploadImages(selectedStudy)
                  }}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Initialize Image Upload
                </Button>
                <Button
                  variant="outline"
                  className="rounded-none border-black h-16 px-10 hover:bg-black/5 uppercase font-mono text-xs tracking-widest transition-all"
                  onClick={() => setShowViewModal(false)}
                >
                  De-Auth
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Images Modal - Brutalist */}
      {showUploadModal && selectedStudy && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-6">
          <div className="bg-white border-2 border-black w-full max-w-md relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-black"></div>
            <div className="p-8">
              <div className="flex items-center justify-between mb-10 border-b border-black/10 pb-6">
                <h3 className="text-2xl font-black uppercase tracking-tighter">Capture Upload</h3>
                <Button variant="ghost" className="hover:bg-black/5 rounded-none" onClick={() => setShowUploadModal(false)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>

              <div className="space-y-6">
                <div className="p-4 bg-black/[0.02] border border-black/5 mb-6">
                  <p className="text-[10px] font-black uppercase tracking-widest text-black/40 mb-1">Target Study</p>
                  <p className="font-bold text-sm uppercase">{selectedStudy.study_type} - {selectedStudy.body_part}</p>
                  <p className="text-[10px] font-mono text-black/40 uppercase">NODE: {selectedStudy.patient_name}</p>
                </div>

                <div className="border-2 border-dashed border-black/10 p-10 text-center hover:border-black/30 transition-all group cursor-pointer relative">
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.dcm,.dicom"
                    multiple
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    onChange={e => setSelectedFiles(e.target.files)}
                  />
                  <Upload className="h-10 w-10 text-black/10 mx-auto mb-4 group-hover:text-black/30" />
                  <p className="text-[10px] font-mono uppercase tracking-widest text-black/40">Initialize Local Link or Drag Files</p>

                  {selectedFiles && selectedFiles.length > 0 && (
                    <div className="mt-6 pt-6 border-t border-black/5 text-left">
                      <p className="text-[10px] font-black uppercase tracking-widest mb-2">Pending Packets:</p>
                      <div className="space-y-1 max-h-[100px] overflow-y-auto">
                        {Array.from(selectedFiles).map(f => (
                          <div key={f.name} className="text-[9px] font-mono uppercase text-black/60 truncate bg-black/[0.02] p-1">
                            {f.name}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {uploadError && <div className="p-3 bg-red-600 text-white font-mono text-[10px] uppercase tracking-widest">{uploadError}</div>}

                <div className="flex gap-4 pt-4">
                  <Button
                    className="flex-1 bg-black text-white rounded-none h-14 hover:bg-indigo-600 transition-all uppercase font-mono text-xs tracking-widest"
                    disabled={uploading || !selectedFiles || selectedFiles.length === 0}
                    onClick={async () => {
                      if (!selectedFiles || selectedFiles.length === 0) return
                      setUploading(true)
                      setUploadError(null)
                      const supabase = createClient()
                      const uploadedPaths: string[] = []
                      try {
                        if (!user) throw new Error('Your lab session has expired. Sign in again.')
                        const filePaths = [...(selectedStudy.file_paths || [])]
                        for (const file of Array.from(selectedFiles)) {
                          const fileExt = file.name.split('.').pop()?.toLowerCase()
                          const contentType = fileExt === 'jpg' || fileExt === 'jpeg'
                            ? 'image/jpeg'
                            : fileExt === 'png'
                              ? 'image/png'
                              : fileExt === 'dcm' || fileExt === 'dicom'
                                ? 'application/dicom'
                                : null
                          if (!contentType) throw new Error(`Unsupported imaging file: ${file.name}`)
                          if (file.size === 0 || file.size > 50 * 1024 * 1024) {
                            throw new Error(`${file.name} must be between 1 byte and 50 MB.`)
                          }
                          const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
                          const filePath = `${user.id}/${selectedStudy.id}/${Date.now()}-${Math.random().toString(36).slice(2)}-${safeName}`
                          const { error: uploadError } = await supabase.storage
                            .from('imaging')
                            .upload(filePath, file, { contentType, upsert: false })
                          if (uploadError) throw uploadError
                          uploadedPaths.push(filePath)
                          filePaths.push(filePath)
                        }

                        const { data: updatedStudy, error: updateError } = await supabase
                          .from('imaging_studies')
                          .update({ file_paths: filePaths, status: 'completed', updated_at: new Date().toISOString() })
                          .eq('id', selectedStudy.id)
                          .eq('lab_id', user.id)
                          .select('*')
                          .single()
                        if (updateError || !updatedStudy) {
                          throw updateError || new Error('Could not save uploaded files to the study.')
                        }

                        setStudies((current) => current.map((study) => study.id === selectedStudy.id
                          ? { ...updatedStudy, image_count: filePaths.length }
                          : study))
                        setSelectedStudy({ ...updatedStudy, image_count: filePaths.length })
                        setShowUploadModal(false)
                        setSelectedFiles(null)
                      } catch (err: any) {
                        if (uploadedPaths.length > 0) {
                          await supabase.storage.from('imaging').remove(uploadedPaths)
                        }
                        setUploadError(err.message || 'Transmission failed')
                      } finally {
                        setUploading(false)
                      }
                    }}
                  >
                    {uploading && <Activity className="h-4 w-4 mr-2 animate-spin" />}
                    Confirm Uplink
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-none border-black h-14 px-6 hover:bg-black/5 uppercase font-mono text-[10px] tracking-widest transition-all"
                    onClick={() => setShowUploadModal(false)}
                  >
                    Abort
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
