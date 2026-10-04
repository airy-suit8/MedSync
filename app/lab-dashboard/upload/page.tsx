"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Activity, Upload, FileText, ArrowLeft, CheckCircle, AlertCircle, Brain, Sparkles, User } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { createAuthenticatedClient, testDatabaseConnection } from "@/lib/supabase-auth"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { useToast } from "@/hooks/use-toast"
import { UUID_REGEX } from "@/lib/constants"

export default function LabUploadPage() {
  const [user, setUser] = useState<any>(null)
  const [uploading, setUploading] = useState(false)
  const [mlProcessing, setMlProcessing] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [formData, setFormData] = useState({
    patientId: "",
    patientName: "",
    doctorId: "",
    testType: "",
    dateOfBirth: "",
    age: "",
    gender: "",
    phoneNumber: "",
    address: "",
    eyeSide: "",
    familyHistory: "",
    previousDiagnosis: "",
    ongoingTreatments: "",
    notes: "",
    priority: "normal"
  })
  const [patientProfile, setPatientProfile] = useState<any>(null)
  const [doctorProfile, setDoctorProfile] = useState<any>(null)
  const [loadingPatient, setLoadingPatient] = useState(false)
  const [loadingDoctor, setLoadingDoctor] = useState(false)
  const [loading, setLoading] = useState(true)
  const [mlEnabled, setMlEnabled] = useState(true)
  const [dbConnectionTested, setDbConnectionTested] = useState(false)
  const router = useRouter()
  const { toast } = useToast()
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const checkUser = async () => {
      try {
        const supabase = createClient()
        // The session is already persisted by the login flow. Middleware
        // validates it server-side; read it locally here to avoid a second
        // auth network request blocking the upload screen.
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error) throw error
        const user = session?.user

        const role = user?.app_metadata?.role ?? user?.user_metadata?.role
        if (!user || role !== "lab") {
          router.push("/login")
          return
        }

        if (active) setUser(user)
      } catch (error) {
        console.error("Unable to verify lab session:", error)
        router.push("/login")
      } finally {
        if (active) setLoading(false)
      }
    }
    
    checkUser()
    return () => { active = false }
  }, [router])

  const fetchPatientProfile = async (patientId: string, doctorId = formData.doctorId) => {
    if (!patientId.trim()) {
      setPatientProfile(null)
      return
    }

    // Validate patientId format and length
    const trimmedId = patientId.trim()
    if (trimmedId.length > 100) {
      console.warn('❌ Patient ID too long:', trimmedId.length, 'characters')
      toast({
        title: "Invalid Patient ID",
        description: "Patient ID is too long. Please enter a valid Short ID or UUID.",
        variant: "destructive"
      })
      setPatientProfile(null)
      setLoadingPatient(false)
      return
    }

    setLoadingPatient(true)
    try {
      const supabase = createClient()
      let patientQuery = supabase
        .from('profile_directory')
        .select('id, name, role, short_id')
        .eq('role', 'patient')
      patientQuery = UUID_REGEX.test(trimmedId)
        ? patientQuery.eq('id', trimmedId)
        : patientQuery.ilike('short_id', trimmedId)
      const { data: patientDirectory, error } = await patientQuery.maybeSingle()

      if (error) {
        console.warn('Error fetching patient:', error.message)
        setPatientProfile(null)
        toast({
          title: "Error fetching patient",
          description: `Error: ${error.message}`,
          variant: "destructive"
        })
      } else if (!patientDirectory) {
        console.warn('No patient profile found for identifier:', trimmedId)
        setPatientProfile(null)
        toast({
          title: "Patient not found",
          description: "No patient profile found. Use the patient's Short ID or UUID.",
          variant: "destructive"
        })
      } else {
        let patientDetails: any = patientDirectory
        if (doctorId.trim()) {
          let doctorQuery = supabase
            .from('profile_directory')
            .select('id')
            .eq('role', 'doctor')
          doctorQuery = UUID_REGEX.test(doctorId.trim())
            ? doctorQuery.eq('id', doctorId.trim())
            : doctorQuery.ilike('short_id', doctorId.trim())
          const { data: doctorDirectory, error: doctorError } = await doctorQuery.maybeSingle()

          if (doctorError || !doctorDirectory) {
            throw doctorError || new Error('Doctor not found')
          }

          const { data: details, error: detailsError } = await supabase.rpc(
            'get_lab_upload_patient_profile',
            { p_patient_id: patientDirectory.id, p_doctor_id: doctorDirectory.id },
          )

          if (detailsError) throw detailsError
          patientDetails = Array.isArray(details) ? details[0] : details
          if (!patientDetails) {
            setPatientProfile(null)
            toast({
              title: 'Patient is not assigned to this doctor',
              description: 'Confirm the active patient-doctor assignment before uploading a report.',
              variant: 'destructive',
            })
            return
          }
        }

        setPatientProfile(patientDetails)
        setFormData(prev => ({
          ...prev,
          patientName: patientDetails.name || patientDirectory.name || '',
          dateOfBirth: patientDetails.date_of_birth || '',
          age: patientDetails.date_of_birth
            ? String(Math.floor((Date.now() - new Date(patientDetails.date_of_birth).getTime()) / 31_557_600_000))
            : '',
          gender: patientDetails.gender || '',
          phoneNumber: patientDetails.phone || '',
          address: patientDetails.address || '',
          previousDiagnosis: patientDetails.chronic_conditions || '',
          ongoingTreatments: patientDetails.current_medications || '',
        }))
        toast({
          title: 'Patient found',
          description: `Patient: ${patientDetails.name || patientDirectory.name}`,
          duration: 3000,
          className: "bg-green-50 border-green-200 text-green-800"
        })
      }
    } catch (error) {
      console.error('Error fetching patient:', error)
      setPatientProfile(null)
    } finally {
      setLoadingPatient(false)
    }
  }

  const fetchDoctorProfile = async (doctorId: string) => {
    if (!doctorId.trim()) {
      setDoctorProfile(null)
      return
    }

    setLoadingDoctor(true)
    try {
      const supabase = createClient()
      let doctorQuery = supabase
        .from('profile_directory')
        .select('id, name, role, short_id, specialty')
        .eq('role', 'doctor')
      doctorQuery = UUID_REGEX.test(doctorId.trim())
        ? doctorQuery.eq('id', doctorId.trim())
        : doctorQuery.ilike('short_id', doctorId.trim())
      const { data: profile, error } = await doctorQuery.maybeSingle()

      if (error) {
        console.warn('Error fetching doctor:', error.message)
        setDoctorProfile(null)
        toast({
          title: "Error fetching doctor",
          description: `Error: ${error.message}`,
          variant: "destructive"
        })
      } else if (!profile) {
        console.warn('No doctor found for identifier:', doctorId)
        setDoctorProfile(null)
        toast({
          title: "Doctor not found",
          description: "No doctor found. Use the doctor's Short ID or UUID.",
          variant: "destructive"
        })
      } else {
        setDoctorProfile(profile)
        toast({
          title: "✅ Doctor Found!",
          description: `Doctor: ${profile.name || 'Doctor'}`,
          duration: 3000,
          className: "bg-green-50 border-green-200 text-green-800"
        })
      }
    } catch (error) {
      console.error('Error fetching doctor:', error)
      setDoctorProfile(null)
    } finally {
      setLoadingDoctor(false)
    }
  }

  const handlePatientIdChange = (value: string) => {
    setFormData(prev => ({ ...prev, patientId: value }))
    // Fetch patient profile when Patient ID changes
    if (value.trim()) {
      fetchPatientProfile(value, formData.doctorId)
    } else {
      setPatientProfile(null)
      // Clear auto-filled data
      setFormData(prev => ({
        ...prev,
        patientName: "",
        dateOfBirth: "",
        age: "",
        gender: "",
        phoneNumber: "",
        address: "",
        familyHistory: "",
        previousDiagnosis: "",
        ongoingTreatments: ""
      }))
    }
  }

  const handleDoctorIdChange = (value: string) => {
    setFormData(prev => ({ ...prev, doctorId: value }))
    if (value.trim()) {
      fetchDoctorProfile(value)
      if (formData.patientId.trim()) fetchPatientProfile(formData.patientId, value)
    } else {
      setDoctorProfile(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) {
      toast({ title: 'No file selected', description: 'Please select a file to upload', variant: 'destructive' })
      return
    }

    setUploading(true)
    setUploadError(null)
    let uploadedFileName: string | null = null

    try {
      const supabase = createClient()
      const resolveDirectoryId = async (identifier: string, role: 'doctor' | 'patient') => {
        const trimmed = identifier.trim()
        if (!trimmed) return null
        let query = supabase
          .from('profile_directory')
          .select('id')
          .eq('role', role)
        query = UUID_REGEX.test(trimmed)
          ? query.eq('id', trimmed)
          : query.ilike('short_id', trimmed)
        const { data, error } = await query.maybeSingle()
        if (error) throw error
        return data?.id || null
      }

      const resolvedDoctorId = await resolveDirectoryId(formData.doctorId, 'doctor')
      const resolvedPatientId = await resolveDirectoryId(formData.patientId, 'patient')
      if (!resolvedDoctorId || !resolvedPatientId) {
        throw new Error('Enter a valid patient and doctor ID or Short ID.')
      }

      const { data: assignedPatient, error: assignmentError } = await supabase.rpc(
        'get_lab_upload_patient_profile',
        { p_patient_id: resolvedPatientId, p_doctor_id: resolvedDoctorId },
      )
      if (assignmentError) throw assignmentError
      if (!assignedPatient || (Array.isArray(assignedPatient) && assignedPatient.length === 0)) {
        throw new Error('This patient is not actively assigned to the selected doctor.')
      }

      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
      const { error: uploadError } = await supabase.storage
        .from('reports')
        .upload(fileName, file, { cacheControl: '3600', upsert: false })
      if (uploadError) throw new Error(`File upload failed: ${uploadError.message}`)
      uploadedFileName = fileName

      console.log('🔍 Resolved IDs - Patient:', resolvedPatientId, 'Doctor:', resolvedDoctorId)
      console.log('🔍 Original inputs - Patient:', formData.patientId, 'Doctor:', formData.doctorId)

      // Step 2: Create report directly in database (simpler approach)
      console.log('📊 Creating report in database...')
      
      const { data: reportData, error: reportError } = await supabase
        .from('reports')
        .insert({
          patient_id: resolvedPatientId, // Use resolved UUID instead of original input
          doctor_id: resolvedDoctorId,
          test_type: formData.testType,
          original_name: file.name,
          file_name: fileName,
          priority: formData.priority,
          notes: formData.notes,
          uploaded_by: user.id,
          patient_info: {
            patientId: formData.patientId, // Keep original input for reference
            resolvedPatientId: resolvedPatientId, // Add resolved UUID for debugging
            testType: formData.testType,
            fullName: formData.patientName || `Patient ${formData.patientId}`,
            dateOfBirth: formData.dateOfBirth || 'Not provided',
            age: formData.age || 'Not provided',
            gender: formData.gender || 'Not specified',
            phoneNumber: formData.phoneNumber || 'Not provided',
            address: formData.address || 'Not provided',
            eyeSide: formData.eyeSide || 'Not applicable',
            familyHistoryOfCancer: formData.familyHistory || 'Not provided',
            previousDiagnosis: formData.previousDiagnosis || 'None',
            ongoingTreatments: formData.ongoingTreatments || 'None',
            recordCreated: new Date().toISOString(),
            lastUpdated: new Date().toISOString()
          }
        })
        .select('id')
        .single()

      if (reportError) {
        console.error('❌ Database insert failed:', reportError)
        throw new Error(`Database error: ${reportError.message}`)
      }

      console.log('✅ Report created successfully in database:', reportData.id)

      // Step 3: Trigger ML processing
      if (mlEnabled) {
        setMlProcessing(true)
        try {
          console.log('🧠 Starting ML processing for:', fileName, formData.patientId, formData.testType)
          
                     const response = await fetch('/api/ml-process', {
             method: 'POST',
             headers: {
               'Content-Type': 'application/json',
             },
             body: JSON.stringify({
               fileName: fileName,
               originalName: file.name,
               patientId: formData.patientId,
               testType: formData.testType,
               reportId: reportData.id,
               doctorId: formData.doctorId
             }),
           })

          console.log('ML API response status:', response.status)
          
          if (response.ok) {
            const result = await response.json()
            console.log('ML processing result:', result)
            
                         // Create ML suggestion notification
             if (result.success) {
               try {
                 await supabase
                   .from('notifications')
                   .insert({
                     user_id: reportData.id, // Use report ID as user_id
                     title: 'AI Analysis Complete',
                     message: `AI analysis completed for ${formData.testType} report - Patient ID: ${formData.patientId}`,
                     notification_type: 'ml_suggestion',
                     related_id: result.suggestionId,
                     related_type: 'ml_suggestion',
                     data: {
                       patient_id: formData.patientId,
                       test_type: formData.testType,
                       suggestion_id: result.suggestionId,
                       confidence: result.confidence
                     }
                   })
                 console.log('✅ ML notification created successfully')
               } catch (mlNotificationError) {
                 console.warn('⚠️ ML notification creation failed:', mlNotificationError)
               }
             } else {
               console.warn('⚠️ ML processing returned success: false', result)
             }
          } else {
            const errorText = await response.text()
            console.warn('⚠️ ML processing failed:', response.status, errorText)
          }
        } catch (mlError) {
          console.error('❌ ML processing error:', mlError)
          // Continue even if ML processing fails
        } finally {
          setMlProcessing(false)
        }
      }

      // Show success message with more details
      toast({ 
        title: '✅ Report Uploaded Successfully!', 
        description: `Patient ID: ${formData.patientId} | Test Type: ${formData.testType} | File: ${file?.name}`,
        duration: 5000,
        className: "bg-green-50 border-green-200 text-green-800"
      })
      
      // Set success state for UI feedback
      setUploadSuccess(true)
      
      // Optional: Add a subtle notification sound/vibration if supported
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([100, 50, 100]); // Short vibration pattern
      }
      
      // Reset form
      setFile(null)
      setFormData({
        patientId: "",
        patientName: "",
          doctorId: "",
        testType: "",
        dateOfBirth: "",
        age: "",
        gender: "",
        phoneNumber: "",
        address: "",
        eyeSide: "",
        familyHistory: "",
        previousDiagnosis: "",
        ongoingTreatments: "",
        notes: "",
        priority: "normal"
      })
      
      // Clear success state after 3 seconds
      setTimeout(() => {
        setUploadSuccess(false)
      }, 3000)
      
    } catch (error: any) {
      console.error('❌ Upload error:', error)
      const errorMessage = error.message || 'Upload failed'
      if (uploadedFileName) {
        await createClient().storage.from('reports').remove([uploadedFileName])
      }
      setUploadError(errorMessage)
      toast({ 
        title: 'Upload failed', 
        description: errorMessage, 
        variant: 'destructive' 
      })
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-transparent">
        <div className="flex flex-col items-center">
          <Activity className="h-8 w-8 animate-spin mb-4 text-black" />
          <span className="text-xs font-mono uppercase tracking-widest text-black/60">Initializing Uplink...</span>
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
          <h1 className="text-4xl font-bold tracking-tight uppercase mb-2">Upload Diagnostic Data</h1>
          <p className="text-black/60 font-light text-lg italic">
            Securely synchronize clinical results with the patient record
          </p>
        </div>
        <div className="text-right hidden md:block">
          <span className="text-[10px] font-mono uppercase tracking-widest text-black/55 block mb-1">
            Portal Mode
          </span>
          <span className="text-xl font-mono border-b-2 border-indigo-600">
            LAB_UPLINK_v2.0
          </span>
        </div>
      </header>

      {/* Success Message Banner */}
      {uploadSuccess && (
        <div className="mb-8 p-6 bg-emerald-50 border border-emerald-500/20 relative overflow-hidden">
          <div className="absolute left-0 top-0 h-full w-0.5 bg-emerald-600"></div>
          <div className="flex items-center space-x-3">
            <CheckCircle className="h-5 w-5 text-emerald-600" />
            <div>
              <h3 className="text-sm font-black uppercase tracking-tight text-emerald-800">Uplink Successful</h3>
              <p className="text-xs font-mono uppercase text-emerald-700 mt-1">
                Data packet synchronized. AI analysis queued for processing.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-12">
        {/* Upload Form */}
        <div className="lg:col-span-2 space-y-8">
          <div className="border border-black/10 bg-white p-10 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-0.5 bg-indigo-600"></div>
            
            <div className="flex items-center justify-between mb-10 border-b border-black/10 pb-6">
               <h3 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-3">
                 <Upload className="h-6 w-6" />
                 Report Payload
               </h3>
               {mlEnabled && (
                 <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 border border-amber-500/20">
                   <Brain className="h-3.5 w-3.5 text-amber-600" />
                   <span className="text-[10px] font-black uppercase tracking-widest text-amber-600">AI Enabled</span>
                 </div>
               )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-black/55">Patient Identification</label>
                  <div className="relative">
                    <Input
                      placeholder="ENTER SHORT ID / UUID"
                      value={formData.patientId}
                      onChange={(e) => handlePatientIdChange(e.target.value)}
                      className="rounded-none border-black h-12 font-mono text-sm uppercase focus-visible:ring-0 focus-visible:border-indigo-600"
                      required
                    />
                    {loadingPatient && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <Activity className="h-4 w-4 text-indigo-600 animate-spin" />
                      </div>
                    )}
                  </div>
                  {patientProfile && (
                    <div className="p-4 bg-emerald-50 border border-emerald-500/10 relative overflow-hidden">
                      <div className="absolute left-0 top-0 h-full w-0.5 bg-emerald-600"></div>
                      <div className="text-[10px] font-mono text-emerald-800 uppercase space-y-1">
                        <p><strong>NODE:</strong> {patientProfile.name || patientProfile.full_name || 'UNKNOWN'}</p>
                        <p><strong>AGE:</strong> {patientProfile.age || (patientProfile.date_of_birth ? new Date().getFullYear() - new Date(patientProfile.date_of_birth).getFullYear() : 'N/A')} YR | {patientProfile.gender || 'N/A'}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-black/55">Ordering Physician</label>
                  <div className="relative">
                    <Input
                      placeholder="ENTER DOCTOR ID"
                      value={formData.doctorId}
                      onChange={(e) => handleDoctorIdChange(e.target.value)}
                      className="rounded-none border-black h-12 font-mono text-sm uppercase focus-visible:ring-0 focus-visible:border-indigo-600"
                      required
                    />
                    {loadingDoctor && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <Activity className="h-4 w-4 text-indigo-600 animate-spin" />
                      </div>
                    )}
                  </div>
                  {doctorProfile && (
                    <div className="p-4 bg-emerald-50 border border-emerald-500/10 relative overflow-hidden">
                      <div className="absolute left-0 top-0 h-full w-0.5 bg-emerald-600"></div>
                      <div className="text-[10px] font-mono text-emerald-800 uppercase space-y-1">
                        <p><strong>NAME:</strong> {doctorProfile.name}</p>
                        <p><strong>ROLE:</strong> {doctorProfile.specialty || 'Generalist'}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-black/55">Diagnostic Protocol</label>
                  <select 
                    className="w-full h-12 border border-black rounded-none bg-white font-mono text-sm uppercase px-4 focus:outline-none focus:border-indigo-600"
                    value={formData.testType}
                    onChange={(e) => setFormData({...formData, testType: e.target.value})}
                    required
                  >
                    <option value="">SELECT TEST TYPE</option>
                    <option value="blood_test">Blood Test</option>
                    <option value="x_ray">X-Ray</option>
                    <option value="ct_scan">CT Scan</option>
                    <option value="mri">MRI</option>
                    <option value="ultrasound">Ultrasound</option>
                    <option value="ecg">ECG</option>
                    <option value="urine_test">Urine Test</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="space-y-4">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-black/55">Priority Sequence</label>
                  <select 
                    className="w-full h-12 border border-black rounded-none bg-white font-mono text-sm uppercase px-4 focus:outline-none focus:border-indigo-600"
                    value={formData.priority}
                    onChange={(e) => setFormData({...formData, priority: e.target.value})}
                  >
                    <option value="normal">Normal Priority</option>
                    <option value="urgent">Urgent Processing</option>
                    <option value="critical">Critical (Red-Line)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-4">
                <label className="block text-[10px] font-black uppercase tracking-widest text-black/55">Technician Observations</label>
                <Textarea
                  placeholder="ADD ANY CLINICAL NOTES OR OBSERVATIONS..."
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  rows={4}
                  className="rounded-none border-black font-mono text-sm uppercase focus-visible:ring-0 focus-visible:border-indigo-600"
                />
              </div>

              <div className="space-y-4">
                <label className="block text-[10px] font-black uppercase tracking-widest text-black/55">Binary Payload (File)</label>
                <div className="border-2 border-dashed border-black/10 p-8 text-center hover:border-black/30 transition-all cursor-pointer relative bg-black/[0.01] group">
                   <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.dicom"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    required
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="flex flex-col items-center pointer-events-none">
                    <FileText className="h-8 w-8 mb-4 text-black/20" />
                    <p className="text-xs font-mono uppercase text-black/60">
                      {file ? file.name : "DROP FILE OR CLICK TO BROWSE"}
                    </p>
                    <p className="text-[10px] font-mono uppercase text-black/55 mt-2">PDF, JPG, PNG, DICOM (MAX 10MB)</p>
                  </div>
                </div>
              </div>

              {/* ML Processing Toggle */}
              <div className="flex items-center justify-between p-6 bg-amber-50 border border-amber-500/10">
                <div className="flex items-center space-x-3">
                   <div className="p-2 bg-amber-600 text-white">
                     <Brain className="h-4 w-4" />
                   </div>
                   <div>
                     <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-900">AI Diagnostic Uplink</h4>
                     <p className="text-[10px] font-mono text-amber-800/60 uppercase">ML analysis will be triggered on synchronize</p>
                   </div>
                </div>
                <input
                  type="checkbox"
                  id="mlEnabled"
                  checked={mlEnabled}
                  onChange={(e) => setMlEnabled(e.target.checked)}
                  className="h-5 w-5 rounded-none border-black accent-amber-600 cursor-pointer"
                />
              </div>

              <Button 
                type="submit" 
                disabled={uploading || mlProcessing}
                className="w-full bg-black text-white rounded-none h-16 hover:bg-indigo-600 transition-all uppercase font-mono text-xs tracking-[0.2em] flex items-center justify-center gap-4 group"
              >
                {uploading ? (
                  <>
                    <Activity className="h-5 w-5 animate-spin" />
                    UPLOADING DATA...
                  </>
                ) : mlProcessing ? (
                  <>
                    <Brain className="h-5 w-5 animate-pulse" />
                    AI PROCESSING...
                  </>
                ) : (
                  <>
                    <span>Synchronize Payload</span>
                    <Upload className="h-5 w-5 group-hover:-translate-y-1 transition-transform" />
                  </>
                )}
              </Button>

              {/* Error Display */}
              {uploadError && (
                <div className="p-6 bg-red-50 border border-red-500/20 relative overflow-hidden">
                  <div className="absolute left-0 top-0 h-full w-0.5 bg-red-600"></div>
                  <div className="flex items-center space-x-3 mb-2">
                    <AlertCircle className="h-5 w-5 text-red-600" />
                    <p className="text-sm font-black uppercase text-red-800 tracking-tight">Sync Failed</p>
                  </div>
                  <p className="text-xs font-mono text-red-700 uppercase leading-relaxed">{uploadError}</p>
                </div>
              )}
            </form>
          </div>
        </div>

        {/* Upload Guidelines */}
        <div className="space-y-8">
          <div className="border border-black/10 bg-white p-8 relative">
            <div className="absolute top-0 left-0 w-full h-0.5 bg-emerald-600"></div>
            <h3 className="text-xl font-black uppercase tracking-tight mb-8 flex items-center gap-3">
               <CheckCircle className="h-5 w-5 text-emerald-600" />
               Uplink Protocol
            </h3>
            
            <div className="space-y-8">
              <div>
                <h4 className="text-[10px] font-black uppercase tracking-widest text-black/55 mb-4">Identification</h4>
                <div className="p-4 bg-black/[0.02] border border-black/5 space-y-4">
                  <p className="text-[10px] font-mono uppercase text-black/60 leading-relaxed">
                    Use Short ID (preferred) or UUID to ensure data packet routing to correct node.
                  </p>
                  <ul className="text-[10px] font-mono text-black/55 uppercase space-y-2">
                    <li>• Resolve ID from patient profile</li>
                    <li>• Verify Physician Node ID</li>
                  </ul>
                </div>
              </div>

              <div>
                <h4 className="text-[10px] font-black uppercase tracking-widest text-black/55 mb-4">Payload Constraints</h4>
                <ul className="text-[10px] font-mono uppercase text-black/60 space-y-3">
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 bg-black/20"></span>
                    MAX SIZE: 10MB
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 bg-black/20"></span>
                    FORMATS: PDF, JPG, DICOM
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 bg-black/20"></span>
                    CLEAR SCAN RESOLUTION
                  </li>
                </ul>
              </div>

              <div className="p-4 bg-indigo-50 border border-indigo-500/10">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-900 mb-2">Automated Analysis</h4>
                <p className="text-[10px] font-mono text-indigo-800/60 uppercase leading-relaxed">
                  ML models will evaluate data for patterns and abnormalities. Results encrypted and sent to physician.
                </p>
              </div>
            </div>
          </div>

          <div className="border border-black/10 bg-white p-8 relative">
            <div className="absolute top-0 left-0 w-full h-0.5 bg-black/10"></div>
            <h3 className="text-xl font-black uppercase tracking-tight mb-8">Recent Uplinks</h3>
            <div className="space-y-4">
              {[
                { label: 'Patient 12345', type: 'Blood Test', time: '2H AGO', status: 'COMPLETED' },
                { label: 'Patient 67890', type: 'X-Ray', time: '4H AGO', status: 'PROCESSING' }
              ].map((item, i) => (
                <div key={i} className="p-4 border border-black/5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-tight">{item.label}</p>
                    <p className="text-[10px] font-mono text-black/55 uppercase">{item.type} • {item.time}</p>
                  </div>
                  <span className={`text-[9px] font-black px-2 py-0.5 border ${
                    item.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-indigo-50 text-indigo-600 border-indigo-200'
                  }`}>
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 
