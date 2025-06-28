"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Activity, Brain, Send, ArrowLeft, AlertTriangle, Stethoscope, FileText, Users } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { callGeminiAPI, DOCTOR_PROMPT_CONTEXT } from "@/lib/gemini"

export default function DoctorAIAssistantPage() {
  const [user, setUser] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [loading, setLoading] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [patientData, setPatientData] = useState("")
  const router = useRouter()

  useEffect(() => {
    const checkUser = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user || user.user_metadata?.role !== "doctor") {
        router.push("/login")
        return
      }
      
      setUser(user)
      setLoading(false)
    }
    
    checkUser()
  }, [router])

  const sendMessage = async () => {
    if (newMessage.trim() && !isLoading) {
      const userMessage = {
        id: Date.now(),
        text: newMessage,
        sender: "You",
        timestamp: new Date().toISOString(),
        isDoctor: true
      }
      setMessages([...messages, userMessage])
      
      const currentMessage = newMessage
      setNewMessage("")
      setIsLoading(true)
      
      try {
        // Call Gemini API with doctor context
        const response = await callGeminiAPI(currentMessage, DOCTOR_PROMPT_CONTEXT)
        
        const aiResponse = {
          id: Date.now() + 1,
          text: response.message,
          sender: "AI Diagnostic Assistant",
          timestamp: new Date().toISOString(),
          isDoctor: false
        }
        setMessages(prev => [...prev, aiResponse])
      } catch (error) {
        const errorResponse = {
          id: Date.now() + 1,
          text: "I'm sorry, I encountered an error while processing your request. Please try again or consult with your colleagues for immediate assistance.",
          sender: "AI Diagnostic Assistant",
          timestamp: new Date().toISOString(),
          isDoctor: false
        }
        setMessages(prev => [...prev, errorResponse])
      } finally {
        setIsLoading(false)
      }
    }
  }

  const analyzePatientData = async () => {
    if (patientData.trim() && !isLoading) {
      const currentData = patientData
      setPatientData("")
      setIsLoading(true)
      
      try {
        const prompt = `Please analyze the following patient data and provide diagnostic insights, differential diagnoses, and recommended next steps:\n\n${currentData}`
        const response = await callGeminiAPI(prompt, DOCTOR_PROMPT_CONTEXT)
        
        const analysis = {
          id: Date.now(),
          text: response.message,
          sender: "AI Diagnostic Assistant",
          timestamp: new Date().toISOString(),
          isDoctor: false
        }
        setMessages(prev => [...prev, analysis])
      } catch (error) {
        const errorResponse = {
          id: Date.now(),
          text: "I'm sorry, I encountered an error while analyzing the patient data. Please review the information manually and consult with colleagues if needed.",
          sender: "AI Diagnostic Assistant",
          timestamp: new Date().toISOString(),
          isDoctor: false
        }
        setMessages(prev => [...prev, errorResponse])
      } finally {
        setIsLoading(false)
      }
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center">
        <div className="text-center">
          <Activity className="h-8 w-8 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading AI Diagnostic Assistant...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/doctor-dashboard" className="flex items-center space-x-2 text-blue-600 hover:text-blue-700">
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Dashboard</span>
            </Link>
          </div>
          <div className="flex items-center space-x-2">
            <Image src="/medi.png" alt="MedSync Logo" width={32} height={32} />
            <span className="text-2xl font-bold text-gray-900">MedSync</span>
            <Badge className="bg-blue-100 text-blue-800">Doctor Portal</Badge>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">AI Diagnostic Assistant</h1>
          <p className="text-gray-600">Powered by Gemini AI - Get AI-powered diagnostic insights and clinical decision support</p>
        </div>

        <div className="grid md:grid-cols-4 gap-6">
          {/* AI Info Panel */}
          <div className="md:col-span-1">
            <Card className="border-blue-100">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Brain className="h-5 w-5 text-blue-600" />
                  <span>Diagnostic Support</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <h4 className="font-semibold text-sm text-blue-900">Differential Diagnosis</h4>
                    <p className="text-xs text-blue-800">AI-powered differential diagnosis suggestions</p>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg">
                    <h4 className="font-semibold text-sm text-green-900">Treatment Recommendations</h4>
                    <p className="text-xs text-green-800">Evidence-based treatment guidance</p>
                  </div>
                  <div className="p-3 bg-purple-50 rounded-lg">
                    <h4 className="font-semibold text-sm text-purple-900">Risk Assessment</h4>
                    <p className="text-xs text-purple-800">Patient risk stratification and alerts</p>
                  </div>
                  <div className="p-3 bg-orange-50 rounded-lg">
                    <h4 className="font-semibold text-sm text-orange-900">Clinical Decision Support</h4>
                    <p className="text-xs text-orange-800">Guidelines and best practices</p>
                  </div>
                </div>
                
                <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                  <div className="flex items-center space-x-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    <span className="text-sm font-semibold text-yellow-800">Clinical Judgment</span>
                  </div>
                  <p className="text-xs text-yellow-800">
                    AI suggestions are for support only. Final clinical decisions remain the responsibility of the healthcare provider.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Chat Interface */}
          <div className="md:col-span-3">
            <Card className="border-blue-100 h-96">
              <CardHeader>
                <CardTitle>AI Diagnostic Assistant</CardTitle>
                <CardDescription>Ask for diagnostic insights, differential diagnoses, or clinical guidance</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 bg-gray-50 rounded-lg p-4 overflow-y-auto mb-4">
                  <div className="space-y-3">
                    <div className="bg-blue-100 p-3 rounded-lg max-w-xs">
                      <p className="text-sm"><strong>AI Diagnostic Assistant:</strong> Hello! I'm powered by Gemini AI and can help with differential diagnoses, treatment recommendations, and clinical decision support. What would you like to discuss?</p>
                      <p className="text-xs text-gray-600 mt-1">Just now</p>
                    </div>
                    {messages.map((message) => (
                      <div key={message.id} className={`p-3 rounded-lg max-w-xs ${message.isDoctor ? 'bg-gray-100 ml-auto' : 'bg-blue-100'}`}>
                        <p className="text-sm"><strong>{message.sender}:</strong> {message.text}</p>
                        <p className="text-xs text-gray-600 mt-1">{new Date(message.timestamp).toLocaleTimeString()}</p>
                      </div>
                    ))}
                    {isLoading && (
                      <div className="bg-blue-100 p-3 rounded-lg max-w-xs">
                        <div className="flex items-center space-x-2">
                          <Activity className="h-4 w-4 text-blue-600 animate-spin" />
                          <p className="text-sm text-blue-600">AI is thinking...</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex space-x-2">
                  <Input 
                    placeholder="Ask about symptoms, differential diagnosis, treatment options..." 
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && !isLoading && sendMessage()}
                    disabled={isLoading}
                  />
                  <Button onClick={sendMessage} className="bg-blue-600 hover:bg-blue-700" disabled={isLoading}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Patient Data Analysis */}
        <div className="mt-8">
          <Card className="border-green-100">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Stethoscope className="h-5 w-5 text-green-600" />
                <span>Patient Data Analysis</span>
              </CardTitle>
              <CardDescription>Upload patient data for AI-powered analysis and insights</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Textarea
                  placeholder="Enter patient symptoms, lab results, imaging findings, or clinical notes for AI analysis..."
                  value={patientData}
                  onChange={(e) => setPatientData(e.target.value)}
                  className="min-h-[100px]"
                  disabled={isLoading}
                />
                <Button onClick={analyzePatientData} className="bg-green-600 hover:bg-green-700" disabled={isLoading}>
                  <Brain className="h-4 w-4 mr-2" />
                  {isLoading ? "Analyzing..." : "Analyze Patient Data"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
} 