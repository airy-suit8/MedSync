"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Activity, Brain, Send, ArrowLeft, AlertTriangle } from "lucide-react"
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
      
      if (!user || user.user_metadata?.role !== "patient") {
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
        // Call Gemini API with patient context (limited scope)
        const response = await callGeminiAPI(currentMessage, PATIENT_PROMPT_CONTEXT)
        
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
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-white flex items-center justify-center">
        <div className="text-center">
          <Activity className="h-8 w-8 text-green-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading AI Health Assistant...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/patient-dashboard" className="flex items-center space-x-2 text-green-600 hover:text-green-700">
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Dashboard</span>
            </Link>
          </div>
          <div className="flex items-center space-x-2">
            <Image src="/medi.png" alt="MedSync Logo" width={32} height={32} />
            <span className="text-2xl font-bold text-gray-900">MedSync</span>
            <Badge className="bg-green-100 text-green-800">Patient Portal</Badge>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">AI Health Assistant</h1>
          <p className="text-gray-600">Powered by Gemini AI - Get information about medicines, side effects, and health guidance</p>
        </div>

        <div className="grid md:grid-cols-4 gap-6">
          {/* AI Info Panel */}
          <div className="md:col-span-1">
            <Card className="border-green-100">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Brain className="h-5 w-5 text-green-600" />
                  <span>What I can help with</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <h4 className="font-semibold text-sm text-blue-900">Medicine Side Effects</h4>
                    <p className="text-xs text-blue-800">Common side effects and interactions</p>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg">
                    <h4 className="font-semibold text-sm text-green-900">Dosage Timing</h4>
                    <p className="text-xs text-green-800">When and how to take medicines</p>
                  </div>
                  <div className="p-3 bg-purple-50 rounded-lg">
                    <h4 className="font-semibold text-sm text-purple-900">Generic Alternatives</h4>
                    <p className="text-xs text-purple-800">Cost-effective alternatives</p>
                  </div>
                  <div className="p-3 bg-orange-50 rounded-lg">
                    <h4 className="font-semibold text-sm text-orange-900">Storage Tips</h4>
                    <p className="text-xs text-orange-800">How to store medicines properly</p>
                  </div>
                </div>
                
                <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                  <div className="flex items-center space-x-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    <span className="text-sm font-semibold text-yellow-800">Important Notice</span>
                  </div>
                  <p className="text-xs text-yellow-800">
                    This AI assistant can only provide basic medicine information. For medical advice, diagnoses, or treatment recommendations, please consult your doctor.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Chat Interface */}
          <div className="md:col-span-3">
            <Card className="border-green-100 h-96">
              <CardHeader>
                <CardTitle>AI Health Assistant</CardTitle>
                <CardDescription>Ask about medicine side effects, timing, alternatives...</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 bg-gray-50 rounded-lg p-4 overflow-y-auto mb-4">
                  <div className="space-y-3">
                    <div className="bg-blue-100 p-3 rounded-lg max-w-xs">
                      <p className="text-sm"><strong>AI Health Assistant:</strong> Hello! I'm powered by Gemini AI and can help with medicine information, side effects, timing, and alternatives. I cannot provide diagnoses or medical advice - please consult your doctor for those. What would you like to know?</p>
                      <p className="text-xs text-gray-600 mt-1">Just now</p>
                    </div>
                    {messages.map((message) => (
                      <div key={message.id} className={`p-3 rounded-lg max-w-xs ${message.isPatient ? 'bg-gray-100 ml-auto' : 'bg-blue-100'}`}>
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
                    placeholder="Ask about medicine side effects, timing, alternatives..." 
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && !isLoading && sendMessage()}
                    disabled={isLoading}
                  />
                  <Button onClick={sendMessage} className="bg-green-600 hover:bg-green-700" disabled={isLoading}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
} 