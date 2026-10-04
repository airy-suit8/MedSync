"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Activity, FlaskConical, ArrowLeft, Plus, Search, Filter, Clock, CheckCircle, AlertTriangle, X } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { UUID_REGEX } from "@/lib/constants"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { useToast } from "@/hooks/use-toast"

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
      await loadSamples(user.id)
      setLoading(false)
    }

    checkUser()
  }, [router])

  const loadSamples = async (labId: string) => {
    const { data, error } = await createClient()
      .from('lab_samples')
      .select('*')
      .eq('lab_id', labId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Could not load lab samples:', error)
      setSamples([])
      return
    }
    setSamples((data || []) as Sample[])
  }

  const handleAddSample = async () => {
    if (!user || !addForm.patient_id.trim() || !addForm.sample_type || !addForm.collection_date) {
      toast({
        title: "Missing fields",
        description: "Enter a patient, specimen type, and collection time.",
        variant: "destructive",
      })
      return
    }

    const supabase = createClient()
    let patientQuery = supabase
      .from('profile_directory')
      .select('id, name')
      .eq('role', 'patient')
    patientQuery = UUID_REGEX.test(addForm.patient_id.trim())
      ? patientQuery.eq('id', addForm.patient_id.trim())
      : patientQuery.ilike('short_id', addForm.patient_id.trim())
    const { data: patient, error: patientError } = await patientQuery.maybeSingle()
    if (patientError || !patient) {
      toast({
        title: "Patient not found",
        description: "Enter a valid patient ID or Short ID.",
        variant: "destructive",
      })
      return
    }

    const { data: sample, error } = await supabase
      .from('lab_samples')
      .insert({
        lab_id: user.id,
        patient_id: patient.id,
        patient_name: addForm.patient_name.trim() || patient.name || 'Patient',
        sample_type: addForm.sample_type,
        collection_date: new Date(addForm.collection_date).toISOString(),
        priority: addForm.priority,
        notes: addForm.notes,
        assigned_tech: addForm.assigned_tech.trim() || user.user_metadata?.name || '',
      })
      .select('*')
      .single()

    if (error || !sample) {
      console.error('Could not register lab sample:', error)
      toast({
        title: "Registration failed",
        description: "Specimen registration failed. Please try again.",
        variant: "destructive",
      })
      return
    }

    toast({
      title: "Success",
      description: "Specimen successfully registered.",
    })

    setSamples((current) => [sample as Sample, ...current])
    setShowAddModal(false)
    setAddForm({ patient_id: '', patient_name: '', sample_type: '', collection_date: '', priority: 'normal', notes: '', assigned_tech: '' })
  }

  const handleViewSample = (sample: Sample) => {
    setSelectedSample(sample)
    setShowViewModal(true)
  }

  const handleStatusUpdate = async (sampleId: string, newStatus: 'pending' | 'processing' | 'completed' | 'urgent') => {
    if (!user) return
    const { data: sample, error } = await createClient()
      .from('lab_samples')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', sampleId)
      .eq('lab_id', user.id)
      .select('*')
      .single()

    if (error || !sample) {
      console.error('Could not update lab sample:', error)
      toast({
        title: "Update failed",
        description: "Could not update specimen status. Please try again.",
        variant: "destructive",
      })
      return
    }
    
    toast({
      title: "Status updated",
      description: `Specimen status changed to ${newStatus}.`,
    })
    setSamples((current) => current.map((row) => row.id === sampleId ? sample as Sample : row))
    setSelectedSample(sample as Sample)
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
      <div className="min-h-screen flex items-center justify-center bg-transparent">
        <div className="flex flex-col items-center">
          <Activity className="h-8 w-8 animate-spin mb-4 text-black" />
          <span className="text-xs font-mono uppercase tracking-widest text-black/60">Loading Inventory...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-transparent p-12 max-w-7xl mx-auto">
      {/* Header */}
      <header className="border-b border-black/10 pb-8 mb-12 flex items-end justify-between">
        <div>
          <Link href="/lab-dashboard" className="inline-flex items-center space-x-2 text-xs font-mono uppercase tracking-widest text-black/55 hover:text-black mb-4 transition-colors">
            <ArrowLeft className="h-3 w-3" />
            <span>Return to Node</span>
          </Link>
          <h1 className="text-4xl font-bold tracking-tight uppercase mb-2">Specimen Inventory</h1>
          <p className="text-black/60 font-light text-lg italic">
            Management and tracking of biological telemetry
          </p>
        </div>
        <div className="text-right hidden md:block">
          <span className="text-[10px] font-mono uppercase tracking-widest text-black/55 block mb-1">
            Active Technician
          </span>
          <span className="text-xl font-mono border-b-2 border-indigo-600">
            {user?.user_metadata?.name?.toUpperCase() || 'ROOT_USER'}
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
            onClick={() => setShowAddModal(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Register Specimen
          </Button>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-black/20" />
            <Input
              placeholder="SEARCH BY HASH / NAME..."
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
              <SelectItem value="pending">PENDING</SelectItem>
              <SelectItem value="processing">PROCESSING</SelectItem>
              <SelectItem value="completed">COMPLETED</SelectItem>
              <SelectItem value="urgent">URGENT</SelectItem>
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="rounded-none border-black h-12 font-mono text-xs uppercase focus:ring-0">
              <SelectValue placeholder="FILTER BY PRIORITY" />
            </SelectTrigger>
            <SelectContent className="rounded-none border-black">
              <SelectItem value="all">ALL PRIORITIES</SelectItem>
              <SelectItem value="low">LOW</SelectItem>
              <SelectItem value="normal">NORMAL</SelectItem>
              <SelectItem value="high">HIGH</SelectItem>
              <SelectItem value="critical">CRITICAL</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Samples List */}
      <div className="border border-black/10 bg-white p-10 relative">
        <div className="absolute top-0 left-0 w-full h-0.5 bg-black/10"></div>
        <div className="flex items-center justify-between mb-10 border-b border-black/10 pb-6">
           <h3 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-3">
             <FlaskConical className="h-6 w-6" />
             Registry Logs
           </h3>
           <span className="text-[10px] font-mono text-black/55 uppercase tracking-widest">{filteredSamples.length} PACKETS FOUND</span>
        </div>

        <div className="space-y-6">
          {filteredSamples.length === 0 ? (
            <div className="text-center py-20 bg-black/[0.01] border border-dashed border-black/10">
              <FlaskConical className="h-12 w-12 mx-auto mb-4 text-black/10" />
              <p className="text-xs font-mono uppercase text-black/55">NO SPECIMEN DETECTED IN CURRENT NODE</p>
            </div>
          ) : (
            filteredSamples.map((sample) => (
              <div key={sample.id} className="border border-black/10 p-8 hover:border-indigo-600/30 transition-all group flex items-center justify-between">
                <div className="flex items-center gap-10">
                  <div className="flex items-center gap-4 min-w-[200px]">
                    <div className="p-3 bg-black/[0.03] group-hover:bg-black group-hover:text-white transition-colors">
                      {getStatusIcon(sample.status)}
                    </div>
                    <div>
                      <p className="font-black text-lg uppercase tracking-tight">{sample.patient_name}</p>
                      <p className="text-[10px] font-mono text-black/55 uppercase">ID: {sample.patient_id}</p>
                    </div>
                  </div>
                  <div>
                    <p className="font-bold text-sm uppercase">{sample.sample_type}</p>
                    <p className="text-[10px] font-mono text-black/55 uppercase">
                      COLLECTED: {new Date(sample.collection_date).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 border uppercase tracking-tighter ${
                    sample.status === 'urgent' ? 'border-red-600 text-red-600 bg-red-50' :
                    sample.status === 'completed' ? 'border-emerald-600 text-emerald-600 bg-emerald-50' :
                    sample.status === 'processing' ? 'border-indigo-600 text-indigo-600 bg-indigo-50' :
                    'border-black/20 text-black/55 bg-black/[0.02]'
                  }`}>
                    {sample.status}
                  </span>
                  
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 border uppercase tracking-tighter ${
                    sample.priority === 'critical' ? 'border-red-600 text-red-600 bg-red-50' :
                    sample.priority === 'high' ? 'border-amber-600 text-amber-600 bg-amber-50' :
                    'border-black/20 text-black/55 bg-black/[0.02]'
                  }`}>
                    {sample.priority}
                  </span>

                  <Button 
                    className="bg-black text-white rounded-none h-12 px-6 font-mono text-[10px] uppercase tracking-widest hover:bg-indigo-600 transition-all"
                    onClick={() => handleViewSample(sample)}
                  >
                    ACCESS DATA
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add Sample Modal - Brutalist */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-6">
          <div className="bg-white border-2 border-black w-full max-w-md relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-black"></div>
            <div className="p-8">
              <div className="flex items-center justify-between mb-10 border-b border-black/10 pb-6">
                <h3 className="text-2xl font-black uppercase tracking-tighter">Specimen Registration</h3>
                <Button variant="ghost" className="hover:bg-black/5 rounded-none" onClick={() => setShowAddModal(false)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
              
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-black/55">Patient Node Hash</label>
                  <Input
                    value={addForm.patient_id}
                    onChange={(e) => setAddForm({...addForm, patient_id: e.target.value})}
                    placeholder="ENTER ID..."
                    className="rounded-none border-black h-12 font-mono text-sm uppercase focus-visible:ring-0"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-black/55">Full Legal Name</label>
                  <Input
                    value={addForm.patient_name}
                    onChange={(e) => setAddForm({...addForm, patient_name: e.target.value})}
                    placeholder="ENTER NAME..."
                    className="rounded-none border-black h-12 font-mono text-sm uppercase focus-visible:ring-0"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-black/55">Biological Type</label>
                  <Select value={addForm.sample_type} onValueChange={(value) => setAddForm({...addForm, sample_type: value})}>
                    <SelectTrigger className="rounded-none border-black h-12 font-mono text-sm uppercase focus:ring-0">
                      <SelectValue placeholder="SELECT TYPE..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-none border-black">
                      <SelectItem value="Blood">BLOOD</SelectItem>
                      <SelectItem value="Urine">URINE</SelectItem>
                      <SelectItem value="Tissue">TISSUE</SelectItem>
                      <SelectItem value="CSF">CSF</SelectItem>
                      <SelectItem value="Stool">STOOL</SelectItem>
                      <SelectItem value="Sputum">SPUTUM</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-black/55">Collection Timestamp</label>
                    <Input
                      type="datetime-local"
                      value={addForm.collection_date}
                      onChange={(e) => setAddForm({...addForm, collection_date: e.target.value})}
                      className="rounded-none border-black h-12 font-mono text-xs uppercase focus-visible:ring-0"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-black/55">Priority Level</label>
                    <Select value={addForm.priority} onValueChange={(value) => setAddForm({...addForm, priority: value})}>
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
                </div>

                <Button 
                  className="w-full bg-black text-white rounded-none h-14 hover:bg-indigo-600 transition-all uppercase font-mono text-xs tracking-widest mt-4"
                  onClick={handleAddSample}
                >
                  Confirm Entry
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Sample Modal - Brutalist */}
      {showViewModal && selectedSample && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-6">
          <div className="bg-white border-2 border-black w-full max-w-2xl relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-1 bg-black"></div>
             <div className="p-10">
                <div className="flex items-center justify-between mb-10 border-b border-black/10 pb-6">
                  <h3 className="text-3xl font-black uppercase tracking-tighter">Specimen Data: {selectedSample.patient_name}</h3>
                  <Button variant="ghost" className="hover:bg-black/5 rounded-none" onClick={() => setShowViewModal(false)}>
                    <X className="h-6 w-6" />
                  </Button>
                </div>

                <div className="grid md:grid-cols-2 gap-10 mb-10">
                  <div className="space-y-6">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-black/55 mb-1">Packet Hash</p>
                      <p className="font-mono text-xl uppercase tracking-tighter">{selectedSample.id}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-black/55 mb-1">Biological Type</p>
                      <p className="font-mono text-xl uppercase tracking-tighter">{selectedSample.sample_type}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-black/55 mb-1">Collection Node</p>
                      <p className="font-mono text-sm uppercase text-black/60">{new Date(selectedSample.collection_date).toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="space-y-6">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-black/55 mb-1">Process Status</p>
                    <span className={`text-[10px] font-mono font-bold px-3 py-1 border uppercase tracking-widest inline-block ${
                      selectedSample.status === 'urgent' ? 'border-red-600 text-red-600 bg-red-50' :
                      selectedSample.status === 'completed' ? 'border-emerald-600 text-emerald-600 bg-emerald-50' :
                      selectedSample.status === 'processing' ? 'border-indigo-600 text-indigo-600 bg-indigo-50' :
                      'border-black/20 text-black/55 bg-black/[0.02]'
                    }`}>
                      {selectedSample.status}
                    </span>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-black/55 mb-1">Priority Sequence</p>
                      <p className="font-black text-xl uppercase text-red-600">{selectedSample.priority}</p>
                    </div>
                  </div>
                </div>

                {selectedSample.notes && (
                  <div className="p-6 bg-black/[0.02] border border-black/5 mb-10">
                    <p className="text-[10px] font-black uppercase tracking-widest text-black/55 mb-2">Technical Observations</p>
                    <p className="text-sm font-mono uppercase text-black/70 leading-relaxed italic">{selectedSample.notes}</p>
                  </div>
                )}

                <div className="flex gap-4">
                  <Button 
                    className="flex-1 bg-black text-white rounded-none h-16 hover:bg-indigo-600 transition-all uppercase font-mono text-xs tracking-widest"
                    onClick={() => {
                      handleStatusUpdate(selectedSample.id, 'processing')
                      setShowViewModal(false)
                    }}
                  >
                    Establish Processing Link
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
    </div>
  )
}
