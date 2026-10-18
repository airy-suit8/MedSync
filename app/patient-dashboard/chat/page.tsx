"use client"

import { useEffect, useState, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Activity, Users, MessageSquare, Send, Stethoscope, FlaskConical, User, Check, CheckCheck, Brain, AlertTriangle, Lightbulb, Eye, EyeOff } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import ClinicalNotice from "@/components/medical/common/ClinicalNotice"
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

export default function PatientChatPage() {
  const [user, setUser] = useState<any>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [doctors, setDoctors] = useState<Contact[]>([])
  const [labTechs, setLabTechs] = useState<Contact[]>([])
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [activeTab, setActiveTab] = useState("doctors")
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set())
  const [canScrollUp, setCanScrollUp] = useState(false)
  const [canScrollDown, setCanScrollDown] = useState(false)
  const [loadingContacts, setLoadingContacts] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const supabase = createClient()

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
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

  // Check scroll position for scroll buttons
  const handleScroll = () => {
    const messagesContainer = messagesContainerRef.current
    if (messagesContainer) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainer
      setCanScrollUp(scrollTop > 100)
      setCanScrollDown(scrollTop < scrollHeight - clientHeight - 100)
    }
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    const checkUser = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          router.push("/login")
          return
        }

        if (user.app_metadata?.role !== "patient") {
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
      } catch (error) {
        console.error('Error in checkUser:', error)
        setLoading(false)
      }
    }

    checkUser()
  }, [router, supabase])

  useEffect(() => {
    if (currentUserId) {
      loadContacts()
      setupRealtimeSubscriptions()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId, supabase])

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
        table: 'profiles',
        filter: `role.in.(doctor,lab)`
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
      // First, check if we have the current user ID
      if (!currentUserId) {
        return
      }

      // Prevent multiple simultaneous calls
      if (loadingContacts) {
        return
      }

      if (doctors.length > 0 || labTechs.length > 0) {
        return
      }

      setLoadingContacts(true)
      const { data: usersData, error } = await supabase
        .from('profile_directory')
        .select('id, name, role, specialty, online')
        .in('role', ['doctor', 'lab'])
        .order('online', { ascending: false })
      if (error) {
        console.error('Could not load contacts:', error.message)
        return
      }
      const usersList = usersData || []
      
      // Map users to Contact interface with default values
      const mapToContact = (user: any): Contact => ({
        id: user.id,
        name: user.name,
        role: user.role,
        specialty: user.specialty || null,
        online: user.online || false
      })

      const doctorsList = usersList.filter((u: any) => u.role === 'doctor').map(mapToContact)
      const labsList = usersList.filter((u: any) => u.role === 'lab').map(mapToContact)
      
      setDoctors(doctorsList)
      setLabTechs(labsList)
      
      // Update online users set (only if online column exists)
      if (usersList.some((u: any) => 'online' in u)) {
        const onlineUserIds = new Set<string>(usersList.filter((u: any) => u.online).map((u: any) => u.id))
        setOnlineUsers(onlineUserIds)
      }
      
      if (doctorsList.length > 0) {
        setSelectedContact(doctorsList[0])
      }
    } catch (error) {
      console.error('Unexpected error loading contacts:', error)
    } finally {
      setLoadingContacts(false)
    }
  }

  const getActiveContacts = () => {
    switch (activeTab) {
      case 'doctors': return doctors
      case 'labs': return labTechs
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
        return
      }

      setMessages(messagesData || [])
    } catch (error) {
      console.error('Error loading messages:', error)
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
      sender_name: user?.user_metadata?.name || 'Patient',
      sender_role: 'patient',
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
          sender_name: user?.user_metadata?.name || 'Patient',
          sender_role: 'patient',
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-transparent">
        <div className="flex flex-col items-center">
          <Activity className="h-8 w-8 animate-spin mb-4 text-black" />
          <span className="text-xs font-mono uppercase tracking-widest text-black/60">Synchronizing Messages...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-transparent p-6 lg:p-12 max-w-7xl mx-auto flex flex-col lg:h-screen">
      {/* Header */}
      <header className="border-b border-black/10 pb-8 mb-12 flex items-end justify-between flex-shrink-0">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight uppercase mb-2">Messages</h1>
          <p className="text-black/60 font-light text-lg italic">
            Message your doctors and labs.
          </p>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row gap-6 lg:gap-12 min-h-0">
        {/* Sidebar - Contacts */}
        <div className="w-full lg:w-80 max-h-80 lg:max-h-none flex flex-col gap-8 flex-shrink-0">
          <div className="border border-black/10 bg-white flex flex-col min-h-0 h-full">
            <div className="p-6 border-b border-black/10 bg-black/[0.02]">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-black/55 mb-4 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Contact Directory
              </h3>
              <div className="flex bg-black/[0.05] p-1">
                {['doctors', 'labs'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => handleTabChange(tab)}
                    className={`flex-1 py-2 text-[10px] font-mono uppercase tracking-widest transition-all ${
                      activeTab === tab ? 'bg-white text-black shadow-sm' : 'text-black/55 hover:text-black'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="divide-y divide-black/5">
                {loadingContacts ? (
                  <div className="p-8 text-center">
                    <Activity className="h-6 w-6 animate-spin mx-auto text-black/20" />
                  </div>
                ) : getActiveContacts().length === 0 ? (
                  <div className="p-8 text-center text-[10px] font-mono uppercase text-black/55">
                    No conversations yet
                  </div>
                ) : (
                  getActiveContacts().map((contact) => (
                    <div
                      key={contact.id}
                      {...pressable(() => setSelectedContact(contact))}
                      className={`p-6 cursor-pointer transition-all relative group ${
                        selectedContact?.id === contact.id ? 'bg-black/[0.02]' : 'hover:bg-black/[0.01]'
                      }`}
                    >
                      {selectedContact?.id === contact.id && (
                        <div className="absolute left-0 top-0 h-full w-0.5 bg-indigo-600"></div>
                      )}
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-bold uppercase tracking-tight">{contact.name}</span>
                            {onlineUsers.has(contact.id) && (
                              <span className="h-1.5 w-1.5 bg-green-500 rounded-full"></span>
                            )}
                          </div>
                          <p className="text-[10px] font-mono uppercase text-black/55">{contact.specialty || contact.role}</p>
                        </div>
                        {getUnreadCount(contact.id) > 0 && (
                          <div className="h-5 w-5 bg-red-600 text-white text-[10px] font-black flex items-center justify-center">
                            {getUnreadCount(contact.id)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col border border-black/10 bg-white min-w-0 relative min-h-[520px] lg:min-h-0">
          {selectedContact ? (
            <>
              {/* Chat Header */}
              <div className="p-6 border-b border-black/10 flex items-center justify-between bg-black/[0.02] flex-shrink-0">
                <div className="absolute top-0 left-0 w-full h-0.5 bg-indigo-600"></div>
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-black text-white">
                    {selectedContact.role === 'doctor' ? <Stethoscope className="h-5 w-5" /> : <FlaskConical className="h-5 w-5" />}
                  </div>
                  <div>
                    <h3 className="text-xl font-black uppercase tracking-tight">{selectedContact.name}</h3>
                    <p className="text-[10px] font-mono uppercase tracking-widest text-black/55">
                      {selectedContact.specialty || selectedContact.role}
                    </p>
                  </div>
                </div>
              </div>

              {/* Messages Area */}
              <div 
                ref={messagesContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto p-8 space-y-6 flex flex-col"
              >
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.sender_id === currentUserId ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[80%] ${message.sender_id === currentUserId ? 'text-right' : 'text-left'}`}>
                      <div
                        className={`p-4 font-mono text-sm uppercase leading-relaxed ${
                          message.sender_id === currentUserId
                            ? 'bg-black text-white'
                            : 'bg-black/[0.05] text-black border border-black/5'
                        }`}
                      >
                        {message.content}
                      </div>
                      <div className="mt-2 flex items-center gap-3 justify-end text-[10px] font-mono text-black/55 uppercase">
                        <span>{formatTime(message.created_at)}</span>
                        {message.sender_id === currentUserId && (
                          message.is_read ? <CheckCheck className="h-3 w-3 text-green-500" /> : <Check className="h-3 w-3" />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="p-8 border-t border-black/10 bg-black/[0.01] flex-shrink-0">
                <div className="mb-4">
                  <ClinicalNotice>Chat is not monitored for emergencies.</ClinicalNotice>
                </div>
                <div className="flex gap-4">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="ENTER CLINICAL QUERY..."
                    className="flex-1 rounded-none border-black h-14 font-mono text-sm uppercase tracking-wider focus-visible:ring-0 focus-visible:border-indigo-600"
                    disabled={sending}
                  />
                  <Button
                    onClick={sendMessage}
                    disabled={!newMessage.trim() || sending}
                    className="bg-black text-white hover:bg-indigo-600 rounded-none h-14 px-8 uppercase font-mono text-xs tracking-widest transition-all group"
                  >
                    {sending ? (
                      <Activity className="h-5 w-5 animate-spin" />
                    ) : (
                      <div className="flex items-center gap-3">
                        <span>SEND</span>
                        <Send className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                      </div>
                    )}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-center p-12">
               <div className="max-w-xs">
                 <MessageSquare className="h-16 w-16 text-black/10 mx-auto mb-6" />
                 <h3 className="text-2xl font-black uppercase tracking-tight mb-2">Comms Offline</h3>
                 <p className="text-xs font-mono uppercase tracking-widest text-black/55 leading-loose">
                   Choose a doctor to start a conversation.
                 </p>
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 
