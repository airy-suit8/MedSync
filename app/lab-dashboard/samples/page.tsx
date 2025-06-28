"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Activity, FlaskConical, ArrowLeft, Plus, Search, Filter, Clock, CheckCircle, AlertTriangle, X } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"

interface Sample {
  id: string
  patient_id: string
  patient_name: string
  sample_type: string
  collection_date: string
  status: 'pending' | 'processing' | 'completed' | 'urgent'
  priority: 'low' | 'normal' | 'high' | 'critical'
  notes?: string
  assigned_tech?: string
}

export default function LabSamplesPage() {
  const [user, setUser] = useState<any>(null)
  const [samples, setSamples] = useState<Sample[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [priorityFilter, setPriorityFilter] = useState("all")
  const [showAddModal, setShowAddModal] = useState(false)
  const [showViewModal, setShowViewModal] = useState(false)
  const [selectedSample, setSelectedSample] = useState<Sample | null>(null)
  const [addForm, setAddForm] = useState({
    patient_id: "",
    patient_name: "",
    sample_type: "",
    collection_date: "",
    priority: "normal",
    notes: "",
    assigned_tech: ""
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
      loadSamples()
      setLoading(false)
    }

    checkUser()
  }, [router])

  const loadSamples = async () => {
    // Mock data for demonstration
    const mockSamples: Sample[] = [
      {
        id: "1",
        patient_id: "P001",
        patient_name: "John Smith",
        sample_type: "Blood",
        collection_date: "2024-01-15T09:00:00Z",
        status: "pending",
        priority: "normal",
        notes: "Routine blood work",
        assigned_tech: "Lab Tech 1"
      },
      {
        id: "2",
        patient_id: "P002",
        patient_name: "Sarah Johnson",
        sample_type: "Urine",
        collection_date: "2024-01-15T10:30:00Z",
        status: "processing",
        priority: "high",
        notes: "Urgent analysis required",
        assigned_tech: "Lab Tech 2"
      },
      {
        id: "3",
        patient_id: "P003",
        patient_name: "Michael Brown",
        sample_type: "Tissue",
        collection_date: "2024-01-15T08:15:00Z",
        status: "completed",
        priority: "normal",
        notes: "Biopsy sample",
        assigned_tech: "Lab Tech 1"
      },
      {
        id: "4",
        patient_id: "P004",
        patient_name: "Emily Davis",
        sample_type: "Blood",
        collection_date: "2024-01-15T11:45:00Z",
        status: "urgent",
        priority: "critical",
        notes: "Emergency cardiac markers",
        assigned_tech: "Lab Tech 3"
      },
      {
        id: "5",
        patient_id: "P005",
        patient_name: "David Wilson",
        sample_type: "CSF",
        collection_date: "2024-01-15T07:30:00Z",
        status: "processing",
        priority: "high",
        notes: "Meningitis workup",
        assigned_tech: "Lab Tech 2"
      }
    ]

    setSamples(mockSamples)
  }

  const handleAddSample = () => {
    if (!addForm.patient_id || !addForm.patient_name || !addForm.sample_type || !addForm.collection_date) {
      alert("Please fill in all required fields")
      return
    }

    const newSample: Sample = {
      id: (samples.length + 1).toString(),
      patient_id: addForm.patient_id,
      patient_name: addForm.patient_name,
      sample_type: addForm.sample_type,
      collection_date: addForm.collection_date,
      status: "pending",
      priority: addForm.priority as 'low' | 'normal' | 'high' | 'critical',
      notes: addForm.notes || undefined,
      assigned_tech: addForm.assigned_tech || undefined
    }

    setSamples([...samples, newSample])
    setShowAddModal(false)
    setAddForm({
      patient_id: "",
      patient_name: "",
      sample_type: "",
      collection_date: "",
      priority: "normal",
      notes: "",
      assigned_tech: ""
    })
  }

  const handleViewSample = (sample: Sample) => {
    setSelectedSample(sample)
    setShowViewModal(true)
  }

  const handleStatusUpdate = (sampleId: string, newStatus: 'pending' | 'processing' | 'completed' | 'urgent') => {
    setSamples(samples.map(sample => 
      sample.id === sampleId ? { ...sample, status: newStatus } : sample
    ))
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'processing': return 'bg-blue-100 text-blue-800'
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
      case 'pending': return <Clock className="h-4 w-4" />
      case 'processing': return <Activity className="h-4 w-4" />
      case 'completed': return <CheckCircle className="h-4 w-4" />
      case 'urgent': return <AlertTriangle className="h-4 w-4" />
      default: return <Clock className="h-4 w-4" />
    }
  }

  const filteredSamples = samples.filter(sample => {
    const matchesSearch = sample.patient_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         sample.patient_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         sample.sample_type.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || sample.status === statusFilter
    const matchesPriority = priorityFilter === "all" || sample.priority === priorityFilter
    
    return matchesSearch && matchesStatus && matchesPriority
  })

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-white flex items-center justify-center">
        <div className="text-center">
          <Activity className="h-8 w-8 text-purple-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading sample management...</p>
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Sample Management</h1>
          <p className="text-gray-600">Track and manage laboratory samples and specimens</p>
        </div>

        {/* Quick Stats */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card className="border-yellow-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Pending Samples</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                {samples.filter(s => s.status === 'pending').length}
              </div>
              <p className="text-xs text-gray-500">Awaiting processing</p>
            </CardContent>
          </Card>

          <Card className="border-blue-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Processing</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {samples.filter(s => s.status === 'processing').length}
              </div>
              <p className="text-xs text-gray-500">Currently being analyzed</p>
            </CardContent>
          </Card>

          <Card className="border-red-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Urgent Samples</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {samples.filter(s => s.status === 'urgent' || s.priority === 'critical').length}
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
                {samples.filter(s => s.status === 'completed').length}
              </div>
              <p className="text-xs text-gray-500">Results ready</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search */}
        <Card className="border-purple-100 mb-6">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Filter className="h-5 w-5 text-purple-600" />
              <span>Sample Filters</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search samples..."
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
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
              <Button 
                className="bg-purple-600 hover:bg-purple-700"
                onClick={() => setShowAddModal(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Sample
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Samples List */}
        <Card className="border-purple-100">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FlaskConical className="h-5 w-5 text-purple-600" />
              <span>Sample Inventory</span>
            </CardTitle>
            <CardDescription>
              {filteredSamples.length} samples found
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredSamples.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  <FlaskConical className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-lg font-medium">No samples found</p>
                  <p className="text-sm">Try adjusting your search or filters</p>
                </div>
              ) : (
                filteredSamples.map((sample) => (
                  <div key={sample.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(sample.status)}
                          <div>
                            <p className="font-semibold text-gray-900">{sample.patient_name}</p>
                            <p className="text-sm text-gray-600">ID: {sample.patient_id}</p>
                          </div>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{sample.sample_type}</p>
                          <p className="text-sm text-gray-600">
                            Collected: {new Date(sample.collection_date).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <Badge className={getStatusColor(sample.status)}>
                          {sample.status.charAt(0).toUpperCase() + sample.status.slice(1)}
                        </Badge>
                        <Badge className={getPriorityColor(sample.priority)}>
                          {sample.priority.charAt(0).toUpperCase() + sample.priority.slice(1)}
                        </Badge>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleViewSample(sample)}
                        >
                          View Details
                        </Button>
                      </div>
                    </div>
                    {sample.notes && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">Notes:</span> {sample.notes}
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

      {/* Add Sample Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Add New Sample</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowAddModal(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Patient ID *</label>
                <Input
                  value={addForm.patient_id}
                  onChange={(e) => setAddForm({...addForm, patient_id: e.target.value})}
                  placeholder="Enter patient ID"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Patient Name *</label>
                <Input
                  value={addForm.patient_name}
                  onChange={(e) => setAddForm({...addForm, patient_name: e.target.value})}
                  placeholder="Enter patient name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Sample Type *</label>
                <Select value={addForm.sample_type} onValueChange={(value) => setAddForm({...addForm, sample_type: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select sample type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Blood">Blood</SelectItem>
                    <SelectItem value="Urine">Urine</SelectItem>
                    <SelectItem value="Tissue">Tissue</SelectItem>
                    <SelectItem value="CSF">CSF</SelectItem>
                    <SelectItem value="Stool">Stool</SelectItem>
                    <SelectItem value="Sputum">Sputum</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Collection Date *</label>
                <Input
                  type="datetime-local"
                  value={addForm.collection_date}
                  onChange={(e) => setAddForm({...addForm, collection_date: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Priority</label>
                <Select value={addForm.priority} onValueChange={(value) => setAddForm({...addForm, priority: value})}>
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
                <label className="block text-sm font-medium mb-1">Assigned Tech</label>
                <Input
                  value={addForm.assigned_tech}
                  onChange={(e) => setAddForm({...addForm, assigned_tech: e.target.value})}
                  placeholder="Enter technician name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <Input
                  value={addForm.notes}
                  onChange={(e) => setAddForm({...addForm, notes: e.target.value})}
                  placeholder="Additional notes"
                />
              </div>
              <div className="flex space-x-2 pt-4">
                <Button 
                  className="flex-1 bg-purple-600 hover:bg-purple-700"
                  onClick={handleAddSample}
                >
                  Add Sample
                </Button>
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Sample Modal */}
      {showViewModal && selectedSample && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Sample Details</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowViewModal(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600">Patient Name</label>
                  <p className="text-lg font-semibold">{selectedSample.patient_name}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600">Patient ID</label>
                  <p className="text-lg">{selectedSample.patient_id}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600">Sample Type</label>
                  <p className="text-lg">{selectedSample.sample_type}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600">Collection Date</label>
                  <p className="text-lg">{new Date(selectedSample.collection_date).toLocaleString()}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600">Status</label>
                  <Badge className={getStatusColor(selectedSample.status)}>
                    {selectedSample.status.charAt(0).toUpperCase() + selectedSample.status.slice(1)}
                  </Badge>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600">Priority</label>
                  <Badge className={getPriorityColor(selectedSample.priority)}>
                    {selectedSample.priority.charAt(0).toUpperCase() + selectedSample.priority.slice(1)}
                  </Badge>
                </div>
                {selectedSample.assigned_tech && (
                  <div>
                    <label className="block text-sm font-medium text-gray-600">Assigned Tech</label>
                    <p className="text-lg">{selectedSample.assigned_tech}</p>
                  </div>
                )}
              </div>
              {selectedSample.notes && (
                <div>
                  <label className="block text-sm font-medium text-gray-600">Notes</label>
                  <p className="text-lg">{selectedSample.notes}</p>
                </div>
              )}
              <div className="flex space-x-2 pt-4">
                <Button 
                  className="bg-purple-600 hover:bg-purple-700"
                  onClick={() => {
                    handleStatusUpdate(selectedSample.id, 'processing')
                    setShowViewModal(false)
                  }}
                >
                  Start Processing
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
    </div>
  )
} 