"use client"

import { useEffect, useState, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Activity, Users, MessageSquare, Send, ArrowLeft, Stethoscope, FlaskConical, User, Clock, Check, CheckCheck, Brain, AlertTriangle, Lightbulb, Eye, EyeOff } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"

interface Message {
  id: string
  content: string
  sender_id: string
  sender_name: string
  sender_role: string
  receiver_id: string
  receiver_name: string
  receiver_role: string
  created_at: string
  is_read?: boolean
}

interface Contact {
  id: string
  name: string
  role: string
  specialty?: string
  online: boolean
  last_message?: string
  last_message_time?: string
  unread_count?: number
}

interface MLSuggestion {
  id: string
  patient_id: string
  test_type: string
  findings: string
  confidence: number
  recommendations: string
  severity: string
  processed_at: string
  status: string
  doctor_notes?: string
}

export default function DoctorCommunicationPage() {
  const [user, setUser] = useState<any>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [patients, setPatients] = useState<Contact[]>([])
  const [labTechs, setLabTechs] = useState<Contact[]>([])
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [activeTab, setActiveTab] = useState("patients")
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set())
  const [mlSuggestions, setMlSuggestions] = useState<MLSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(true)
  const [selectedSuggestion, setSelectedSuggestion] = useState<MLSuggestion | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const supabase = createClient()

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push("/login")
        return
      }

      if (user.user_metadata?.role !== "doctor") {
        router.push("/login")
        return
      }

      setUser(user)
      
      // Get or create user record
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', user.id)
        .single()

      if (userError) {
        console.log('Creating new user record...')
        const { data: newUser, error: createError } = await supabase
          .from('users')
          .insert({
            auth_id: user.id,
            name: user.user_metadata?.name || 'Doctor',
            email: user.email || '',
            role: 'doctor'
          })
          .select('id')
          .single()

        if (createError) {
          console.error('Error creating user record:', createError)
        } else {
          setCurrentUserId(newUser.id)
          // Set user as online
          await supabase
            .from('users')
            .update({ online: true })
            .eq('id', newUser.id)
        }
      } else {
        setCurrentUserId(userData.id)
        // Set user as online
        await supabase
          .from('users')
          .update({ online: true })
          .eq('id', userData.id)
      }
      
      setLoading(false)
    }

    checkUser()
  }, [router])

  useEffect(() => {
    if (currentUserId) {
      loadContacts()
      loadMLSuggestions()
      setupRealtimeSubscriptions()
    }
  }, [currentUserId])

  useEffect(() => {
    if (selectedContact && currentUserId) {
      loadMessages()
      markMessagesAsRead()
    }
  }, [selectedContact, currentUserId])

  // Handle URL parameters for pre-selecting patient
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const patientId = urlParams.get('patient')
    
    if (patientId && patients.length > 0) {
      const patient = patients.find(p => p.id === patientId || p.name?.includes(patientId))
      if (patient) {
        setSelectedContact(patient)
        setActiveTab('patients')
      }
    }
  }, [patients])

  const loadMLSuggestions = async () => {
    try {
      const { data, error } = await supabase
        .from('ml_suggestions')
        .select('*')
        .eq('status', 'pending_review')
        .order('processed_at', { ascending: false })

      if (error) {
        console.error('Error loading ML suggestions:', error)
      } else {
        setMlSuggestions(data || [])
      }
    } catch (error) {
      console.error('Error loading ML suggestions:', error)
    }
  }

  const setupRealtimeSubscriptions = () => {
    // Subscribe to user online status changes
    const userStatusSubscription = supabase
      .channel('user_status')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'users',
        filter: `role.in.(patient,lab)`
      }, (payload) => {
        if (payload.eventType === 'UPDATE') {
          const updatedUser = payload.new as any
          setOnlineUsers(prev => {
            const newSet = new Set(prev)
            if (updatedUser.online) {
              newSet.add(updatedUser.id)
            } else {
              newSet.delete(updatedUser.id)
            }
            return newSet
          })
        }
      })
      .subscribe()

    // Subscribe to new messages
    const messageSubscription = supabase
      .channel('all_messages')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages'
      }, (payload) => {
        const newMessage = payload.new as Message
        if (newMessage.receiver_id === currentUserId || newMessage.sender_id === currentUserId) {
          setMessages(prev => {
            // Check if message already exists
            if (!prev.find(m => m.id === newMessage.id)) {
              return [...prev, newMessage]
            }
            return prev
          })
        }
      })
      .subscribe()

    // Subscribe to new ML suggestions
    const mlSuggestionSubscription = supabase
      .channel('ml_suggestions')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'ml_suggestions'
      }, (payload) => {
        const newSuggestion = payload.new as MLSuggestion
        setMlSuggestions(prev => [newSuggestion, ...prev])
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'ml_suggestions'
      }, (payload) => {
        const updatedSuggestion = payload.new as MLSuggestion
        setMlSuggestions(prev => 
          prev.map(s => s.id === updatedSuggestion.id ? updatedSuggestion : s)
        )
      })
      .subscribe()

    return () => {
      userStatusSubscription.unsubscribe()
      messageSubscription.unsubscribe()
      mlSuggestionSubscription.unsubscribe()
    }
  }

  const loadContacts = async () => {
    try {
      const { data: usersData, error } = await supabase
        .from('users')
        .select('id, name, role, specialty, online')
        .in('role', ['patient', 'lab'])
        .order('online', { ascending: false })

      if (error) {
        console.warn('Users table query failed, using fallback data:', error)
        const fallbackPatients = [
          { id: '66666666-6666-6666-6666-666666666666', name: 'John Patient', role: 'patient', specialty: 'General', online: true },
          { id: '77777777-7777-7777-7777-777777777777', name: 'Mary Wilson', role: 'patient', specialty: 'General', online: false }
        ]
        const fallbackLabTechs = [
          { id: '44444444-4444-4444-4444-444444444444', name: 'Lab Tech Alex Chen', role: 'lab', specialty: 'Clinical Laboratory', online: true },
          { id: '55555555-5555-5555-5555-555555555555', name: 'Lab Tech Maria Garcia', role: 'lab', specialty: 'Radiology', online: true }
        ]
        
        setPatients(fallbackPatients)
        setLabTechs(fallbackLabTechs)
        
        if (fallbackPatients.length > 0) {
          setSelectedContact(fallbackPatients[0])
        }
        return
      }

      const usersList = usersData || []
      
      setPatients(usersList.filter((u: any) => u.role === 'patient'))
      setLabTechs(usersList.filter((u: any) => u.role === 'lab'))
      
      // Update online users set
      const onlineUserIds = new Set(usersList.filter((u: any) => u.online).map((u: any) => u.id))
      setOnlineUsers(onlineUserIds)
      
      if (usersList.filter((u: any) => u.role === 'patient').length > 0) {
        setSelectedContact(usersList.filter((u: any) => u.role === 'patient')[0])
      }
    } catch (error) {
      console.error('Error loading contacts:', error)
      setPatients([])
      setLabTechs([])
    }
  }

  const getActiveContacts = () => {
    switch (activeTab) {
      case 'patients': return patients
      case 'labs': return labTechs
      default: return patients
    }
  }

  const loadMessages = async () => {
    if (!selectedContact || !currentUserId) return

    try {
      const { data: messagesData, error } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${selectedContact.id}),and(sender_id.eq.${selectedContact.id},receiver_id.eq.${currentUserId})`)
        .order('created_at', { ascending: true })

      if (error) {
        console.error('Error loading messages:', error)
        const fallbackMessages = [
          {
            id: '1',
            content: 'Hello Doctor! I have a question about my treatment.',
            sender_id: selectedContact.id,
            sender_name: selectedContact.name,
            sender_role: selectedContact.role,
            receiver_id: currentUserId,
            receiver_name: user?.user_metadata?.name || 'Doctor',
            receiver_role: 'doctor',
            created_at: new Date().toISOString()
          }
        ]
        setMessages(fallbackMessages)
        return
      }

      setMessages(messagesData || [])
    } catch (error) {
      console.error('Error loading messages:', error)
      setMessages([])
    }
  }

  const markMessagesAsRead = async () => {
    if (!selectedContact || !currentUserId) return

    try {
      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('sender_id', selectedContact.id)
        .eq('receiver_id', currentUserId)
        .eq('is_read', false)
    } catch (error) {
      console.error('Error marking messages as read:', error)
    }
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedContact || !currentUserId || sending) return

    setSending(true)
    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          content: newMessage.trim(),
          sender_id: currentUserId,
          sender_name: user?.user_metadata?.name || 'Doctor',
          sender_role: 'doctor',
          receiver_id: selectedContact.id,
          receiver_name: selectedContact.name,
          receiver_role: selectedContact.role
        })

      if (error) {
        console.error('Error sending message:', error)
        const localMessage: Message = {
          id: Date.now().toString(),
          content: newMessage.trim(),
          sender_id: currentUserId,
          sender_name: user?.user_metadata?.name || 'Doctor',
          sender_role: 'doctor',
          receiver_id: selectedContact.id,
          receiver_name: selectedContact.name,
          receiver_role: selectedContact.role,
          created_at: new Date().toISOString()
        }
        setMessages(prev => [...prev, localMessage])
      } else {
        setNewMessage("")
      }
    } catch (error) {
      console.error('Error sending message:', error)
    } finally {
      setSending(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const handleTabChange = (value: string) => {
    setActiveTab(value)
    const contacts = getActiveContacts()
    if (contacts.length > 0) {
      setSelectedContact(contacts[0])
    }
  }

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const getUnreadCount = (contactId: string) => {
    return messages.filter(m => 
      m.sender_id === contactId && 
      m.receiver_id === currentUserId && 
      !m.is_read
    ).length
  }

  const handleSuggestionAction = async (suggestion: MLSuggestion, action: 'accept' | 'reject' | 'review') => {
    try {
      const { error } = await supabase
        .from('ml_suggestions')
        .update({
          status: action === 'accept' ? 'accepted' : action === 'reject' ? 'rejected' : 'reviewed',
          reviewed_by: currentUserId,
          reviewed_at: new Date().toISOString(),
          doctor_notes: action === 'review' ? 'Reviewed by doctor' : undefined
        })
        .eq('id', suggestion.id)

      if (error) {
        console.error('Error updating suggestion:', error)
      } else {
        // Remove from pending suggestions
        setMlSuggestions(prev => prev.filter(s => s.id !== suggestion.id))
        setSelectedSuggestion(null)
      }
    } catch (error) {
      console.error('Error handling suggestion:', error)
    }
  }

  const useSuggestionInChat = (suggestion: MLSuggestion) => {
    const suggestionText = `AI Analysis for Patient ${suggestion.patient_id} (${suggestion.test_type}):
Findings: ${suggestion.findings}
Confidence: ${(suggestion.confidence * 100).toFixed(1)}%
Recommendations: ${suggestion.recommendations}
Severity: ${suggestion.severity}`
    
    setNewMessage(suggestionText)
    setSelectedSuggestion(null)
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800'
      case 'severe': return 'bg-orange-100 text-orange-800'
      case 'moderate': return 'bg-yellow-100 text-yellow-800'
      case 'mild': return 'bg-blue-100 text-blue-800'
      default: return 'bg-green-100 text-green-800'
    }
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertTriangle className="h-4 w-4" />
      case 'severe': return <AlertTriangle className="h-4 w-4" />
      case 'moderate': return <AlertTriangle className="h-4 w-4" />
      case 'mild': return <Lightbulb className="h-4 w-4" />
      default: return <Check className="h-4 w-4" />
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center">
        <div className="text-center">
          <Activity className="h-8 w-8 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading your chat...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Image src="/medi.png" alt="MedSync Logo" width={32} height={32} />
            <span className="text-2xl font-bold text-gray-900">MedSync</span>
            <Badge className="bg-blue-100 text-blue-800">Doctor Portal</Badge>
          </div>
          <div className="flex items-center space-x-4">
            <Button
              onClick={() => setShowSuggestions(!showSuggestions)}
              variant="outline"
              className="bg-white text-blue-600 border-blue-200 hover:bg-blue-50"
            >
              {showSuggestions ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
              {showSuggestions ? 'Hide' : 'Show'} AI Suggestions
            </Button>
            <Link href="/doctor-dashboard">
              <Button variant="outline" className="bg-white text-blue-600 border-blue-200 hover:bg-blue-50">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className={`grid gap-6 h-[calc(100vh-200px)] ${showSuggestions ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}`}>
          {/* Contacts Sidebar */}
          <div className="lg:col-span-1">
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="h-5 w-5 mr-2" />
                  Patients & Labs
                </CardTitle>
                <CardDescription>Connect with patients and lab technicians</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="patients" className="flex items-center">
                      <User className="h-4 w-4 mr-2" />
                      Patients
                    </TabsTrigger>
                    <TabsTrigger value="labs" className="flex items-center">
                      <FlaskConical className="h-4 w-4 mr-2" />
                      Labs
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="patients" className="mt-4">
                    <div className="space-y-2">
                      {patients.map((patient) => (
                        <div
                          key={patient.id}
                          onClick={() => setSelectedContact(patient)}
                          className={`p-3 rounded-lg cursor-pointer transition-colors ${
                            selectedContact?.id === patient.id
                              ? 'bg-blue-100 border-blue-300'
                              : 'bg-gray-50 hover:bg-gray-100'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <div className="relative">
                                <User className="h-8 w-8 text-blue-600" />
                                {onlineUsers.has(patient.id) && (
                                  <div className="absolute -bottom-1 -right-1 h-3 w-3 bg-green-500 rounded-full border-2 border-white"></div>
                                )}
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">{patient.name}</p>
                                <p className="text-sm text-gray-600">{patient.specialty || 'Patient'}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              {getUnreadCount(patient.id) > 0 && (
                                <Badge className="bg-red-500 text-white text-xs">
                                  {getUnreadCount(patient.id)}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </TabsContent>

                  <TabsContent value="labs" className="mt-4">
                    <div className="space-y-2">
                      {labTechs.map((lab) => (
                        <div
                          key={lab.id}
                          onClick={() => setSelectedContact(lab)}
                          className={`p-3 rounded-lg cursor-pointer transition-colors ${
                            selectedContact?.id === lab.id
                              ? 'bg-blue-100 border-blue-300'
                              : 'bg-gray-50 hover:bg-gray-100'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <div className="relative">
                                <FlaskConical className="h-8 w-8 text-purple-600" />
                                {onlineUsers.has(lab.id) && (
                                  <div className="absolute -bottom-1 -right-1 h-3 w-3 bg-green-500 rounded-full border-2 border-white"></div>
                                )}
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">{lab.name}</p>
                                <p className="text-sm text-gray-600">{lab.specialty}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              {getUnreadCount(lab.id) > 0 && (
                                <Badge className="bg-red-500 text-white text-xs">
                                  {getUnreadCount(lab.id)}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          {/* Chat Area */}
          <div className={`${showSuggestions ? 'lg:col-span-3' : 'lg:col-span-3'}`}>
            <Card className="h-full flex flex-col">
              {selectedContact ? (
                <>
                  <CardHeader className="border-b">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="relative">
                          {selectedContact.role === 'patient' ? (
                            <User className="h-8 w-8 text-blue-600" />
                          ) : (
                            <FlaskConical className="h-8 w-8 text-purple-600" />
                          )}
                          {onlineUsers.has(selectedContact.id) && (
                            <div className="absolute -bottom-1 -right-1 h-3 w-3 bg-green-500 rounded-full border-2 border-white"></div>
                          )}
                        </div>
                        <div>
                          <CardTitle className="text-lg">{selectedContact.name}</CardTitle>
                          <CardDescription>
                            {selectedContact.role === 'patient' ? 'Patient' : 'Lab Technician'} • {selectedContact.specialty}
                            {onlineUsers.has(selectedContact.id) && (
                              <span className="text-green-600 ml-2">• Online</span>
                            )}
                          </CardDescription>
                        </div>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="flex-1 flex flex-col p-0">
                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                      {messages.map((message) => (
                        <div
                          key={message.id}
                          className={`flex ${message.sender_id === currentUserId ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`p-3 rounded-lg max-w-xs lg:max-w-md ${
                              message.sender_id === currentUserId
                                ? 'bg-blue-100 text-gray-900'
                                : 'bg-gray-100 text-gray-900'
                            }`}
                          >
                            <p className="text-sm">{message.content}</p>
                            <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                              <span>{formatTime(message.created_at)}</span>
                              {message.sender_id === currentUserId && (
                                <div className="flex items-center">
                                  {message.is_read ? (
                                    <CheckCheck className="h-3 w-3 text-blue-500" />
                                  ) : (
                                    <Check className="h-3 w-3 text-gray-400" />
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>

                    {/* Message Input */}
                    <div className="border-t p-4">
                      <div className="flex space-x-2">
                        <Input
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          onKeyPress={handleKeyPress}
                          placeholder="Type your message..."
                          className="flex-1"
                          disabled={sending}
                        />
                        <Button
                          onClick={sendMessage}
                          disabled={!newMessage.trim() || sending}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          {sending ? (
                            <Activity className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </>
              ) : (
                <CardContent className="flex-1 flex items-center justify-center">
                  <div className="text-center text-gray-500">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>Select a contact to start chatting</p>
                  </div>
                </CardContent>
              )}
            </Card>
          </div>

          {/* ML Suggestions Panel */}
          {showSuggestions && (
            <div className="lg:col-span-1">
              <Card className="h-full">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Brain className="h-5 w-5 mr-2 text-purple-600" />
                    AI Suggestions
                    {mlSuggestions.length > 0 && (
                      <Badge className="ml-2 bg-purple-100 text-purple-800">
                        {mlSuggestions.length}
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription>ML analysis from lab uploads</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {mlSuggestions.length === 0 ? (
                      <div className="text-center text-gray-500 py-8">
                        <Brain className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                        <p className="text-sm">No pending AI suggestions</p>
                      </div>
                    ) : (
                      mlSuggestions.map((suggestion) => (
                        <div
                          key={suggestion.id}
                          className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                            selectedSuggestion?.id === suggestion.id
                              ? 'bg-purple-50 border-purple-300'
                              : 'bg-gray-50 hover:bg-gray-100'
                          }`}
                          onClick={() => setSelectedSuggestion(suggestion)}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center space-x-2">
                              {getSeverityIcon(suggestion.severity)}
                              <Badge className={getSeverityColor(suggestion.severity)}>
                                {suggestion.severity}
                              </Badge>
                            </div>
                            <span className="text-xs text-gray-500">
                              {new Date(suggestion.processed_at).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-sm font-medium text-gray-900">
                            Patient {suggestion.patient_id || 'Unknown'}
                          </p>
                          <p className="text-xs text-gray-600 mb-2">
                            {(suggestion.test_type || 'Unknown Test').replace('_', ' ').toUpperCase()}
                          </p>
                          <p className="text-xs text-gray-700 line-clamp-2">
                            {suggestion.findings || 'No findings available'}
                          </p>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-gray-500">
                              {((suggestion.confidence || 0) * 100).toFixed(0)}% confidence
                            </span>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs"
                              onClick={(e) => {
                                e.stopPropagation()
                                useSuggestionInChat(suggestion)
                              }}
                            >
                              Use
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* ML Suggestion Detail Modal */}
        {selectedSuggestion && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center">
                  <Brain className="h-5 w-5 mr-2 text-purple-600" />
                  AI Analysis Details
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedSuggestion(null)}
                >
                  ×
                </Button>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Patient ID</label>
                    <p className="text-sm text-gray-900">{selectedSuggestion.patient_id || 'Unknown'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Test Type</label>
                    <p className="text-sm text-gray-900">{(selectedSuggestion.test_type || 'Unknown Test').replace('_', ' ').toUpperCase()}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Severity</label>
                    <Badge className={getSeverityColor(selectedSuggestion.severity || 'unknown')}>
                      {selectedSuggestion.severity || 'Unknown'}
                    </Badge>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Confidence</label>
                    <p className="text-sm text-gray-900">{((selectedSuggestion.confidence || 0) * 100).toFixed(1)}%</p>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Findings</label>
                  <p className="text-sm text-gray-900 mt-1 p-3 bg-gray-50 rounded-lg">
                    {selectedSuggestion.findings || 'No findings available'}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Recommendations</label>
                  <p className="text-sm text-gray-900 mt-1 p-3 bg-blue-50 rounded-lg">
                    {selectedSuggestion.recommendations || 'No recommendations available'}
                  </p>
                </div>

                <div className="flex space-x-2 pt-4">
                  <Button
                    onClick={() => useSuggestionInChat(selectedSuggestion)}
                    className="flex-1 bg-purple-600 hover:bg-purple-700"
                  >
                    Use in Chat
                  </Button>
                  <Button
                    onClick={() => handleSuggestionAction(selectedSuggestion, 'accept')}
                    variant="outline"
                    className="flex-1 bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                  >
                    Accept
                  </Button>
                  <Button
                    onClick={() => handleSuggestionAction(selectedSuggestion, 'reject')}
                    variant="outline"
                    className="flex-1 bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                  >
                    Reject
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 