"use client"
import Image from 'next/image'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Send, 
  Paperclip, 
  Download, 
  Eye, 
  Users, 
  Stethoscope, 
  FlaskConical,
  FileText,
  Image as ImageIcon,
  AlertCircle
} from 'lucide-react'
import { chatAPI, ChatMessage, TypingStatus, formatFileSize, isImageFile, getFileIcon } from '@/lib/chat-api'

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

interface EnhancedChatProps {
  currentUserId: string
  currentUserName: string
  currentUserRole: string
  contacts: Contact[]
  onSendMessage?: (message: ChatMessage) => void
}

export default function EnhancedChat({
  currentUserId,
  currentUserName,
  currentUserRole,
  contacts,
  onSendMessage
}: EnhancedChatProps) {
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState('all')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (selectedContact) {
      loadMessages()
      setupTypingSubscription()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedContact])

  const loadMessages = async () => {
    if (!selectedContact) return

    const messagesData = await chatAPI.getMessages(currentUserId, selectedContact.id)
    setMessages(messagesData)
    
    // Mark messages as read
    await chatAPI.markMessagesAsRead(selectedContact.id, currentUserId)
  }

  const setupTypingSubscription = () => {
    const subscription = chatAPI.subscribeToTypingStatus((status: TypingStatus) => {
      if (status.user_id === selectedContact?.id) {
        setTypingUsers(prev => {
          const newSet = new Set(prev)
          if (status.is_typing) {
            newSet.add(status.user_id)
          } else {
            newSet.delete(status.user_id)
          }
          return newSet
        })
      }
    })

    return () => subscription.unsubscribe()
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedContact || sending) return

    setSending(true)
    try {
      const message = await chatAPI.sendMessage({
        content: newMessage.trim(),
        sender_id: currentUserId,
        sender_name: currentUserName,
        sender_role: currentUserRole,
        receiver_id: selectedContact.id,
        receiver_name: selectedContact.name,
        receiver_role: selectedContact.role,
        message_type: 'text'
      })

      if (message) {
        setMessages(prev => [...prev, message])
        setNewMessage("")
        onSendMessage?.(message)
      }
    } catch (error) {
      console.error('Error sending message:', error)
    } finally {
      setSending(false)
    }
  }

  const sendFile = async (file: File) => {
    if (!selectedContact || sending) return

    setSending(true)
    try {
      const message = await chatAPI.sendFile(
        file,
        currentUserId,
        currentUserName,
        currentUserRole,
        selectedContact.id,
        selectedContact.name,
        selectedContact.role
      )

      if (message) {
        setMessages(prev => [...prev, message])
        onSendMessage?.(message)
      }
    } catch (error) {
      console.error('Error sending file:', error)
    } finally {
      setSending(false)
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      sendFile(file)
    }
  }

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value)
    
    // Set typing status
    if (selectedContact) {
      chatAPI.setTypingStatus(currentUserId, currentUserName, true)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const getFilteredContacts = () => {
    switch (activeTab) {
      case 'doctors':
        return contacts.filter(c => c.role === 'doctor')
      case 'labs':
        return contacts.filter(c => c.role === 'lab')
      case 'patients':
        return contacts.filter(c => c.role === 'patient')
      default:
        return contacts
    }
  }

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const renderMessage = (message: ChatMessage) => {
    const isOwnMessage = message.sender_id === currentUserId
    const isFile = message.message_type === 'file'
    const isImage = isFile && message.file_name && isImageFile(message.file_name)

    return (
      <div
        key={message.id}
        className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} mb-4`}
      >
        <div
          className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
            isOwnMessage
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 text-gray-900'
          }`}
        >
          {isFile ? (
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <span className="text-lg">{getFileIcon(message.file_name || '')}</span>
                <span className="font-medium">{message.file_name}</span>
              </div>
              <div className="text-sm opacity-75">
                {message.file_size && formatFileSize(message.file_size)}
              </div>
              {isImage && message.file_url ? (
                <Image
                  src={message.file_url}
                  alt={message.file_name || 'Attached image'}
                  width={600}
                  height={400}
                  className="max-w-full h-auto rounded"
                />
              ) : (
                <div className="flex space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open(message.file_url, '_blank')}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    View
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const link = document.createElement('a')
                      link.href = message.file_url || ''
                      link.download = message.file_name || 'download'
                      link.click()
                    }}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Download
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <p className="whitespace-pre-wrap">{message.content}</p>
          )}
          <div className={`text-xs mt-1 ${isOwnMessage ? 'text-blue-100' : 'text-gray-500'}`}>
            {formatTime(message.created_at)}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="grid lg:grid-cols-4 gap-6 h-[calc(100vh-200px)]">
      {/* Contacts Sidebar */}
      <div className="lg:col-span-1">
        <Card className="h-full">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Users className="h-5 w-5 mr-2" />
              Healthcare Team
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
                <TabsTrigger value="doctors" className="flex items-center text-xs">
                  <Stethoscope className="h-3 w-3 mr-1" />
                  Doctors
                </TabsTrigger>
                <TabsTrigger value="labs" className="flex items-center text-xs">
                  <FlaskConical className="h-3 w-3 mr-1" />
                  Labs
                </TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="mt-4">
                <div className="space-y-2">
                  {getFilteredContacts().map((contact) => (
                    <div
                      key={contact.id}
                      onClick={() => setSelectedContact(contact)}
                      className={`p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedContact?.id === contact.id
                          ? 'bg-blue-100 border-blue-300'
                          : 'bg-gray-50 hover:bg-gray-100'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <div className="relative">
                            {contact.role === 'doctor' ? (
                              <Stethoscope className="h-6 w-6 text-green-600" />
                            ) : contact.role === 'lab' ? (
                              <FlaskConical className="h-6 w-6 text-blue-600" />
                            ) : (
                              <Users className="h-6 w-6 text-purple-600" />
                            )}
                            {contact.online && (
                              <div className="absolute -bottom-1 -right-1 h-3 w-3 bg-green-500 rounded-full border-2 border-white"></div>
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{contact.name}</p>
                            <p className="text-sm text-gray-600">{contact.specialty || contact.role}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          {contact.unread_count && contact.unread_count > 0 && (
                            <Badge className="bg-red-500 text-white text-xs">
                              {contact.unread_count}
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
              {/* Chat Header */}
              <CardHeader className="border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {selectedContact.role === 'doctor' ? (
                      <Stethoscope className="h-6 w-6 text-green-600" />
                    ) : selectedContact.role === 'lab' ? (
                      <FlaskConical className="h-6 w-6 text-blue-600" />
                    ) : (
                      <Users className="h-6 w-6 text-purple-600" />
                    )}
                    <div>
                      <CardTitle className="text-lg">{selectedContact.name}</CardTitle>
                      <p className="text-sm text-gray-600">
                        {selectedContact.specialty || selectedContact.role}
                        {selectedContact.online && (
                          <span className="ml-2 text-green-600">• Online</span>
                        )}
                      </p>
                    </div>
                  </div>
                  {typingUsers.has(selectedContact.id) && (
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                      <span>{selectedContact.name} is typing...</span>
                    </div>
                  )}
                </div>
              </CardHeader>

              {/* Messages */}
              <CardContent className="flex-1 overflow-y-auto p-4">
                <div className="space-y-4">
                  {messages.map(renderMessage)}
                  <div ref={messagesEndRef} />
                </div>
              </CardContent>

              {/* Message Input */}
              <div className="p-4 border-t">
                <div className="flex space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={sending}
                  >
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  <Input
                    value={newMessage}
                    onChange={handleTyping}
                    onKeyPress={handleKeyPress}
                    placeholder="Type a message..."
                    disabled={sending}
                    className="flex-1"
                  />
                  <Button
                    onClick={sendMessage}
                    disabled={!newMessage.trim() || sending}
                    size="sm"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileSelect}
                  className="hidden"
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                />
              </div>
            </>
          ) : (
            <CardContent className="flex-1 flex items-center justify-center">
              <div className="text-center text-gray-500">
                <Users className="h-12 w-12 mx-auto mb-4" />
                <p>Select a contact to start chatting</p>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  )
} 
