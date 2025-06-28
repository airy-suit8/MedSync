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

      if (user.user_metadata?.role !== "patient") {
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
            name: user.user_metadata?.name || 'Patient',
            email: user.email || '',
            role: 'patient'
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
      setupRealtimeSubscriptions()
    }
  }, [currentUserId])

  useEffect(() => {
    if (selectedContact && currentUserId) {
      loadMessages()
      markMessagesAsRead()
    }
  }, [selectedContact, currentUserId])

  const setupRealtimeSubscriptions = () => {
    // Subscribe to user online status changes
    const userStatusSubscription = supabase
      .channel('user_status')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'users',
        filter: `role.in.(doctor,lab)`
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

    return () => {
      userStatusSubscription.unsubscribe()
      messageSubscription.unsubscribe()
    }
  }

  const loadContacts = async () => {
    try {
      const { data: usersData, error } = await supabase
        .from('users')
        .select('id, name, role, specialty, online')
        .in('role', ['doctor', 'lab'])
        .order('online', { ascending: false })

      if (error) {
        console.warn('Users table query failed, using fallback data:', error)
        const fallbackDoctors = [
          { id: '11111111-1111-1111-1111-111111111111', name: 'Dr. Sarah Smith', role: 'doctor', specialty: 'Cardiologist', online: true },
          { id: '22222222-2222-2222-2222-222222222222', name: 'Dr. Michael Johnson', role: 'doctor', specialty: 'General Physician', online: true }
        ]
        const fallbackLabTechs = [
          { id: '44444444-4444-4444-4444-444444444444', name: 'Lab Tech Alex Chen', role: 'lab', specialty: 'Clinical Laboratory', online: true },
          { id: '55555555-5555-5555-5555-555555555555', name: 'Lab Tech Maria Garcia', role: 'lab', specialty: 'Radiology', online: true }
        ]
        
        setDoctors(fallbackDoctors)
        setLabTechs(fallbackLabTechs)
        
        if (fallbackDoctors.length > 0) {
          setSelectedContact(fallbackDoctors[0])
        }
        return
      }

      const usersList = usersData || []
      
      setDoctors(usersList.filter((u: any) => u.role === 'doctor'))
      setLabTechs(usersList.filter((u: any) => u.role === 'lab'))
      
      // Update online users set
      const onlineUserIds = new Set(usersList.filter((u: any) => u.online).map((u: any) => u.id))
      setOnlineUsers(onlineUserIds)
      
      if (usersList.filter((u: any) => u.role === 'doctor').length > 0) {
        setSelectedContact(usersList.filter((u: any) => u.role === 'doctor')[0])
      }
    } catch (error) {
      console.error('Error loading contacts:', error)
      setDoctors([])
      setLabTechs([])
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
        const fallbackMessages = [
          {
            id: '1',
            content: 'Hello! How can I help you today?',
            sender_id: selectedContact.id,
            sender_name: selectedContact.name,
            sender_role: selectedContact.role,
            receiver_id: currentUserId,
            receiver_name: user?.user_metadata?.name || 'Patient',
            receiver_role: 'patient',
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
          sender_name: user?.user_metadata?.name || 'Patient',
          sender_role: 'patient',
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
          sender_name: user?.user_metadata?.name || 'Patient',
          sender_role: 'patient',
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
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-white flex items-center justify-center">
        <div className="text-center">
          <Activity className="h-8 w-8 text-green-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading your chat...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Image src="/medi.png" alt="MedSync Logo" width={32} height={32} />
            <span className="text-2xl font-bold text-gray-900">MedSync</span>
            <Badge className="bg-green-100 text-green-800">Patient Portal</Badge>
          </div>
          <div className="flex items-center space-x-4">
            <Link href="/patient-dashboard">
              <Button variant="outline" className="bg-white text-green-600 border-green-200 hover:bg-green-50">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-4 gap-6 h-[calc(100vh-200px)]">
          {/* Contacts Sidebar */}
          <div className="lg:col-span-1">
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="h-5 w-5 mr-2" />
                  Healthcare Team
                </CardTitle>
                <CardDescription>Connect with doctors and lab technicians</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="doctors" className="flex items-center">
                      <Stethoscope className="h-4 w-4 mr-2" />
                      Doctors
                    </TabsTrigger>
                    <TabsTrigger value="labs" className="flex items-center">
                      <FlaskConical className="h-4 w-4 mr-2" />
                      Labs
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="doctors" className="mt-4">
                    <div className="space-y-2">
                      {doctors.map((doctor) => (
                        <div
                          key={doctor.id}
                          onClick={() => setSelectedContact(doctor)}
                          className={`p-3 rounded-lg cursor-pointer transition-colors ${
                            selectedContact?.id === doctor.id
                              ? 'bg-green-100 border-green-300'
                              : 'bg-gray-50 hover:bg-gray-100'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <div className="relative">
                                <User className="h-8 w-8 text-green-600" />
                                {onlineUsers.has(doctor.id) && (
                                  <div className="absolute -bottom-1 -right-1 h-3 w-3 bg-green-500 rounded-full border-2 border-white"></div>
                                )}
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">{doctor.name}</p>
                                <p className="text-sm text-gray-600">{doctor.specialty}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              {getUnreadCount(doctor.id) > 0 && (
                                <Badge className="bg-red-500 text-white text-xs">
                                  {getUnreadCount(doctor.id)}
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
                              ? 'bg-green-100 border-green-300'
                              : 'bg-gray-50 hover:bg-gray-100'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <div className="relative">
                                <FlaskConical className="h-8 w-8 text-blue-600" />
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
          <div className="lg:col-span-3">
            <Card className="h-full flex flex-col">
              {selectedContact ? (
                <>
                  <CardHeader className="border-b">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="relative">
                          {selectedContact.role === 'doctor' ? (
                            <Stethoscope className="h-8 w-8 text-green-600" />
                          ) : (
                            <FlaskConical className="h-8 w-8 text-blue-600" />
                          )}
                          {onlineUsers.has(selectedContact.id) && (
                            <div className="absolute -bottom-1 -right-1 h-3 w-3 bg-green-500 rounded-full border-2 border-white"></div>
                          )}
                        </div>
                        <div>
                          <CardTitle className="text-lg">{selectedContact.name}</CardTitle>
                          <CardDescription>
                            {selectedContact.role === 'doctor' ? 'Doctor' : 'Lab Technician'} • {selectedContact.specialty}
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
                                ? 'bg-green-100 text-gray-900'
                                : 'bg-blue-100 text-gray-900'
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
                          className="bg-green-600 hover:bg-green-700"
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
        </div>
      </div>
    </div>
  )
} 