"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Activity, Brain, Send, ArrowLeft, AlertTriangle, Stethoscope, FileText, Users, AlertCircle } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { callGeminiAPI, DOCTOR_PROMPT_CONTEXT } from "@/lib/gemini"
import ClinicalNotice from "@/components/medical/common/ClinicalNotice"


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
        console.log('Attempting Gemini API call...')
        const response = await callGeminiAPI(currentMessage, DOCTOR_PROMPT_CONTEXT)
        console.log('Gemini response success:', response.success)
        
        if (!response.success) {
          throw new Error(response.error || 'API failed')
        }
        
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
        
        if (!response.success) {
          throw new Error(response.error || 'API failed')
        }
        
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
      <div className="min-h-screen flex items-center justify-center bg-transparent">
        <div className="flex flex-col items-center">
          <Activity className="h-8 w-8 animate-spin mb-4 text-black" />
          <span className="text-xs font-mono uppercase tracking-widest text-black/60">Loading Assistant...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-transparent p-12 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <ClinicalNotice>Messages are sent to Google Gemini; do not include names or other identifying details.</ClinicalNotice>
      </div>
      <header className="border-b border-black/10 pb-8 mb-12 flex items-end justify-between">
        <div>
          <Link href="/doctor-dashboard" className="inline-flex items-center space-x-2 text-xs font-mono uppercase tracking-widest text-black/55 hover:text-black mb-4 transition-colors">
            <ArrowLeft className="h-3 w-3" />
            <span>Back to Dashboard</span>
          </Link>
          <h1 className="text-4xl font-bold tracking-tight uppercase mb-2">AI Diagnostic Assistant</h1>
          <p className="text-black/60 font-light text-lg">
            Powered by Gemini AI - Get AI-powered diagnostic insights and clinical decision support
          </p>
        </div>
        <div className="text-right hidden md:block">
          <span className="text-[10px] font-mono uppercase tracking-widest text-black/55 block mb-1">
            Portal Status
          </span>
          <span className="text-xl font-mono border-b border-black inline-flex items-center gap-2">
            <span className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></span>
            ACTIVE
          </span>
        </div>
      </header>

      <div className="grid md:grid-cols-4 gap-6 mb-8">
        {/* AI Info Panel */}
        <div className="md:col-span-1 space-y-6">
          <div className="border border-black/10 bg-white p-6 relative overflow-hidden">
            <div className="absolute left-0 top-0 h-full w-0.5 bg-amber-600"></div>
            <h2 className="text-lg font-bold uppercase mb-4 flex items-center gap-2">
              <Brain className="h-5 w-5" />
              <span>Support</span>
            </h2>
            <div className="space-y-3">
              <div className="p-3 bg-black/[0.02] border border-black/5">
                <h4 className="font-bold text-xs uppercase mb-1">Differential Diagnosis</h4>
                <p className="text-[10px] font-mono text-black/60 uppercase">AI-powered suggestions</p>
              </div>
              <div className="p-3 bg-black/[0.02] border border-black/5">
                <h4 className="font-bold text-xs uppercase mb-1">Treatment Recs</h4>
                <p className="text-[10px] font-mono text-black/60 uppercase">Evidence-based guidance</p>
              </div>
              <div className="p-3 bg-black/[0.02] border border-black/5">
                <h4 className="font-bold text-xs uppercase mb-1">Risk Assessment</h4>
                <p className="text-[10px] font-mono text-black/60 uppercase">Patient stratification</p>
              </div>
              <div className="p-3 bg-black/[0.02] border border-black/5">
                <h4 className="font-bold text-xs uppercase mb-1">Decision Support</h4>
                <p className="text-[10px] font-mono text-black/60 uppercase">Guidelines & practices</p>
              </div>
            </div>
            
            <div className="mt-6 p-6 border border-red-500 bg-red-50 relative overflow-hidden">
              <div className="absolute bottom-0 left-0 w-full h-0.5 bg-red-600"></div>
              <div className="flex items-center space-x-2 mb-3">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <span className="text-[10px] font-black uppercase tracking-widest text-red-600">Critical: AI Notice</span>
              </div>
              <p className="text-[10px] font-mono text-red-600/80 uppercase leading-relaxed">
                AI suggestions are for support only. Final clinical decisions remain the responsibility of the healthcare provider.
              </p>
            </div>
          </div>
        </div>

        {/* Chat Interface */}
        <div className="md:col-span-3">
          <div className="border border-black/10 bg-white h-[600px] flex flex-col">
            <div className="p-4 border-b border-black/10 bg-black/[0.02] flex items-center justify-between">
              <h2 className="font-bold uppercase tracking-widest text-sm flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Live Assistant Chat
              </h2>
              <span className="px-2 py-0.5 text-[10px] font-mono bg-black text-white uppercase">Ready</span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="flex justify-start">
                <div className="bg-black/5 border border-black/10 p-4 max-w-[80%] rounded-none">
                   <p className="text-sm font-mono leading-relaxed"><strong>AI DIAGNOSTIC ASSISTANT:</strong> Hello! I&apos;m powered by Gemini AI and can help with differential diagnoses, treatment recommendations, and clinical decision support. What would you like to discuss?</p>
                  <p className="text-[10px] font-mono text-black/55 uppercase mt-2">Just now</p>
                </div>
              </div>

              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.isDoctor ? 'justify-end' : 'justify-start'}`}>
                  <div className={`p-4 max-w-[80%] rounded-none ${message.isDoctor ? 'bg-black text-white' : 'bg-black/5 border border-black/10'}`}>
                    <p className="text-sm font-mono leading-relaxed"><strong>{message.sender.toUpperCase()}:</strong> {message.text}</p>
                    <p className={`text-[10px] font-mono uppercase mt-2 ${message.isDoctor ? 'text-white/60' : 'text-black/55'}`}>
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-black/5 border border-black/10 p-4 max-w-[80%] rounded-none">
                    <div className="flex items-center space-x-3">
                      <Activity className="h-4 w-4 animate-spin" />
                      <p className="text-xs font-mono uppercase tracking-widest">Processing Data...</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-black/10 bg-black/[0.02]">
              <div className="flex space-x-2">
                <Input 
                  placeholder="QUERY AI ASSISTANT..." 
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && !isLoading && sendMessage()}
                  disabled={isLoading}
                  className="rounded-none border-black/20 focus:border-black font-mono text-sm uppercase placeholder:text-black/55 h-12"
                />
                <Button 
                  onClick={sendMessage} 
                  className="bg-black hover:bg-black/80 text-white rounded-none w-16 h-12" 
                  disabled={isLoading}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Patient Data Analysis */}
      <div className="border border-black/10 bg-white">
        <div className="p-6 border-b border-black/10 bg-black/[0.02]">
          <h2 className="text-xl font-bold uppercase flex items-center gap-2">
            <Stethoscope className="h-5 w-5" />
            <span>Deep Data Analysis</span>
          </h2>
          <p className="text-xs font-mono text-black/60 uppercase mt-1">Upload unstructured patient data for comprehensive AI insights</p>
        </div>
        <div className="p-6">
          <Textarea
            placeholder="ENTER PATIENT SYMPTOMS, LAB RESULTS, IMAGING FINDINGS, OR CLINICAL NOTES..."
            value={patientData}
            onChange={(e) => setPatientData(e.target.value)}
            className="min-h-[150px] mb-4 rounded-none border-black/20 focus:border-black font-mono text-sm uppercase placeholder:text-black/55 resize-none p-4"
            disabled={isLoading}
          />
          <Button 
            onClick={analyzePatientData} 
            className="bg-black hover:bg-black/80 text-white rounded-none font-mono uppercase text-xs h-12 px-8 flex items-center" 
            disabled={isLoading}
          >
            <Brain className="h-4 w-4 mr-2" />
            {isLoading ? "PROCESSING..." : "RUN ANALYSIS"}
          </Button>
        </div>
      </div>
    </div>
  )
} 
