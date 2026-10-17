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
import { pressable } from "@/lib/utils"

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
  const [canScrollUp, setCanScrollUp] = useState(false)
  const [canScrollDown, setCanScrollDown] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const supabase = createClient()

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    const container = messagesContainerRef.current
    if (container) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: "smooth"
      })
    }
  }

  // Enhanced scroll to bottom with better positioning
  const scrollToBottomEnhanced = () => {
    if (messagesEndRef.current) {
      const messagesContainer = messagesEndRef.current.parentElement
      if (messagesContainer) {
        messagesContainer.scrollTo({
          top: messagesContainer.scrollHeight,
          behavior: 'smooth'
        })
      }
    }
  }

  // Handle scroll to top for new messages
  const scrollToTop = () => {
    const messagesContainer = messagesEndRef.current?.parentElement
    if (messagesContainer) {
      messagesContainer.scrollTo({
        top: 0,
        behavior: 'smooth'
      })
    }
  }

  // Check scroll position to show/hide scroll buttons
  const checkScrollPosition = () => {
    const container = messagesContainerRef.current
    if (container) {
      const { scrollTop, scrollHeight, clientHeight } = container
      setCanScrollUp(scrollTop > 0)
      setCanScrollDown(scrollTop + clientHeight < scrollHeight - 10) // 10px threshold
    }
  }

  useEffect(() => {
    scrollToBottom()
    // Check scroll position after messages update
    setTimeout(checkScrollPosition, 100)
  }, [messages])

  // Add scroll event listener to check scroll position
  useEffect(() => {
    const container = messagesContainerRef.current
    if (container) {
      container.addEventListener('scroll', checkScrollPosition)
      // Initial check
      checkScrollPosition()

      return () => {
        container.removeEventListener('scroll', checkScrollPosition)
      }
    }
  }, [])

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push("/login")
        return
      }

      if (user.app_metadata?.role !== "doctor") {
        router.push("/login")
        return
      }

      setUser(user)

      // The profile row is created at signup
      setCurrentUserId(user.id)
      // Set user as online
      await supabase
        .from('profiles')
        .update({ online: true })
        .eq('id', user.id)

      setLoading(false)
    }

    checkUser()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  useEffect(() => {
    if (currentUserId) {
      loadContacts()
      loadMLSuggestions()
      setupRealtimeSubscriptions()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId])

  useEffect(() => {
    if (selectedContact && currentUserId) {
      loadMessages()
      markMessagesAsRead()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        table: 'profiles',
        filter: `role.in.(patient,lab)`
      }, (payload: any) => {
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
      }, (payload: any) => {
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
      }, (payload: any) => {
        const newSuggestion = payload.new as MLSuggestion
        setMlSuggestions(prev => [newSuggestion, ...prev])
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'ml_suggestions'
      }, (payload: any) => {
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
        .from('profile_directory')
        .select('id, name, role, specialty, online')
        .in('role', ['patient', 'lab'])
        .order('online', { ascending: false })

      if (error) {
        // No made-up contacts: an empty list is honest; messages to fake IDs went nowhere.
        console.warn('Could not load contacts:', error)
        setPatients([])
        setLabTechs([])
        return
      }

      const usersList = usersData || []

      setPatients(usersList.filter((u: any) => u.role === 'patient'))
      setLabTechs(usersList.filter((u: any) => u.role === 'lab'))

      // Update online users set
      const onlineUserIds = new Set<string>(usersList.filter((u: any) => u.online).map((u: any) => u.id))
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
      // Receivers can't update messages directly (RLS is sender-only); this only sets is_read.
      await supabase.rpc('mark_messages_read', { p_sender_id: selectedContact.id })
    } catch (error) {
      console.error('Error marking messages as read:', error)
    }
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedContact || !currentUserId || sending) return

    const messageContent = newMessage.trim()
    setNewMessage("") // Clear input immediately for better UX

    // Create local message immediately for real-time display
    const localMessage: Message = {
      id: `local-${Date.now()}`,
      content: messageContent,
      sender_id: currentUserId,
      sender_name: user?.user_metadata?.name || 'Doctor',
      sender_role: 'doctor',
      receiver_id: selectedContact.id,
      receiver_name: selectedContact.name,
      receiver_role: selectedContact.role,
      created_at: new Date().toISOString()
    }

    // Add message to local state immediately
    setMessages(prev => [...prev, localMessage])

    setSending(true)
    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          content: messageContent,
          sender_id: currentUserId,
          sender_name: user?.user_metadata?.name || 'Doctor',
          sender_role: 'doctor',
          receiver_id: selectedContact.id,
          receiver_name: selectedContact.name,
          receiver_role: selectedContact.role
        })
        .select()
        .single()

      if (error) {
        console.error('Error sending message:', error)
        // Keep the local message but mark it as failed
        setMessages(prev =>
          prev.map(msg =>
            msg.id === localMessage.id
              ? { ...msg, id: `failed-${Date.now()}` }
              : msg
          )
        )
      } else if (data) {
        // Replace local message with server message
        setMessages(prev =>
          prev.map(msg =>
            msg.id === localMessage.id ? data : msg
          )
        )
      }
    } catch (error) {
      console.error('Error sending message:', error)
      // Keep the local message but mark it as failed
      setMessages(prev =>
        prev.map(msg =>
          msg.id === localMessage.id
            ? { ...msg, id: `failed-${Date.now()}` }
            : msg
        )
      )
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

  const insertSuggestionIntoChat = (suggestion: MLSuggestion) => {
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
      <div className="min-h-screen flex items-center justify-center bg-transparent">
        <div className="flex flex-col items-center">
          <Activity className="h-8 w-8 animate-spin mb-4 text-black" />
          <span className="text-xs font-mono uppercase tracking-widest text-black/60">Loading Chat...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen lg:h-[100dvh] bg-white flex flex-col overflow-x-hidden lg:overflow-hidden max-w-[1600px] mx-auto shadow-2xl border-x border-black/5">
      <style jsx global>{`
        .scrollbar-thin::-webkit-scrollbar {
          width: 6px;
        }
        .scrollbar-thin::-webkit-scrollbar-track {
          background: transparent;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb {
          background: rgba(0,0,0,0.2);
        }
        .scrollbar-thin::-webkit-scrollbar-thumb:hover {
          background: rgba(0,0,0,0.4);
        }
        .scrollbar-thin {
          scrollbar-width: thin;
          scrollbar-color: rgba(0,0,0,0.2) transparent;
        }
        .scrollbar-thin {
          scrollbar-width: thin;
          scrollbar-color: rgba(0,0,0,0.2) transparent;
        }
      `}</style>

      <div className="flex-shrink-0 p-4 md:p-6 pb-0">
        {/* Header */}
        <header className="border-b border-black/10 pb-4 flex items-end justify-between">
          <div>
            <Link href="/doctor-dashboard" className="inline-flex items-center space-x-2 text-xs font-mono uppercase tracking-widest text-black/55 hover:text-black mb-4 transition-colors">
              <ArrowLeft className="h-3 w-3" />
              <span>Back to Dashboard</span>
            </Link>
            <div className="flex items-center gap-4">
              <h1 className="text-4xl font-bold tracking-tight uppercase">Communications</h1>
            </div>
          </div>
          <div className="text-right hidden md:flex items-center gap-4">
            <Button
              onClick={() => setShowSuggestions(!showSuggestions)}
              variant="outline"
              className="border-black rounded-none font-mono uppercase text-xs h-10"
            >
              {showSuggestions ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
              {showSuggestions ? 'Hide' : 'Show'} AI
            </Button>
            <div className="text-right">
              <span className="text-[10px] font-mono uppercase tracking-widest text-black/55 block mb-1">
                Portal Status
              </span>
              <span className="text-xl font-mono border-b border-black inline-flex items-center gap-2">
                <span className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></span>
                ACTIVE
              </span>
            </div>
          </div>
        </header>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden p-4 md:p-6 pt-2">
        <div className={`grid gap-4 md:gap-6 lg:h-full items-stretch ${showSuggestions ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}`}>
          {/* Contacts Sidebar */}
          <div className="lg:col-span-1 lg:h-full min-h-0">
            <div className="lg:h-full flex flex-col bg-white border border-black/10 overflow-hidden">
              <div className="flex-shrink-0 border-b border-black/10 p-6 bg-black/[0.02]">
                <h2 className="text-lg font-bold uppercase flex items-center">
                  <Users className="h-5 w-5 mr-2" />
                  Directory
                </h2>
                <p className="text-[10px] font-mono text-black/60 uppercase mt-1">Patients & Labs</p>
              </div>

              <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full h-full flex flex-col overflow-hidden">
                  <TabsList className="grid w-full grid-cols-2 flex-shrink-0 rounded-none bg-black/5 p-1 px-4 mt-4">
                    <TabsTrigger value="patients" className="rounded-none data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm font-mono uppercase text-[10px] font-bold">
                      <User className="h-3 w-3 mr-2" />
                      Patients
                    </TabsTrigger>
                    <TabsTrigger value="labs" className="rounded-none data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm font-mono uppercase text-[10px] font-bold">
                      <FlaskConical className="h-3 w-3 mr-2" />
                      Labs
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="patients" className="mt-4 flex-1 overflow-y-auto scrollbar-thin">
                    <div className="flex flex-col">
                      {patients.map((patient) => (
                        <div
                          key={patient.id}
                          {...pressable(() => setSelectedContact(patient))}
                          className={`p-4 border-b border-black/5 cursor-pointer transition-colors ${selectedContact?.id === patient.id
                            ? 'bg-black text-white'
                            : 'bg-white hover:bg-black/[0.02]'
                            }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="relative">
                                <div className={`w-8 h-8 flex items-center justify-center ${selectedContact?.id === patient.id ? 'bg-white text-black' : 'bg-black text-white'}`}>
                                  <User className="h-4 w-4" />
                                </div>
                                {onlineUsers.has(patient.id) && (
                                  <div className="absolute -bottom-1 -right-1 h-3 w-3 bg-green-500 rounded-full border-2 border-white"></div>
                                )}
                              </div>
                              <div>
                                <p className="font-bold text-sm uppercase">{patient.name}</p>
                                <p className={`text-[10px] font-mono uppercase ${selectedContact?.id === patient.id ? 'text-white/60' : 'text-black/60'}`}>
                                  {patient.specialty || 'Patient'}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              {getUnreadCount(patient.id) > 0 && (
                                <span className={`px-2 py-0.5 text-[10px] font-mono font-bold ${selectedContact?.id === patient.id ? 'bg-white text-black' : 'bg-black text-white'}`}>
                                  {getUnreadCount(patient.id)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </TabsContent>

                  <TabsContent value="labs" className="mt-4 flex-1 overflow-y-auto scrollbar-thin">
                    <div className="flex flex-col">
                      {labTechs.map((lab) => (
                        <div
                          key={lab.id}
                          {...pressable(() => setSelectedContact(lab))}
                          className={`p-4 border-b border-black/5 cursor-pointer transition-colors ${selectedContact?.id === lab.id
                            ? 'bg-black text-white'
                            : 'bg-white hover:bg-black/[0.02]'
                            }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="relative">
                                <div className={`w-8 h-8 flex items-center justify-center ${selectedContact?.id === lab.id ? 'bg-white text-black' : 'bg-black text-white'}`}>
                                  <FlaskConical className="h-4 w-4" />
                                </div>
                                {onlineUsers.has(lab.id) && (
                                  <div className="absolute -bottom-1 -right-1 h-3 w-3 bg-green-500 rounded-full border-2 border-white"></div>
                                )}
                              </div>
                              <div>
                                <p className="font-bold text-sm uppercase">{lab.name}</p>
                                <p className={`text-[10px] font-mono uppercase ${selectedContact?.id === lab.id ? 'text-white/60' : 'text-black/60'}`}>
                                  {lab.specialty}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              {getUnreadCount(lab.id) > 0 && (
                                <span className={`px-2 py-0.5 text-[10px] font-mono font-bold ${selectedContact?.id === lab.id ? 'bg-white text-black' : 'bg-black text-white'}`}>
                                  {getUnreadCount(lab.id)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </div>

          {/* Chat Area */}
          <div className={`${showSuggestions ? 'lg:col-span-3' : 'lg:col-span-3'} lg:h-full min-h-0`}>
            <div className="lg:h-full min-h-[520px] flex flex-col bg-white border border-black/10 overflow-hidden">
              {selectedContact ? (
                <>
                  <div className="border-b border-black/10 p-6 bg-black/[0.02] flex-shrink-0 flex items-center justify-between relative overflow-hidden">
                    <div className="absolute left-0 top-0 h-full w-0.5 bg-cyan-600"></div>
                    <div className="flex items-center space-x-4">
                      <div className="relative">
                        <div className="w-12 h-12 bg-black text-white flex items-center justify-center">
                          {selectedContact.role === 'patient' ? <User className="h-6 w-6" /> : <FlaskConical className="h-6 w-6" />}
                        </div>
                        {onlineUsers.has(selectedContact.id) && (
                          <div className="absolute -bottom-1 -right-1 h-3 w-3 bg-green-500 rounded-full border-2 border-white"></div>
                        )}
                      </div>
                      <div>
                        <h2 className="text-xl font-bold uppercase text-black">{selectedContact.name || 'Anonymous User'}</h2>
                        <p className="text-[10px] font-mono text-black/60 uppercase">
                          {selectedContact.role === 'patient' ? 'Patient' : 'Lab Technician'} • {selectedContact.specialty}
                          {onlineUsers.has(selectedContact.id) && (
                            <span className="text-green-600 font-bold ml-2">ONLINE</span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6 space-y-6 min-h-0 scrollbar-thin relative" ref={messagesContainerRef}>
                    {messages.length > 0 && canScrollUp && (
                      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-sm pb-2 mb-4 border-b border-black/10">
                        <div className="text-center">
                          <Button variant="ghost" size="sm" onClick={scrollToTop} className="font-mono text-[10px] uppercase rounded-none hover:bg-black/5">
                            ↑ Scroll to Top
                          </Button>
                        </div>
                      </div>
                    )}

                    {messages.map((message) => (
                      <div key={message.id} className={`flex ${message.sender_id === currentUserId ? 'justify-end' : 'justify-start'}`}>
                        <div className={`p-4 max-w-[80%] rounded-none ${message.sender_id === currentUserId ? 'bg-black text-white' : 'bg-black/5 border border-black/10'}`}>
                          <p className="text-sm font-mono leading-relaxed">{message.content}</p>
                          <div className="flex items-center justify-between mt-2 text-[10px] font-mono uppercase opacity-60">
                            <span>{formatTime(message.created_at)}</span>
                            {message.sender_id === currentUserId && (
                              <div className="flex items-center ml-4">
                                {message.is_read ? (
                                  <CheckCheck className="h-3 w-3 text-blue-400" />
                                ) : (
                                  <Check className="h-3 w-3 text-white/50" />
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}

                    <div ref={messagesEndRef} />

                    {messages.length > 0 && canScrollDown && (
                      <div className="sticky bottom-0 z-10 bg-white/90 backdrop-blur-sm pt-2 mt-4 border-t border-black/10">
                        <div className="text-center">
                          <Button variant="ghost" size="sm" onClick={scrollToBottomEnhanced} className="font-mono text-[10px] uppercase rounded-none hover:bg-black/5">
                            ↓ Scroll to Bottom
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Message Input */}
                  <div className="border-t border-black/10 p-4 bg-black/[0.02] flex-shrink-0">
                    <div className="flex space-x-2">
                      <Input
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="ENTER MESSAGE..."
                        className="flex-1 rounded-none border-black/20 focus:border-black font-mono text-sm uppercase placeholder:text-black/55 h-12"
                        disabled={sending}
                      />
                      <Button
                        onClick={sendMessage}
                        disabled={!newMessage.trim() || sending}
                        className="bg-black hover:bg-black/80 text-white rounded-none w-16 h-12"
                      >
                        {sending ? <Activity className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                  <MessageSquare className="h-12 w-12 text-black/20 mb-4" />
                  <h2 className="text-xl font-bold uppercase mb-2">No Contact Selected</h2>
                  <p className="text-xs font-mono text-black/55 uppercase">Select a patient or lab technician to start messaging</p>
                </div>
              )}
            </div>
          </div>

          {/* ML Suggestions Panel */}
          {showSuggestions && (
            <div className="lg:col-span-1 lg:h-full min-h-0">
              <div className="lg:h-full flex flex-col bg-white border border-black/10">
                <div className="flex-shrink-0 border-b border-black/10 p-6 bg-black/[0.02]">
                  <h2 className="text-lg font-bold uppercase flex items-center">
                    <Brain className="h-5 w-5 mr-2" />
                    AI Feed
                    {mlSuggestions.length > 0 && (
                      <span className="ml-2 px-2 py-0.5 bg-black text-white text-[10px] font-mono">
                        {mlSuggestions.length}
                      </span>
                    )}
                  </h2>
                  <p className="text-[10px] font-mono text-black/60 uppercase mt-1">Lab Analysis</p>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin contacts-container">
                  {mlSuggestions.length === 0 ? (
                    <div className="text-center py-8">
                      <Brain className="h-8 w-8 mx-auto mb-2 text-black/20" />
                      <p className="text-[10px] font-mono text-black/55 uppercase">No pending suggestions</p>
                    </div>
                  ) : (
                    mlSuggestions.map((suggestion) => (
                      <div
                        key={suggestion.id}
                        className={`p-4 border cursor-pointer transition-colors ${selectedSuggestion?.id === suggestion.id
                          ? 'border-black bg-black/[0.02]'
                          : 'border-black/10 hover:border-black/30'
                          }`}
                        {...pressable(() => setSelectedSuggestion(suggestion))}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center space-x-2">
                            {getSeverityIcon(suggestion.severity)}
                            <span className="text-[10px] font-mono uppercase font-bold border border-black px-1.5 py-0.5">
                              {suggestion.severity}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-black/55 uppercase">
                            {new Date(suggestion.processed_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm font-bold uppercase mb-1">
                          Patient {suggestion.patient_id || 'Unknown'}
                        </p>
                        <p className="text-[10px] font-mono text-black/60 uppercase mb-3">
                          {(suggestion.test_type || 'Unknown Test').replace('_', ' ')}
                        </p>
                        <p className="text-xs font-mono text-black/80 line-clamp-2 mb-4 leading-relaxed">
                          {suggestion.findings || 'No findings available'}
                        </p>
                        <div className="flex items-center justify-between border-t border-black/10 pt-3">
                          <span className="text-[10px] font-mono font-bold uppercase">
                            CONFIDENCE: {((suggestion.confidence || 0) * 100).toFixed(0)}%
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-black rounded-none font-mono uppercase text-[10px] h-6 px-3"
                            onClick={(e) => {
                              e.stopPropagation()
                              insertSuggestionIntoChat(suggestion)
                            }}
                          >
                            Use
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ML Suggestion Detail Modal */}
        {selectedSuggestion && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white border border-black/10 max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl rounded-none">
              <div className="flex items-center justify-between border-b border-black/10 p-6 bg-black/[0.02]">
                <h3 className="text-xl font-bold uppercase flex items-center">
                  <Brain className="h-5 w-5 mr-2" />
                  Analysis Details
                </h3>
                <Button
                  variant="ghost"
                  className="rounded-none hover:bg-black/5 w-8 h-8 p-0 flex items-center justify-center"
                  onClick={() => setSelectedSuggestion(null)}
                >
                  <span className="font-mono text-xl leading-none">×</span>
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-8">
                <div className="grid grid-cols-2 gap-px bg-black/10 border border-black/10">
                  <div className="p-4 bg-white">
                    <label className="text-[10px] font-mono uppercase text-black/55 block mb-1">Patient ID</label>
                    <p className="text-sm font-bold uppercase">{selectedSuggestion.patient_id || 'Unknown'}</p>
                  </div>
                  <div className="p-4 bg-white">
                    <label className="text-[10px] font-mono uppercase text-black/55 block mb-1">Test Type</label>
                    <p className="text-sm font-mono uppercase">{(selectedSuggestion.test_type || 'Unknown Test').replace('_', ' ')}</p>
                  </div>
                  <div className="p-4 bg-white">
                    <label className="text-[10px] font-mono uppercase text-black/55 block mb-1">Severity</label>
                    <span className="text-[10px] font-mono font-bold uppercase border border-black px-1.5 py-0.5 inline-block">
                      {selectedSuggestion.severity || 'Unknown'}
                    </span>
                  </div>
                  <div className="p-4 bg-white">
                    <label className="text-[10px] font-mono uppercase text-black/55 block mb-1">Confidence</label>
                    <p className="text-sm font-mono font-bold">{((selectedSuggestion.confidence || 0) * 100).toFixed(1)}%</p>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-mono uppercase text-black/55 block mb-2">Findings</label>
                  <div className="p-4 bg-black/[0.02] border border-black/10">
                    <p className="text-sm font-mono leading-relaxed">
                      {selectedSuggestion.findings || 'No findings available'}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-mono uppercase text-black/55 block mb-2">Recommendations</label>
                  <div className="p-4 bg-black/[0.02] border border-black/10">
                    <p className="text-sm font-mono leading-relaxed">
                      {selectedSuggestion.recommendations || 'No recommendations available'}
                    </p>
                  </div>
                </div>

                <div className="flex space-x-4 pt-6 border-t border-black/10">
                  <Button
                    onClick={() => insertSuggestionIntoChat(selectedSuggestion)}
                    className="flex-1 bg-black hover:bg-black/80 text-white rounded-none font-mono uppercase text-xs h-12"
                  >
                    Use in Chat
                  </Button>
                  <Button
                    onClick={() => handleSuggestionAction(selectedSuggestion, 'accept')}
                    variant="outline"
                    className="flex-1 border-green-500 text-green-600 hover:bg-green-50 rounded-none font-mono uppercase text-xs h-12"
                  >
                    Accept
                  </Button>
                  <Button
                    onClick={() => handleSuggestionAction(selectedSuggestion, 'reject')}
                    variant="outline"
                    className="flex-1 border-red-500 text-red-600 hover:bg-red-50 rounded-none font-mono uppercase text-xs h-12"
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
