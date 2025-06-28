"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Activity, Camera, ArrowLeft, Plus, Search, Filter, Clock, CheckCircle, AlertTriangle, Upload, Eye, X } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"

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
  const router = useRouter()

  useEffect(() => {
    const checkUser = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user || user.user_metadata?.role !== "lab") {
        router.push("/login")
        return
      }

      setUser(user)
      loadImagingStudies()
      setLoading(false)
    }

    checkUser()
  }, [router])

  const loadImagingStudies = async () => {
    // Mock data for demonstration
    const mockStudies: ImagingStudy[] = [
      {
        id: "1",
        patient_id: "P001",
        patient_name: "John Smith",
        study_type: "X-Ray",
        body_part: "Chest",
        scheduled_date: "2024-01-15T09:00:00Z",
        status: "scheduled",
        priority: "normal",
        radiologist: "Dr. Sarah Wilson",
        notes: "Routine chest X-ray",
        image_count: 2
      },
      {
        id: "2",
        patient_id: "P002",
        patient_name: "Sarah Johnson",
        study_type: "CT Scan",
        body_part: "Head",
        scheduled_date: "2024-01-15T10:30:00Z",
        status: "in_progress",
        priority: "high",
        radiologist: "Dr. Michael Brown",
        notes: "Trauma evaluation",
        image_count: 45
      },
      {
        id: "3",
        patient_id: "P003",
        patient_name: "Michael Brown",
        study_type: "MRI",
        body_part: "Spine",
        scheduled_date: "2024-01-15T08:15:00Z",
        status: "completed",
        priority: "normal",
        radiologist: "Dr. Emily Davis",
        notes: "Back pain evaluation",
        image_count: 120
      },
      {
        id: "4",
        patient_id: "P004",
        patient_name: "Emily Davis",
        study_type: "Ultrasound",
        body_part: "Abdomen",
        scheduled_date: "2024-01-15T11:45:00Z",
        status: "urgent",
        priority: "critical",
        radiologist: "Dr. David Wilson",
        notes: "Emergency abdominal pain",
        image_count: 15
      },
      {
        id: "5",
        patient_id: "P005",
        patient_name: "David Wilson",
        study_type: "Mammogram",
        body_part: "Breast",
        scheduled_date: "2024-01-15T07:30:00Z",
        status: "completed",
        priority: "normal",
        radiologist: "Dr. Lisa Anderson",
        notes: "Screening mammogram",
        image_count: 4
      }
    ]

    setStudies(mockStudies)
  }

  const handleScheduleStudy = () => {
    setShowScheduleModal(true)
  }

  const handleSubmitScheduleStudy = () => {
    console.log("handleSubmitScheduleStudy called")
    console.log("Form data:", scheduleForm)
    
    if (!scheduleForm.patient_id || !scheduleForm.patient_name || !scheduleForm.study_type || !scheduleForm.body_part || !scheduleForm.scheduled_date) {
      console.log("Validation failed - missing required fields")
      console.log("patient_id:", scheduleForm.patient_id)
      console.log("patient_name:", scheduleForm.patient_name)
      console.log("study_type:", scheduleForm.study_type)
      console.log("body_part:", scheduleForm.body_part)
      console.log("scheduled_date:", scheduleForm.scheduled_date)
      alert("Please fill in all required fields")
      return
    }

    console.log("Creating new study...")
    const newStudy: ImagingStudy = {
      id: (studies.length + 1).toString(),
      patient_id: scheduleForm.patient_id,
      patient_name: scheduleForm.patient_name,
      study_type: scheduleForm.study_type,
      body_part: scheduleForm.body_part,
      scheduled_date: scheduleForm.scheduled_date,
      status: "scheduled",
      priority: scheduleForm.priority as 'low' | 'normal' | 'high' | 'critical',
      radiologist: scheduleForm.radiologist || undefined,
      notes: scheduleForm.notes || undefined
    }

    console.log("New study:", newStudy)
    setStudies([...studies, newStudy])
    setShowScheduleModal(false)
    setScheduleForm({
      patient_id: "",
      patient_name: "",
      study_type: "",
      body_part: "",
      scheduled_date: "",
      priority: "normal",
      radiologist: "",
      notes: ""
    })
    console.log("Study scheduled successfully!")
  }

  const handleViewStudy = (study: ImagingStudy) => {
    setSelectedStudy(study)
    setShowViewModal(true)
  }

  const handleUploadImages = (study: ImagingStudy) => {
    setSelectedStudy(study)
    setShowUploadModal(true)
  }

  const handleStatusUpdate = (studyId: string, newStatus: 'scheduled' | 'in_progress' | 'completed' | 'urgent') => {
    setStudies(studies.map(study => 
      study.id === studyId ? { ...study, status: newStatus } : study
    ))
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
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-white flex items-center justify-center">
        <div className="text-center">
          <Activity className="h-8 w-8 text-purple-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading imaging center...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Image src="/medi.png" alt="MedSync Logo" width={32} height={32} />
            <span className="text-2xl font-bold text-gray-900">MedSync</span>
            <Badge className="bg-purple-100 text-purple-800">Lab Portal</Badge>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">{user?.user_metadata?.name} - Lab Tech</span>
            <Link href="/lab-dashboard">
              <Button variant="outline" className="bg-white text-purple-600 border-purple-200 hover:bg-purple-50">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Imaging Center</h1>
          <p className="text-gray-600">Manage X-rays, CT scans, and other medical imaging</p>
        </div>

        {/* Quick Stats */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card className="border-blue-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Scheduled Today</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {studies.filter(s => s.status === 'scheduled').length}
              </div>
              <p className="text-xs text-gray-500">Awaiting imaging</p>
            </CardContent>
          </Card>

          <Card className="border-yellow-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">In Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                {studies.filter(s => s.status === 'in_progress').length}
              </div>
              <p className="text-xs text-gray-500">Currently being performed</p>
            </CardContent>
          </Card>

          <Card className="border-red-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Urgent Studies</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {studies.filter(s => s.status === 'urgent' || s.priority === 'critical').length}
              </div>
              <p className="text-xs text-gray-500">Require immediate attention</p>
            </CardContent>
          </Card>

          <Card className="border-green-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Completed Today</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {studies.filter(s => s.status === 'completed').length}
              </div>
              <p className="text-xs text-gray-500">Ready for review</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search */}
        <Card className="border-purple-100 mb-6">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Filter className="h-5 w-5 text-purple-600" />
              <span>Imaging Filters</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search studies..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="X-Ray">X-Ray</SelectItem>
                  <SelectItem value="CT Scan">CT Scan</SelectItem>
                  <SelectItem value="MRI">MRI</SelectItem>
                  <SelectItem value="Ultrasound">Ultrasound</SelectItem>
                  <SelectItem value="Mammogram">Mammogram</SelectItem>
                </SelectContent>
              </Select>
              <Button 
                className="bg-purple-600 hover:bg-purple-700"
                onClick={handleScheduleStudy}
              >
                <Plus className="h-4 w-4 mr-2" />
                Schedule Study
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Imaging Studies List */}
        <Card className="border-purple-100">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Camera className="h-5 w-5 text-purple-600" />
              <span>Imaging Studies</span>
            </CardTitle>
            <CardDescription>
              {filteredStudies.length} studies found
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredStudies.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  <Camera className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-lg font-medium">No imaging studies found</p>
                  <p className="text-sm">Try adjusting your search or filters</p>
                </div>
              ) : (
                filteredStudies.map((study) => (
                  <div key={study.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(study.status)}
                          <div>
                            <p className="font-semibold text-gray-900">{study.patient_name}</p>
                            <p className="text-sm text-gray-600">ID: {study.patient_id}</p>
                          </div>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{study.study_type}</p>
                          <p className="text-sm text-gray-600">{study.body_part}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">
                            Scheduled: {new Date(study.scheduled_date).toLocaleDateString()}
                          </p>
                          {study.radiologist && (
                            <p className="text-sm text-gray-600">Radiologist: {study.radiologist}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <Badge className={getStatusColor(study.status)}>
                          {study.status.replace('_', ' ').charAt(0).toUpperCase() + study.status.replace('_', ' ').slice(1)}
                        </Badge>
                        <Badge className={getPriorityColor(study.priority)}>
                          {study.priority.charAt(0).toUpperCase() + study.priority.slice(1)}
                        </Badge>
                        {study.image_count && (
                          <Badge variant="outline" className="text-xs">
                            {study.image_count} images
                          </Badge>
                        )}
                        <div className="flex space-x-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleViewStudy(study)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleUploadImages(study)}
                          >
                            <Upload className="h-4 w-4 mr-1" />
                            Upload
                          </Button>
                        </div>
                      </div>
                    </div>
                    {study.notes && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">Notes:</span> {study.notes}
                        </p>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Schedule Study Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Schedule New Study</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowScheduleModal(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Patient ID *</label>
                <Input
                  value={scheduleForm.patient_id}
                  onChange={(e) => setScheduleForm({...scheduleForm, patient_id: e.target.value})}
                  placeholder="Enter patient ID"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Patient Name *</label>
                <Input
                  value={scheduleForm.patient_name}
                  onChange={(e) => setScheduleForm({...scheduleForm, patient_name: e.target.value})}
                  placeholder="Enter patient name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Study Type *</label>
                <Select value={scheduleForm.study_type} onValueChange={(value) => setScheduleForm({...scheduleForm, study_type: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select study type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="X-Ray">X-Ray</SelectItem>
                    <SelectItem value="CT Scan">CT Scan</SelectItem>
                    <SelectItem value="MRI">MRI</SelectItem>
                    <SelectItem value="Ultrasound">Ultrasound</SelectItem>
                    <SelectItem value="Mammogram">Mammogram</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Body Part *</label>
                <Input
                  value={scheduleForm.body_part}
                  onChange={(e) => setScheduleForm({...scheduleForm, body_part: e.target.value})}
                  placeholder="e.g., Chest, Head, Abdomen"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Scheduled Date *</label>
                <Input
                  type="text"
                  value={scheduleForm.scheduled_date}
                  onChange={(e) => setScheduleForm({...scheduleForm, scheduled_date: e.target.value})}
                  placeholder="YYYY-MM-DD HH:MM (e.g., 2024-01-15 09:00)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Priority</label>
                <Select value={scheduleForm.priority} onValueChange={(value) => setScheduleForm({...scheduleForm, priority: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Radiologist</label>
                <Input
                  value={scheduleForm.radiologist}
                  onChange={(e) => setScheduleForm({...scheduleForm, radiologist: e.target.value})}
                  placeholder="Enter radiologist name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <Input
                  value={scheduleForm.notes}
                  onChange={(e) => setScheduleForm({...scheduleForm, notes: e.target.value})}
                  placeholder="Additional notes"
                />
              </div>
              <div className="flex space-x-2 pt-4">
                <Button 
                  className="flex-1 bg-purple-600 hover:bg-purple-700"
                  onClick={handleSubmitScheduleStudy}
                >
                  Schedule Study
                </Button>
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => setShowScheduleModal(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Study Modal */}
      {showViewModal && selectedStudy && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Study Details</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowViewModal(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600">Patient Name</label>
                  <p className="text-lg font-semibold">{selectedStudy.patient_name}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600">Patient ID</label>
                  <p className="text-lg">{selectedStudy.patient_id}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600">Study Type</label>
                  <p className="text-lg">{selectedStudy.study_type}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600">Body Part</label>
                  <p className="text-lg">{selectedStudy.body_part}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600">Scheduled Date</label>
                  <p className="text-lg">{new Date(selectedStudy.scheduled_date).toLocaleString()}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600">Status</label>
                  <Badge className={getStatusColor(selectedStudy.status)}>
                    {selectedStudy.status.replace('_', ' ').charAt(0).toUpperCase() + selectedStudy.status.replace('_', ' ').slice(1)}
                  </Badge>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600">Priority</label>
                  <Badge className={getPriorityColor(selectedStudy.priority)}>
                    {selectedStudy.priority.charAt(0).toUpperCase() + selectedStudy.priority.slice(1)}
                  </Badge>
                </div>
                {selectedStudy.radiologist && (
                  <div>
                    <label className="block text-sm font-medium text-gray-600">Radiologist</label>
                    <p className="text-lg">{selectedStudy.radiologist}</p>
                  </div>
                )}
                {selectedStudy.image_count && (
                  <div>
                    <label className="block text-sm font-medium text-gray-600">Images</label>
                    <p className="text-lg">{selectedStudy.image_count} images</p>
                  </div>
                )}
              </div>
              {selectedStudy.notes && (
                <div>
                  <label className="block text-sm font-medium text-gray-600">Notes</label>
                  <p className="text-lg">{selectedStudy.notes}</p>
                </div>
              )}
              <div className="flex space-x-2 pt-4">
                <Button 
                  className="bg-purple-600 hover:bg-purple-700"
                  onClick={() => {
                    setShowViewModal(false)
                    handleUploadImages(selectedStudy)
                  }}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Images
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => setShowViewModal(false)}
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Images Modal */}
      {showUploadModal && selectedStudy && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Upload Images</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowUploadModal(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Study</label>
                <p className="text-lg font-semibold">{selectedStudy.study_type} - {selectedStudy.body_part}</p>
                <p className="text-sm text-gray-600">{selectedStudy.patient_name} (ID: {selectedStudy.patient_id})</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Upload Images</label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">Drag and drop images here or click to browse</p>
                  <Button variant="outline" className="mt-2">
                    Choose Files
                  </Button>
                </div>
              </div>
              <div className="flex space-x-2 pt-4">
                <Button 
                  className="flex-1 bg-purple-600 hover:bg-purple-700"
                  onClick={() => {
                    alert("Images uploaded successfully!")
                    setShowUploadModal(false)
                    // Update study status to completed
                    handleStatusUpdate(selectedStudy.id, 'completed')
                  }}
                >
                  Upload Images
                </Button>
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => setShowUploadModal(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 