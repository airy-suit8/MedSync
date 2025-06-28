"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Activity, Upload, FileText, ArrowLeft, CheckCircle, AlertCircle, Brain, Sparkles } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { useToast } from "@/hooks/use-toast"

export default function LabUploadPage() {
  const [user, setUser] = useState<any>(null)
  const [uploading, setUploading] = useState(false)
  const [mlProcessing, setMlProcessing] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [formData, setFormData] = useState({
    patientId: "",
    testType: "",
    notes: "",
    priority: "normal"
  })
  const [loading, setLoading] = useState(true)
  const [mlEnabled, setMlEnabled] = useState(true)
  const router = useRouter()
  const { toast } = useToast()
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  useEffect(() => {
    const checkUser = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user || user.user_metadata?.role !== "lab") {
        router.push("/login")
        return
      }
      
      setUser(user)
      setLoading(false)
    }
    
    checkUser()
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) {
      toast({ title: 'No file selected', description: 'Please select a file to upload', variant: 'destructive' })
      return
    }

    setUploading(true)
    setUploadError(null)

    try {
      const supabase = createClient()
      
      // Generate unique filename
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
      
      // Upload file to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('reports')
        .upload(fileName, file)

      if (uploadError) {
        throw new Error(`File upload failed: ${uploadError.message}`)
      }

      // Save report metadata to database
      const { error: dbError } = await supabase
        .from('reports')
        .insert({
          patient_id: formData.patientId,
          test_type: formData.testType,
          original_name: file.name,
          file_name: fileName,
          priority: formData.priority,
          notes: formData.notes,
          uploaded_by: user.id
        })

      if (dbError) {
        throw new Error(`Database error: ${dbError.message}`)
      }

      // Create notification for doctors (with error handling)
      try {
        await supabase
          .from('notifications')
          .insert({
            type: 'new_report',
            title: 'New Lab Report Available',
            message: `A new ${formData.testType} report has been uploaded for Patient ID: ${formData.patientId}`,
            target_role: 'doctor',
            data: {
              patient_id: formData.patientId,
              test_type: formData.testType,
              file_name: file.name,
              priority: formData.priority
            }
          })
      } catch (notificationError) {
        console.warn('Notification creation failed:', notificationError)
        // Continue even if notification fails
      }

      // Trigger ML processing (with error handling)
      if (mlEnabled) {
        setMlProcessing(true)
        try {
          console.log('Starting ML processing for:', fileName, formData.patientId, formData.testType)
          
          const response = await fetch('/api/ml-process', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              fileName: fileName,
              originalName: file.name,
              patientId: formData.patientId,
              testType: formData.testType
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
                    type: 'ml_suggestion',
                    title: 'AI Analysis Complete',
                    message: `AI analysis completed for ${formData.testType} report - Patient ID: ${formData.patientId}`,
                    target_role: 'doctor',
                    data: {
                      patient_id: formData.patientId,
                      test_type: formData.testType,
                      suggestion_id: result.suggestionId,
                      confidence: result.confidence
                    }
                  })
                console.log('ML notification created successfully')
              } catch (mlNotificationError) {
                console.warn('ML notification creation failed:', mlNotificationError)
              }
            } else {
              console.warn('ML processing returned success: false', result)
            }
          } else {
            const errorText = await response.text()
            console.warn('ML processing failed:', response.status, errorText)
          }
        } catch (mlError) {
          console.error('ML processing error:', mlError)
          // Continue even if ML processing fails
        } finally {
          setMlProcessing(false)
        }
      }

      toast({ title: 'Upload successful', description: 'Test results uploaded successfully' })
      
      // Reset form
      setFile(null)
      setFormData({
        patientId: "",
        testType: "",
        notes: "",
        priority: "normal"
      })
      
    } catch (error: any) {
      console.error('Upload error:', error)
      const errorMessage = error.message || 'Upload failed'
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
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-white flex items-center justify-center">
        <div className="text-center">
          <Activity className="h-8 w-8 text-purple-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading upload page...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/lab-dashboard" className="flex items-center space-x-2 text-purple-600 hover:text-purple-700">
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Dashboard</span>
            </Link>
          </div>
          <div className="flex items-center space-x-2">
            <Image src="/medi.png" alt="MedSync Logo" width={32} height={32} />
            <span className="text-2xl font-bold text-gray-900">MedSync</span>
            <Badge className="bg-purple-100 text-purple-800">Lab Portal</Badge>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Upload Test Results</h1>
          <p className="text-gray-600">Upload test results, scans, and reports to the system</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Upload Form */}
          <Card className="border-purple-100">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Upload className="h-5 w-5 text-purple-600" />
                <span>Upload New Report</span>
                {mlEnabled && (
                  <Badge className="bg-green-100 text-green-800 flex items-center space-x-1">
                    <Brain className="h-3 w-3" />
                    <span>AI Enabled</span>
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>Upload test results and medical reports with AI analysis</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Patient ID</label>
                  <Input
                    placeholder="Enter patient ID"
                    value={formData.patientId}
                    onChange={(e) => setFormData({...formData, patientId: e.target.value})}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Test Type</label>
                  <select 
                    className="w-full p-2 border rounded-lg"
                    value={formData.testType}
                    onChange={(e) => setFormData({...formData, testType: e.target.value})}
                    required
                  >
                    <option value="">Select test type</option>
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

                <div>
                  <label className="block text-sm font-medium mb-2">Priority</label>
                  <select 
                    className="w-full p-2 border rounded-lg"
                    value={formData.priority}
                    onChange={(e) => setFormData({...formData, priority: e.target.value})}
                  >
                    <option value="normal">Normal</option>
                    <option value="urgent">Urgent</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Notes</label>
                  <Textarea
                    placeholder="Add any additional notes or observations..."
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    rows={3}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Upload File</label>
                  <Input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.dicom"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    required
                  />
                  <p className="text-xs text-gray-600 mt-1">Accepted formats: PDF, JPG, PNG, DICOM</p>
                </div>

                {/* ML Processing Toggle */}
                <div className="flex items-center space-x-2 p-3 bg-blue-50 rounded-lg">
                  <input
                    type="checkbox"
                    id="mlEnabled"
                    checked={mlEnabled}
                    onChange={(e) => setMlEnabled(e.target.checked)}
                    className="rounded"
                  />
                  <label htmlFor="mlEnabled" className="text-sm font-medium text-blue-900">
                    Enable AI Analysis
                  </label>
                  <Sparkles className="h-4 w-4 text-blue-600" />
                </div>
                {mlEnabled && (
                  <p className="text-xs text-blue-600">
                    AI will analyze uploaded images and provide suggestions to doctors
                  </p>
                )}

                <Button 
                  type="submit" 
                  className="w-full bg-purple-600 hover:bg-purple-700" 
                  disabled={uploading || mlProcessing}
                >
                  {uploading ? (
                    <>
                      <Activity className="h-4 w-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : mlProcessing ? (
                    <>
                      <Brain className="h-4 w-4 mr-2 animate-pulse" />
                      AI Processing...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Report
                    </>
                  )}
                </Button>

                {/* Error Display */}
                {uploadError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <AlertCircle className="h-4 w-4 text-red-600" />
                      <p className="text-sm text-red-800 font-medium">Upload Error</p>
                    </div>
                    <p className="text-sm text-red-700 mt-1">{uploadError}</p>
                    <p className="text-xs text-red-600 mt-2">
                      Note: If this is a database error, you may need to run the setup SQL scripts in Supabase.
                    </p>
                  </div>
                )}

                {/* Success Display */}
                {uploadSuccess && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <p className="text-sm text-green-800 font-medium">Upload Successful</p>
                    </div>
                    <p className="text-sm text-green-700 mt-1">Report uploaded successfully and sent to doctors for review.</p>
                  </div>
                )}
              </form>
            </CardContent>
          </Card>

          {/* Upload Guidelines */}
          <div className="space-y-6">
            <Card className="border-purple-100">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span>Upload Guidelines</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 text-sm">
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">Patient ID Guidelines</h4>
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-blue-800 mb-2">
                        <strong>Important:</strong> Use the patient's user ID as the Patient ID to ensure reports appear in their patient portal.
                      </p>
                      <ul className="text-blue-700 text-xs space-y-1">
                        <li>• Patient ID should match the user's ID from the patient portal</li>
                        <li>• You can find patient IDs in the patient management system</li>
                        <li>• Reports will automatically appear in the patient's "My Reports" section</li>
                        <li>• If unsure, contact the patient or check their registration details</li>
                      </ul>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">File Requirements</h4>
                    <ul className="space-y-1 text-gray-700">
                      <li>• Maximum file size: 10MB</li>
                      <li>• Supported formats: PDF, JPG, PNG, DICOM</li>
                      <li>• Ensure files are clear and readable</li>
                      <li>• Include patient name in filename if possible</li>
                    </ul>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">AI Analysis</h4>
                    <ul className="space-y-1 text-gray-700">
                      <li>• AI analysis is available for image-based reports</li>
                      <li>• Results are sent to doctors for review</li>
                      <li>• Analysis includes abnormality detection</li>
                      <li>• Confidence scores are provided</li>
                    </ul>
                  </div>
                
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <h4 className="font-semibold text-sm text-blue-900">AI Analysis</h4>
                    <ul className="text-xs text-blue-800 mt-1 space-y-1">
                      <li>• Available for: X-Ray, CT, MRI, Ultrasound, ECG, Blood Tests</li>
                      <li>• AI provides findings and recommendations</li>
                      <li>• Results sent directly to doctors</li>
                    </ul>
                  </div>
                  <div className="p-3 bg-yellow-50 rounded-lg">
                    <h4 className="font-semibold text-sm text-yellow-900">Best Practices</h4>
                    <ul className="text-xs text-yellow-800 mt-1 space-y-1">
                      <li>• Double-check patient ID accuracy</li>
                      <li>• Include relevant clinical notes</li>
                      <li>• Use descriptive file names</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-purple-100">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <AlertCircle className="h-5 w-5 text-orange-600" />
                  <span>Recent Uploads</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="p-2 bg-gray-50 rounded-lg">
                    <p className="text-sm font-medium">Patient 12345 - Blood Test</p>
                    <p className="text-xs text-gray-600">Uploaded 2 hours ago</p>
                    <div className="flex space-x-1 mt-1">
                      <Badge className="bg-green-100 text-green-800 text-xs">Completed</Badge>
                      <Badge className="bg-blue-100 text-blue-800 text-xs">AI Analyzed</Badge>
                    </div>
                  </div>
                  <div className="p-2 bg-gray-50 rounded-lg">
                    <p className="text-sm font-medium">Patient 67890 - X-Ray</p>
                    <p className="text-xs text-gray-600">Uploaded 4 hours ago</p>
                    <div className="flex space-x-1 mt-1">
                      <Badge className="bg-blue-100 text-blue-800 text-xs">Processing</Badge>
                      <Badge className="bg-purple-100 text-purple-800 text-xs">AI Processing</Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
} 