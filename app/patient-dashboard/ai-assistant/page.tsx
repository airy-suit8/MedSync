"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Activity, Brain, Send, AlertTriangle, AlertCircle } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { callGeminiAPI, PATIENT_PROMPT_CONTEXT } from "@/lib/gemini"


export default function PatientAIAssistantPage() {
  const [user, setUser] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [loading, setLoading] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const checkUser = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user || user.app_metadata?.role !== "patient") {
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
        isPatient: true
      }
      setMessages([...messages, userMessage])
      
      const currentMessage = newMessage
      setNewMessage("")
      setIsLoading(true)
      
      try {
        const response = await callGeminiAPI(currentMessage, PATIENT_PROMPT_CONTEXT)
        
        if (!response.success) {
          throw new Error(response.error || 'API failed')
        }
        
        const aiResponse = {
          id: Date.now() + 1,
          text: response.message,
          sender: "AI Health Assistant",
          timestamp: new Date().toISOString(),
          isPatient: false
        }
        setMessages(prev => [...prev, aiResponse])
      } catch (error) {
        const errorResponse = {
          id: Date.now() + 1,
          text: "I'm sorry, I'm having trouble connecting to my knowledge base right now. Please try again later or consult your doctor for immediate assistance.",
          sender: "AI Health Assistant",
          timestamp: new Date().toISOString(),
          isPatient: false
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
          <span className="text-xs font-mono uppercase tracking-widest text-black/60">System Initializing...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-transparent p-6 lg:p-12 max-w-7xl mx-auto">
      {/* Header */}
      <header className="border-b border-black/10 pb-8 mb-12 flex items-end justify-between">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight uppercase mb-2">AI Health Assistant</h1>
          <p className="text-black/60 font-light text-lg italic">
            Get instant guidance on medicines, side effects, and wellness
          </p>
        </div>
      </header>

      <div className="grid md:grid-cols-4 gap-12">
        {/* Left Panel: Information */}
        <div className="md:col-span-1 space-y-8">
          <div className="border border-black/10 bg-white p-8 relative overflow-hidden">
            <div className="absolute left-0 top-0 h-full w-0.5 bg-amber-600"></div>
            <h2 className="text-xl font-black uppercase mb-8 flex items-center gap-2 tracking-tight">
              <Brain className="h-5 w-5" />
              <span>Intelligence</span>
            </h2>
            <div className="space-y-4">
              {[
                { title: 'Side Effects', desc: 'Risks & interactions' },
                { title: 'Dosage Timing', desc: 'Optimal schedules' },
                { title: 'Alternatives', desc: 'Generic options' },
                { title: 'Storage Tips', desc: 'Proper preservation' }
              ].map((item, i) => (
                <div key={i} className="p-4 bg-black/[0.02] border border-black/5 hover:border-black/20 transition-colors">
                  <h4 className="font-bold text-xs uppercase mb-1 tracking-wide">{item.title}</h4>
                  <p className="text-[10px] font-mono text-black/60 uppercase">{item.desc}</p>
                </div>
              ))}
            </div>
            
            {/* Disclaimer */}
            <div className="mt-8 p-6 bg-red-50 border border-red-500/20 relative overflow-hidden">
              <div className="absolute bottom-0 left-0 w-full h-0.5 bg-red-600"></div>
              <div className="flex items-center space-x-2 mb-3">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <span className="text-[10px] font-black uppercase tracking-widest text-red-600">Clinical Notice</span>
              </div>
              <p className="text-[10px] font-mono text-red-600/80 uppercase leading-relaxed">
                Assistant provides data only. Not a substitute for professional medical advice. Consult your doctor for diagnosis. In an emergency call 112. Messages are sent to Google Gemini; do not include names or other identifying details.
              </p>
            </div>
          </div>
        </div>

        {/* Right Panel: Chat Interface */}
        <div className="md:col-span-3">
          <div className="border border-black/10 bg-white flex flex-col h-[650px] relative">
            <div className="absolute top-0 left-0 w-full h-0.5 bg-indigo-600"></div>
            
            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-8 space-y-6 scrollbar-thin">
              <div className="flex justify-start">
                <div className="bg-black/5 border border-black/10 p-6 max-w-[80%]">
                  <p className="text-sm font-mono leading-relaxed">
                    <strong>SYSTEM:</strong> Hello. I am your AI Health Assistant. I can provide data on medication timing, side effects, and cost-effective alternatives. How may I assist your health goals today?
                  </p>
                  <p className="text-[10px] font-mono text-black/55 uppercase mt-4">INITIALIZING SYNC...</p>
                </div>
              </div>

              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.isPatient ? 'justify-end' : 'justify-start'}`}>
                  <div className={`p-6 max-w-[80%] ${message.isPatient ? 'bg-black text-white' : 'bg-black/5 border border-black/10'}`}>
                    <p className="text-sm font-mono leading-relaxed">
                      <strong>{message.sender.toUpperCase()}:</strong> {message.text}
                    </p>
                    <p className={`text-[10px] font-mono uppercase mt-4 ${message.isPatient ? 'text-white/50' : 'text-black/55'}`}>
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-black/5 border border-black/10 p-6 flex items-center space-x-4">
                    <Activity className="h-4 w-4 text-indigo-600 animate-spin" />
                    <span className="text-[10px] font-mono uppercase tracking-widest text-indigo-600 font-bold">Inference in progress...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Input Area */}
            <div className="border-t border-black/10 p-6 bg-black/[0.02]">
              <div className="flex space-x-4">
                <Input 
                  placeholder="QUERY HEALTH DATABASE..." 
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && !isLoading && sendMessage()}
                  disabled={isLoading}
                  className="flex-1 bg-white border-black/20 focus:border-black rounded-none h-14 font-mono text-sm uppercase px-6"
                />
                <Button 
                  onClick={sendMessage} 
                  disabled={isLoading || !newMessage.trim()}
                  className="bg-black hover:bg-black/80 text-white rounded-none px-8 h-14 group"
                >
                  <Send className="h-5 w-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 
