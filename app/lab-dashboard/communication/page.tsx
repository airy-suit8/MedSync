"use client"

import { useEffect, useState, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Activity, Users, MessageSquare, Send, ArrowLeft, Stethoscope, FlaskConical, User, Clock, Check, CheckCheck } from "lucide-react"
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

export default function LabCommunicationPage() {
  const [user, setUser] = useState<any>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [doctors, setDoctors] = useState<Contact[]>([])
  const [patients, setPatients] = useState<Contact[]>([])
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [activeTab, setActiveTab] = useState("doctors")
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set())
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

      if (user.user_metadata?.role !== "lab") {
        router.push("/login")
        return
      }

      setUser(user)
      
      // Get or create user record
      const { data: userData, error: userError } = await supabase
        .from('profile_directory')
        .select('id')
        .eq('id', user.id)
        .single()

      if (userError) {
        console.log('Creating new user record...')
        const { data: newUser, error: createError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            name: user.user_metadata?.name || 'Lab Tech',
            email: user.email || '',
            role: 'lab'
          })
          .select('id')
          .single()

        if (createError) {
          console.error('Error creating user record:', createError)
        } else {
          setCurrentUserId(newUser.id)
          // Set user as online
          await supabase
            .from('profiles')
            .update({ online: true })
            .eq('id', newUser.id)
        }
      } else {
        setCurrentUserId(userData.id)
        // Set user as online
        await supabase
          .from('profiles')
          .update({ online: true })
          .eq('id', userData.id)
      }
      
      setLoading(false)
    }

    checkUser()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  useEffect(() => {
    if (currentUserId) {
      loadContacts()
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

  const setupRealtimeSubscriptions = () => {
    // Subscribe to user online status changes
    const userStatusSubscription = supabase
      .channel('user_status')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'users',
        filter: `role.in.(doctor,patient)`
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

    return () => {
      userStatusSubscription.unsubscribe()
      messageSubscription.unsubscribe()
    }
  }

  const loadContacts = async () => {
    try {
      const { data: usersData, error } = await supabase
        .from('profile_directory')
        .select('id, name, role, specialty, online')
        .in('role', ['doctor', 'patient'])
        .order('online', { ascending: false })

      if (error) {
        console.warn('Users table query failed, using fallback data:', error)
        const fallbackDoctors = [
          { id: '11111111-1111-1111-1111-111111111111', name: 'Dr. Sarah Smith', role: 'doctor', specialty: 'Cardiologist', online: true },
          { id: '22222222-2222-2222-2222-222222222222', name: 'Dr. Michael Johnson', role: 'doctor', specialty: 'General Physician', online: true }
        ]
        const fallbackPatients = [
          { id: '66666666-6666-6666-6666-666666666666', name: 'John Patient', role: 'patient', specialty: 'General', online: true },
          { id: '77777777-7777-7777-7777-777777777777', name: 'Mary Wilson', role: 'patient', specialty: 'General', online: false }
        ]
        
        setDoctors(fallbackDoctors)
        setPatients(fallbackPatients)
        
        if (fallbackDoctors.length > 0) {
          setSelectedContact(fallbackDoctors[0])
        }
        return
      }

      const usersList = usersData || []
      
      setDoctors(usersList.filter((u: any) => u.role === 'doctor'))
      setPatients(usersList.filter((u: any) => u.role === 'patient'))
      
      // Update online users set
      const onlineUserIds = new Set<string>(usersList.filter((u: any) => u.online).map((u: any) => u.id))
      setOnlineUsers(onlineUserIds)
      
      if (usersList.filter((u: any) => u.role === 'doctor').length > 0) {
        setSelectedContact(usersList.filter((u: any) => u.role === 'doctor')[0])
      }
    } catch (error) {
      console.error('Error loading contacts:', error)
      setDoctors([])
      setPatients([])
    }
  }

  const getActiveContacts = () => {
    switch (activeTab) {
      case 'doctors': return doctors
      case 'patients': return patients
      default: return doctors
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
            content: 'Hello! I need some lab results for a patient.',
            sender_id: selectedContact.id,
            sender_name: selectedContact.name,
            sender_role: selectedContact.role,
            receiver_id: currentUserId,
            receiver_name: user?.user_metadata?.name || 'Lab Tech',
            receiver_role: 'lab',
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
          sender_name: user?.user_metadata?.name || 'Lab Tech',
          sender_role: 'lab',
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
          sender_name: user?.user_metadata?.name || 'Lab Tech',
          sender_role: 'lab',
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-transparent">
        <div className="flex flex-col items-center">
          <Activity className="h-8 w-8 animate-spin mb-4 text-black" />
          <span className="text-xs font-mono uppercase tracking-widest text-black/60">Establishing COMMS...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-transparent p-12 max-w-7xl mx-auto">
      {/* Header */}
      <header className="border-b border-black/10 pb-8 mb-12 flex items-end justify-between">
        <div>
          <Link href="/lab-dashboard" className="inline-flex items-center space-x-2 text-xs font-mono uppercase tracking-widest text-black/40 hover:text-black mb-4 transition-colors">
            <ArrowLeft className="h-3 w-3" />
            <span>Return to Node</span>
          </Link>
          <h1 className="text-4xl font-bold tracking-tight uppercase mb-2">Diagnostic Comms</h1>
          <p className="text-black/60 font-light text-lg italic">
            Direct uplink to physicians and patient nodes
          </p>
        </div>
        <div className="text-right hidden md:block">
          <span className="text-[10px] font-mono uppercase tracking-widest text-black/40 block mb-1">
            Uplink Status
          </span>
          <span className="text-xl font-mono border-b-2 border-emerald-500">
            ENCRYPTED_LINK
          </span>
        </div>
      </header>

      <div className="grid lg:grid-cols-4 gap-12 h-[calc(100vh-280px)]">
        {/* Contacts Sidebar */}
        <div className="lg:col-span-1 flex flex-col border border-black/10 bg-white relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-0.5 bg-black/10"></div>
          
          <div className="p-6 border-b border-black/10">
            <h3 className="text-lg font-black uppercase tracking-tighter flex items-center gap-3">
              <Users className="h-5 w-5" />
              Directory
            </h3>
          </div>

          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full flex-1 flex flex-col">
            <TabsList className="grid w-full grid-cols-2 rounded-none bg-black/5 p-1 h-12">
              <TabsTrigger value="doctors" className="rounded-none font-mono text-[10px] uppercase tracking-widest data-[state=active]:bg-black data-[state=active]:text-white">
                Physicians
              </TabsTrigger>
              <TabsTrigger value="patients" className="rounded-none font-mono text-[10px] uppercase tracking-widest data-[state=active]:bg-black data-[state=active]:text-white">
                Patients
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto p-4">
              <TabsContent value="doctors" className="m-0 space-y-2">
                {doctors.map((doctor) => (
                  <div
                    key={doctor.id}
                    onClick={() => setSelectedContact(doctor)}
                    className={`p-4 border transition-all cursor-pointer group relative ${
                      selectedContact?.id === doctor.id
                        ? 'border-indigo-600 bg-indigo-50/30'
                        : 'border-black/5 hover:border-black/20 bg-white'
                    }`}
                  >
                    {selectedContact?.id === doctor.id && (
                      <div className="absolute left-0 top-0 h-full w-1 bg-indigo-600"></div>
                    )}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="relative">
                          <div className={`p-2 ${selectedContact?.id === doctor.id ? 'bg-indigo-600 text-white' : 'bg-black/[0.03] text-black/40'}`}>
                            <Stethoscope className="h-5 w-5" />
                          </div>
                          {onlineUsers.has(doctor.id) && (
                            <div className="absolute -bottom-1 -right-1 h-3 w-3 bg-emerald-500 border-2 border-white rounded-full animate-pulse"></div>
                          )}
                        </div>
                        <div>
                          <p className="font-black text-xs uppercase tracking-tight">{doctor.name}</p>
                          <p className="text-[10px] font-mono text-black/40 uppercase">{doctor.specialty || 'GENERAL'}</p>
                        </div>
                      </div>
                      {getUnreadCount(doctor.id) > 0 && (
                        <span className="border border-red-600 text-red-600 bg-red-50 text-[9px] font-mono font-bold px-1.5 py-0.5">
                          {getUnreadCount(doctor.id)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="patients" className="m-0 space-y-2">
                {patients.map((patient) => (
                  <div
                    key={patient.id}
                    onClick={() => setSelectedContact(patient)}
                    className={`p-4 border transition-all cursor-pointer group relative ${
                      selectedContact?.id === patient.id
                        ? 'border-indigo-600 bg-indigo-50/30'
                        : 'border-black/5 hover:border-black/20 bg-white'
                    }`}
                  >
                    {selectedContact?.id === patient.id && (
                      <div className="absolute left-0 top-0 h-full w-1 bg-indigo-600"></div>
                    )}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="relative">
                          <div className={`p-2 ${selectedContact?.id === patient.id ? 'bg-indigo-600 text-white' : 'bg-black/[0.03] text-black/40'}`}>
                            <User className="h-5 w-5" />
                          </div>
                          {onlineUsers.has(patient.id) && (
                            <div className="absolute -bottom-1 -right-1 h-3 w-3 bg-emerald-500 border-2 border-white rounded-full animate-pulse"></div>
                          )}
                        </div>
                        <div>
                          <p className="font-black text-xs uppercase tracking-tight">{patient.name}</p>
                          <p className="text-[10px] font-mono text-black/40 uppercase">{patient.specialty || 'NODE'}</p>
                        </div>
                      </div>
                      {getUnreadCount(patient.id) > 0 && (
                        <span className="border border-red-600 text-red-600 bg-red-50 text-[9px] font-mono font-bold px-1.5 py-0.5">
                          {getUnreadCount(patient.id)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </TabsContent>
            </div>
          </Tabs>
        </div>

        {/* Chat Area */}
        <div className="lg:col-span-3 flex flex-col border border-black/10 bg-white relative overflow-hidden">
          {selectedContact ? (
            <>
              <div className="absolute top-0 left-0 w-full h-0.5 bg-indigo-600"></div>
              <div className="p-6 border-b border-black/10 flex items-center justify-between bg-white z-10">
                <div className="flex items-center space-x-4">
                  <div className="relative">
                    <div className="p-3 bg-black text-white">
                      {selectedContact.role === 'doctor' ? (
                        <Stethoscope className="h-6 w-6" />
                      ) : (
                        <User className="h-6 w-6" />
                      )}
                    </div>
                    {onlineUsers.has(selectedContact.id) && (
                      <div className="absolute -bottom-1 -right-1 h-3.5 w-3.5 bg-emerald-500 border-2 border-white rounded-full animate-pulse"></div>
                    )}
                  </div>
                  <div>
                    <h2 className="text-xl font-black uppercase tracking-tighter">{selectedContact.name}</h2>
                    <p className="text-[10px] font-mono text-black/40 uppercase tracking-widest">
                      {selectedContact.role} • {selectedContact.specialty}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-black/[0.01]">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.sender_id === currentUserId ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className="max-w-[70%]">
                       <div className="flex items-center gap-2 mb-1 px-1">
                          <span className="text-[9px] font-mono text-black/30 uppercase">
                            {message.sender_id === currentUserId ? 'YOU' : message.sender_name}
                          </span>
                       </div>
                       <div
                        className={`p-4 rounded-none border-2 font-mono text-sm leading-relaxed ${
                          message.sender_id === currentUserId
                            ? 'bg-black text-white border-black'
                            : 'bg-white text-black border-black/10 shadow-[4px_4px_0px_rgba(0,0,0,0.05)]'
                        }`}
                      >
                        <p>{message.content}</p>
                        <div className="flex items-center justify-end mt-3 gap-2">
                          <span className="text-[9px] opacity-40">{formatTime(message.created_at)}</span>
                          {message.sender_id === currentUserId && (
                            <div className="flex items-center">
                              {message.is_read ? (
                                <CheckCheck className="h-3 w-3 text-emerald-400" />
                              ) : (
                                <Check className="h-3 w-3 opacity-40" />
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              <div className="p-6 border-t border-black/10 bg-white">
                <div className="flex gap-4">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="TYPE MESSAGE TO UPLINK..."
                    className="flex-1 rounded-none border-black h-14 font-mono text-sm uppercase focus-visible:ring-0 focus-visible:border-indigo-600"
                    disabled={sending}
                  />
                  <Button
                    onClick={sendMessage}
                    disabled={!newMessage.trim() || sending}
                    className="bg-black text-white rounded-none h-14 w-20 hover:bg-indigo-600 transition-all flex items-center justify-center"
                  >
                    {sending ? (
                      <Activity className="h-5 w-5 animate-spin" />
                    ) : (
                      <Send className="h-5 w-5" />
                    )}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-black/[0.01]">
              <div className="text-center">
                <div className="p-6 bg-black/[0.03] inline-block mb-6">
                  <MessageSquare className="h-12 w-12 text-black/10" />
                </div>
                <p className="text-xs font-mono uppercase text-black/30 tracking-[0.3em]">Select node to initialize comms</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 
