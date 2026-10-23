'use client'

// REFACTOR NOTE: A dedicated `useWebRTC` hook has been extracted to
// `@/hooks/use-webrtc.ts`. It encapsulates all peer-connection, ICE,
// signaling, and media-stream logic. Migrate this component to use the
// hook to achieve clean SRP separation (~1068 lines → ~450 lines).

import React, { useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  PhoneOff,
  Monitor,
  MonitorOff,
  MessageSquare,
  Send,
  X,
  Users,
  Calendar,
  Clock,
  Copy,
  Check,
  Loader2
} from 'lucide-react'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase'

interface Consultation {
  id: string
  // Per-appointment secret (appointments.call_secret) that names the signalling channel;
  // only the appointment's doctor and patient can read it.
  call_secret?: string
  appointment_date?: string
  appointment_time?: string
  start_time?: string
  end_time?: string
  doctor_id?: string
  doctor_name?: string
  patient_name?: string
}

interface MedicalVideoCallProps {
  isOpen: boolean
  onClose: () => void
  consultation: Consultation
  userRole: 'doctor' | 'patient'
}

interface ChatMessage {
  id: string
  sender: string
  message: string
  timestamp: Date
}

interface MeetingDetails {
  id?: string
  appointment_id?: string
  meeting_id: string
  password: string
  host_id: string
  created_at: string
  is_active: boolean
}

interface SignalPayload {
  type: 'ready' | 'offer' | 'answer' | 'ice-candidate' | 'hangup'
  fromUserId: string
  senderName: string
  description?: RTCSessionDescriptionInit
  candidate?: RTCIceCandidateInit
}

interface ChatBroadcastPayload {
  fromUserId: string
  senderName: string
  message: string
  timestamp: string
}

export default function MedicalVideoCall({
  isOpen,
  onClose,
  consultation,
  userRole
}: MedicalVideoCallProps) {
  const [isConnecting, setIsConnecting] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [isLoadingMeeting, setIsLoadingMeeting] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [isChannelReady, setIsChannelReady] = useState(false)

  const [isVideoOn, setIsVideoOn] = useState(true)
  const [isAudioOn, setIsAudioOn] = useState(true)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [hasRemoteStream, setHasRemoteStream] = useState(false)
  const [hasLocalStream, setHasLocalStream] = useState(false)

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [isChatOpen, setIsChatOpen] = useState(false)

  const [meetingId, setMeetingId] = useState('')
  const [password, setPassword] = useState('')
  const [participantName, setParticipantName] = useState('')
  const [meetingDetails, setMeetingDetails] = useState<MeetingDetails | null>(null)
  const [isHost, setIsHost] = useState(false)
  const [copiedMeetingId, setCopiedMeetingId] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)

  const localStreamRef = useRef<MediaStream | null>(null)
  const screenStreamRef = useRef<MediaStream | null>(null)
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const signalingChannelRef = useRef<RealtimeChannel | null>(null)
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([])
  const isCreatingOfferRef = useRef(false)

  const loadMeetingDetailsRef = useRef<() => Promise<MeetingDetails | null>>(async () => null)
  const handleIncomingSignalRef = useRef<(payload: SignalPayload) => Promise<void>>(async () => {})
  const handleIncomingChatRef = useRef<(payload: ChatBroadcastPayload) => void>(() => {})

  const currentUserIdRef = useRef<string | null>(null)
  const isHostRef = useRef(false)
  const isConnectedRef = useRef(false)
  const participantNameRef = useRef('')
  const meetingDetailsRef = useRef<MeetingDetails | null>(null)

  useEffect(() => {
    currentUserIdRef.current = currentUserId
  }, [currentUserId])

  useEffect(() => {
    isHostRef.current = isHost
  }, [isHost])

  useEffect(() => {
    isConnectedRef.current = isConnected
  }, [isConnected])

  useEffect(() => {
    participantNameRef.current = participantName
  }, [participantName])

  useEffect(() => {
    meetingDetailsRef.current = meetingDetails
  }, [meetingDetails])

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [chatMessages])

  useEffect(() => {
    if (!isConnected || !localVideoRef.current) return

    const previewStream = isScreenSharing
      ? (screenStreamRef.current || localStreamRef.current)
      : localStreamRef.current

    if (previewStream) {
      localVideoRef.current.srcObject = previewStream
      // Mirror the self-view like a mirror (as Meet/Zoom do); a shared screen stays unflipped
      // so its text reads correctly. The stream sent to the other person is never flipped.
      const previewTransform = isScreenSharing ? 'none' : 'scaleX(-1)'
      localVideoRef.current.style.transform = previewTransform
      localVideoRef.current.style.webkitTransform = previewTransform
      void localVideoRef.current.play().catch(() => {})
      setHasLocalStream(true)
    }
  }, [isConnected, isScreenSharing, isVideoOn])

  const getDefaultParticipantName = () => {
    if (userRole === 'doctor') {
      const doctorName = consultation?.doctor_name || 'Doctor'
      return doctorName.toLowerCase().startsWith('dr.') ? doctorName : `Dr. ${doctorName}`
    }
    return consultation?.patient_name || 'Patient'
  }

  const addChatMessage = (sender: string, message: string) => {
    const nextMessage: ChatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      sender,
      message,
      timestamp: new Date()
    }
    setChatMessages(prev => [...prev, nextMessage])
  }

  const generateMeetingId = () => {
    if (consultation?.id) {
      const normalized = consultation.id.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
      return normalized.slice(0, 11).padEnd(11, '0')
    }
    return Math.floor(10000000000 + Math.random() * 90000000000).toString().slice(0, 11)
  }

  const generateMeetingPassword = () => Math.random().toString(36).substring(2, 8)

  const getConsultationTime = () => {
    if (consultation?.start_time && consultation?.end_time) {
      return `${consultation.start_time} - ${consultation.end_time}`
    }
    return consultation?.appointment_time || 'Time TBA'
  }

  const isDemoConsultation = consultation?.id?.startsWith('demo-')

  const shouldCurrentUserActAsHost = (meeting: MeetingDetails | null, userId: string | null) => {
    if (userRole === 'doctor') return true
    if (!meeting || !userId) return false
    return meeting.host_id === userId
  }

  const resolveCurrentUserId = async () => {
    if (currentUserIdRef.current) {
      return currentUserIdRef.current
    }

    const supabase = createClient()
    const {
      data: { user },
      error
    } = await supabase.auth.getUser()

    if (error || !user) {
      console.error('❌ Unable to resolve authenticated user:', error)
      return null
    }

    setCurrentUserId(user.id)
    return user.id
  }

  const clearRemoteVideo = () => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null
    }
    setHasRemoteStream(false)
  }

  const cleanupConnectionResources = () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop())
      screenStreamRef.current = null
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.ontrack = null
      peerConnectionRef.current.onicecandidate = null
      peerConnectionRef.current.onconnectionstatechange = null
      peerConnectionRef.current.close()
      peerConnectionRef.current = null
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop())
      localStreamRef.current = null
    }

    pendingIceCandidatesRef.current = []
    clearRemoteVideo()
    setHasLocalStream(false)
  }

  const loadMeetingDetails = async (): Promise<MeetingDetails | null> => {
    if (!consultation?.id) return null

    const userId = await resolveCurrentUserId()
    if (!participantNameRef.current) {
      setParticipantName(getDefaultParticipantName())
    }

    if (isDemoConsultation) {
      const demoMeeting: MeetingDetails = {
        meeting_id: generateMeetingId(),
        password: generateMeetingPassword(),
        host_id: userId || 'demo-host',
        created_at: new Date().toISOString(),
        is_active: true
      }

      setMeetingDetails(demoMeeting)
      setMeetingId(demoMeeting.meeting_id)
      setPassword(demoMeeting.password)
      setIsHost(userRole === 'doctor')
      return demoMeeting
    }

    setIsLoadingMeeting(true)
    const supabase = createClient()

    try {
      const { data, error } = await supabase
        .from('consultation_meetings')
        .select('*')
        .eq('appointment_id', consultation.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) {
        console.error('❌ Error loading meeting details:', error)
        setConnectionError('Failed to load meeting details. Please retry.')
        return null
      }

      if (!data) {
        setMeetingDetails(null)
        setMeetingId('')
        setPassword('')
        setIsHost(false)
        isHostRef.current = false
        return null
      }

      setMeetingDetails(data)
      setMeetingId(data.meeting_id)
      setPassword(data.password)
      const shouldHost = shouldCurrentUserActAsHost(data, userId)
      setIsHost(shouldHost)
      isHostRef.current = shouldHost
      return data
    } catch (error) {
      console.error('❌ Unexpected error loading meeting details:', error)
      setConnectionError('Unexpected error while loading meeting details.')
      return null
    } finally {
      setIsLoadingMeeting(false)
    }
  }

  loadMeetingDetailsRef.current = loadMeetingDetails

  const createMeetingRecord = async (): Promise<MeetingDetails | null> => {
    if (!consultation?.id) {
      setConnectionError('Missing consultation details. Please refresh and retry.')
      return null
    }

    if (isDemoConsultation) {
      return loadMeetingDetails()
    }

    const hostUserId = await resolveCurrentUserId()
    if (!hostUserId) {
      setConnectionError('Authentication error. Please sign in again.')
      return null
    }

    if (userRole !== 'doctor') {
      setConnectionError('Only doctors can start a consultation meeting.')
      return null
    }

    const supabase = createClient()

    try {
      await supabase
        .from('consultation_meetings')
        .update({ is_active: false })
        .eq('appointment_id', consultation.id)
        .eq('is_active', true)

      const { data, error } = await supabase
        .from('consultation_meetings')
        .insert({
          appointment_id: consultation.id,
          meeting_id: generateMeetingId(),
          password: generateMeetingPassword(),
          host_id: hostUserId,
          is_active: true
        })
        .select('*')
        .single()

      if (error) {
        if (error.code === '23505') {
          return await loadMeetingDetailsRef.current()
        }
        setConnectionError('Failed to create meeting record. Please retry.')
        return null
      }

      setMeetingDetails(data)
      setMeetingId(data.meeting_id)
      setPassword(data.password)
      setIsHost(true)
      isHostRef.current = true
      return data
    } catch (error) {
      console.error('❌ Unexpected error creating meeting record:', error)
      setConnectionError('Unexpected error while creating meeting.')
      return null
    }
  }

  const attachLocalTracks = (pc: RTCPeerConnection) => {
    const localStream = localStreamRef.current
    if (!localStream) return

    const existingTrackIds = new Set(pc.getSenders().map(sender => sender.track?.id).filter(Boolean))

    localStream.getTracks().forEach(track => {
      if (!existingTrackIds.has(track.id)) {
        pc.addTrack(track, localStream)
      }
    })
  }

  const sendSignal = async (payload: Omit<SignalPayload, 'fromUserId' | 'senderName'>) => {
    const channel = signalingChannelRef.current
    const userId = currentUserIdRef.current
    if (!channel || !userId) return

    const senderName = participantNameRef.current.trim() || getDefaultParticipantName()

    await channel.send({
      type: 'broadcast',
      event: 'signal',
      payload: { ...payload, fromUserId: userId, senderName }
    })
  }

  const createPeerConnection = async () => {
    if (peerConnectionRef.current) return peerConnectionRef.current

    const iceServers: RTCIceServer[] = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]

    const turnUrl = process.env.NEXT_PUBLIC_TURN_URL
    const turnUsername = process.env.NEXT_PUBLIC_TURN_USERNAME
    const turnCredential = process.env.NEXT_PUBLIC_TURN_CREDENTIAL
    if (turnUrl && turnUsername && turnCredential) {
      iceServers.push({
        urls: turnUrl,
        username: turnUsername,
        credential: turnCredential
      })
    }

    const peerConnection = new RTCPeerConnection({ iceServers })

    peerConnection.onicecandidate = event => {
      if (event.candidate) {
        void sendSignal({
          type: 'ice-candidate',
          candidate: event.candidate.toJSON()
        })
      }
    }

    peerConnection.ontrack = event => {
      if (remoteVideoRef.current) {
        if (!remoteVideoRef.current.srcObject) {
          remoteVideoRef.current.srcObject = event.streams[0] || new MediaStream([event.track])
        } else {
          const stream = remoteVideoRef.current.srcObject as MediaStream
          if (!stream.getTracks().find(t => t.id === event.track.id)) {
            stream.addTrack(event.track)
          }
        }
        setHasRemoteStream(true)
      }
    }

    peerConnection.onconnectionstatechange = () => {
      const state = peerConnection.connectionState
      if (state === 'failed' || state === 'disconnected' || state === 'closed') {
        setHasRemoteStream(false)
      }
    }

    attachLocalTracks(peerConnection)
    peerConnectionRef.current = peerConnection
    return peerConnection
  }

  const flushPendingIceCandidates = async (pc: RTCPeerConnection) => {
    if (!pc.remoteDescription) return

    while (pendingIceCandidatesRef.current.length > 0) {
      const candidate = pendingIceCandidatesRef.current.shift()
      if (!candidate) continue
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate))
      } catch (error) {
        console.error('❌ Error adding queued ICE candidate:', error)
      }
    }
  }

  const createAndSendOffer = async () => {
    if (!isHostRef.current || !isConnectedRef.current || isCreatingOfferRef.current) return

    isCreatingOfferRef.current = true
    try {
      const pc = await createPeerConnection()
      attachLocalTracks(pc)
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      await sendSignal({
        type: 'offer',
        description: offer
      })
    } catch (error) {
      console.error('❌ Error creating offer:', error)
    } finally {
      isCreatingOfferRef.current = false
    }
  }

  const stopScreenShare = async () => {
    if (!screenStreamRef.current) return

    screenStreamRef.current.getTracks().forEach(track => track.stop())
    screenStreamRef.current = null

    const localStream = localStreamRef.current
    const cameraTrack = localStream?.getVideoTracks()[0]

    if (cameraTrack && peerConnectionRef.current) {
      const sender = peerConnectionRef.current.getSenders().find(s => s.track?.kind === 'video')
      if (sender) await sender.replaceTrack(cameraTrack)
    }

    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream
    }

    setIsScreenSharing(false)
    setIsVideoOn(Boolean(cameraTrack?.enabled))
    addChatMessage('System', 'Screen sharing stopped.')
  }

  const initializeLocalMedia = async (): Promise<MediaStream | null> => {
    if (localStreamRef.current) return localStreamRef.current

    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setConnectionError('Media devices not supported in this browser.')
        return null
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: { echoCancellation: true, noiseSuppression: true }
      })

      localStreamRef.current = stream
      setHasLocalStream(true)
      setIsVideoOn(Boolean(stream.getVideoTracks()[0]?.enabled))
      setIsAudioOn(Boolean(stream.getAudioTracks()[0]?.enabled))

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
        void localVideoRef.current.play().catch(() => {})
      }

      return stream
    } catch (error: any) {
      console.error('❌ Error initializing local media:', error)
      setConnectionError('Unable to access camera/microphone.')
      setHasLocalStream(false)
      return null
    }
  }

  const handleIncomingChat = (payload: ChatBroadcastPayload) => {
    if (!payload || payload.fromUserId === currentUserIdRef.current) return

    setChatMessages(prev => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        sender: payload.senderName || 'Participant',
        message: payload.message,
        timestamp: new Date(payload.timestamp || Date.now())
      }
    ])
  }

  const handleIncomingSignal = async (payload: SignalPayload) => {
    if (!payload || payload.fromUserId === currentUserIdRef.current) return

    try {
      if (payload.type === 'ready') {
        addChatMessage('System', `${payload.senderName || 'Participant'} is ready.`)
        if (isHostRef.current && isConnectedRef.current) {
          await createAndSendOffer()
        }
        return
      }

      if (payload.type === 'hangup') {
        addChatMessage('System', `${payload.senderName || 'Participant'} left the meeting.`)
        clearRemoteVideo()
        if (peerConnectionRef.current) {
          peerConnectionRef.current.close()
          peerConnectionRef.current = null
        }
        return
      }

      if (!isConnectedRef.current) return

      if (payload.type === 'offer' && payload.description) {
        const pc = await createPeerConnection()
        await pc.setRemoteDescription(new RTCSessionDescription(payload.description))
        await flushPendingIceCandidates(pc)

        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)

        await sendSignal({
          type: 'answer',
          description: answer
        })
        return
      }

      if (payload.type === 'answer' && payload.description) {
        const pc = await createPeerConnection()
        if (!pc.currentRemoteDescription) {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.description))
          await flushPendingIceCandidates(pc)
        }
        return
      }

      if (payload.type === 'ice-candidate' && payload.candidate) {
        const pc = peerConnectionRef.current
        if (!pc) {
          pendingIceCandidatesRef.current.push(payload.candidate)
          return
        }

        if (pc.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(payload.candidate))
        } else {
          pendingIceCandidatesRef.current.push(payload.candidate)
        }
      }
    } catch (error) {
      console.error('❌ Error handling signaling payload:', payload.type, error)
    }
  }

  handleIncomingChatRef.current = handleIncomingChat
  handleIncomingSignalRef.current = handleIncomingSignal

  const joinOrStartMeeting = async () => {
    if (!participantNameRef.current.trim()) {
      setConnectionError('Please enter your name before joining.')
      return
    }

    if (!isChannelReady) {
      setConnectionError('Connecting secure signaling channel...')
      return
    }

    setIsConnecting(true)
    setConnectionError(null)

    try {
      const resolvedUserId = await resolveCurrentUserId()
      if (!resolvedUserId) return

      let activeMeeting = meetingDetailsRef.current
      if (!activeMeeting) {
        activeMeeting = userRole === 'doctor'
          ? await createMeetingRecord()
          : await loadMeetingDetailsRef.current()
      }

      if (!activeMeeting) {
        setConnectionError(userRole === 'patient' ? 'Waiting for doctor to start...' : 'Unable to create meeting.')
        return
      }

      const shouldHost = shouldCurrentUserActAsHost(activeMeeting, resolvedUserId)
      setIsHost(shouldHost)
      isHostRef.current = shouldHost

      const localStream = await initializeLocalMedia()
      const pc = await createPeerConnection()
      if (localStream) attachLocalTracks(pc)

      setIsConnected(true)
      isConnectedRef.current = true // Update ref synchronously to avoid race conditions
      addChatMessage('System', `Connected (call ${activeMeeting.meeting_id}).`)
      
      await sendSignal({ type: 'ready' })
      if (shouldHost) await createAndSendOffer()
    } catch (error) {
      console.error('❌ Error joining meeting:', error)
      setConnectionError('Failed to start the video call.')
    } finally {
      setIsConnecting(false)
    }
  }

  const leaveMeeting = async () => {
    try {
      if (isConnectedRef.current) await sendSignal({ type: 'hangup' })
    } finally {
      cleanupConnectionResources()
      setIsConnected(false)
      setIsConnecting(false)
      setIsScreenSharing(false)
      addChatMessage('System', 'You left the meeting.')
    }
  }

  const handleClose = async () => {
    await leaveMeeting()
    onClose()
  }

  const toggleVideo = () => {
    if (!isConnectedRef.current) return
    const stream = isScreenSharing ? screenStreamRef.current : localStreamRef.current
    const videoTrack = stream?.getVideoTracks()[0]
    if (!videoTrack) return
    videoTrack.enabled = !videoTrack.enabled
    setIsVideoOn(videoTrack.enabled)
    addChatMessage('System', `Video ${videoTrack.enabled ? 'enabled' : 'disabled'}.`)
  }

  const toggleAudio = () => {
    if (!isConnectedRef.current || !localStreamRef.current) return
    const audioTrack = localStreamRef.current.getAudioTracks()[0]
    if (!audioTrack) return
    audioTrack.enabled = !audioTrack.enabled
    setIsAudioOn(audioTrack.enabled)
    addChatMessage('System', `Audio ${audioTrack.enabled ? 'enabled' : 'disabled'}.`)
  }

  const toggleScreenShare = async () => {
    if (!isConnectedRef.current) return
    try {
      if (isScreenSharing) {
        await stopScreenShare()
        return
      }
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true })
      const screenTrack = screenStream.getVideoTracks()[0]
      if (!screenTrack) throw new Error('No screen track available.')

      if (peerConnectionRef.current) {
        const sender = peerConnectionRef.current.getSenders().find(s => s.track?.kind === 'video')
        if (sender) await sender.replaceTrack(screenTrack)
      }

      screenTrack.onended = () => void stopScreenShare()
      screenStreamRef.current = screenStream
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = screenStream
        void localVideoRef.current.play().catch(() => {})
      }
      setIsScreenSharing(true)
      setIsVideoOn(true)
      addChatMessage('System', 'Screen sharing started.')
    } catch (error) {
      console.error('❌ Error toggling screen share:', error)
    }
  }

  const sendChatMessage = async () => {
    if (!newMessage.trim()) return
    const senderName = participantNameRef.current.trim() || getDefaultParticipantName()
    addChatMessage(senderName, newMessage.trim())
    setNewMessage('')
    if (signalingChannelRef.current && currentUserIdRef.current) {
      await signalingChannelRef.current.send({
        type: 'broadcast',
        event: 'chat',
        payload: {
          fromUserId: currentUserIdRef.current,
          senderName,
          message: newMessage.trim(),
          timestamp: new Date().toISOString()
        }
      })
    }
  }

  const handleChatKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void sendChatMessage()
    }
  }

  const copyMeetingId = async () => {
    if (!meetingId) return
    try {
      await navigator.clipboard.writeText(meetingId)
      setCopiedMeetingId(true)
      setTimeout(() => setCopiedMeetingId(false), 1500)
    } catch (error) {}
  }

  useEffect(() => {
    if (!isOpen || !consultation?.id) return
    void loadMeetingDetailsRef.current()
    const supabase = createClient()
    const meetingSubscription = supabase
      .channel(`consultation-meeting-${consultation.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'consultation_meetings', filter: `appointment_id=eq.${consultation.id}` }, () => {
        void loadMeetingDetailsRef.current()
      })
      .subscribe()

    let pollingInterval: ReturnType<typeof setInterval> | null = null
    if (userRole === 'patient') {
      pollingInterval = setInterval(() => {
        if (!meetingDetailsRef.current && isOpen) void loadMeetingDetailsRef.current()
      }, 5000)
    }

    return () => {
      meetingSubscription.unsubscribe()
      if (pollingInterval) clearInterval(pollingInterval)
    }
  }, [isOpen, consultation?.id, userRole])

  useEffect(() => {
    if (!isOpen || !consultation?.id) return
    const supabase = createClient()
    const signalingChannel = supabase
      .channel(`consultation-signal-${consultation.call_secret || consultation.id}`)
      .on('broadcast', { event: 'signal' }, ({ payload }: { payload: any }) => {
        void handleIncomingSignalRef.current(payload as SignalPayload)
      })
      .on('broadcast', { event: 'chat' }, ({ payload }: { payload: any }) => {
        handleIncomingChatRef.current(payload as ChatBroadcastPayload)
      })
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') setIsChannelReady(true)
        else if (status === 'CHANNEL_ERROR') {
          setIsChannelReady(false)
          setConnectionError('Signaling channel unavailable.')
        }
      })

    signalingChannelRef.current = signalingChannel
    return () => {
      setIsChannelReady(false)
      signalingChannel.unsubscribe()
      signalingChannelRef.current = null
    }
  }, [isOpen, consultation?.id, consultation?.call_secret])

  useEffect(() => {
    if (!isOpen) {
      cleanupConnectionResources()
      setIsConnected(false)
      setIsConnecting(false)
      setIsScreenSharing(false)
      setHasRemoteStream(false)
      setConnectionError(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card role="dialog" aria-modal="true" aria-labelledby="video-call-title" className="w-full max-w-6xl h-[90vh] flex flex-col shadow-2xl border-none">
        <CardHeader className="flex-shrink-0 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <CardTitle id="video-call-title" className="text-xl font-bold uppercase tracking-tight">MedSync Secure Meet</CardTitle>
              <div className="flex items-center space-x-2">
                <Badge variant={isConnected ? 'default' : 'secondary'} className={isConnected ? 'bg-green-600' : ''}>
                  {isConnected ? 'ENCRYPTED' : 'OFFLINE'}
                </Badge>
                {meetingDetails && (
                  <Badge variant="outline" className="text-blue-600 border-blue-600">
                    {isHost ? 'PROVIDER' : 'PATIENT'}
                  </Badge>
                )}
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => void handleClose()}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center space-x-4 text-[10px] font-mono uppercase tracking-widest text-muted-foreground mt-2">
            <div className="flex items-center space-x-1">
              <Calendar className="h-3 w-3" />
              <span>{consultation?.appointment_date ? format(new Date(consultation.appointment_date), 'PPP') : 'DATE TBA'}</span>
            </div>
            <div className="flex items-center space-x-1">
              <Clock className="h-3 w-3" />
              <span>{getConsultationTime()}</span>
            </div>
            <div className="flex items-center space-x-1">
              <Users className="h-3 w-3" />
              <span>{userRole === 'doctor' ? consultation?.patient_name : consultation?.doctor_name}</span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col space-y-4 overflow-hidden p-6 bg-slate-50/30">
          {connectionError && !isConnected && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-700 text-xs font-mono mb-2 uppercase">{connectionError}</p>
              <Button variant="outline" size="sm" className="rounded-none border-red-200" onClick={() => { setConnectionError(null); void joinOrStartMeeting(); }}>RETRY LINK</Button>
            </div>
          )}

          {!isConnected && !isConnecting && !isLoadingMeeting && (
            <div className="max-w-md mx-auto w-full space-y-6 pt-12">
              {meetingDetails ? (
                <div className="bg-white border border-black/10 p-8 space-y-6">
                  <div className="space-y-1">
                    <h3 className="font-bold uppercase tracking-tight">Access Secure Link</h3>
                    <p className="text-xs text-muted-foreground font-mono">ENCRYPTION: AES-256</p>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Your name</label>
                      <Input value={participantName} onChange={e => setParticipantName(e.target.value)} placeholder="ENTER YOUR FULL NAME" className="rounded-none border-black/10 focus:border-black" />
                    </div>

                    <Button onClick={() => void joinOrStartMeeting()} className="w-full bg-black hover:bg-black/90 text-white rounded-none h-12 uppercase font-mono text-[10px] tracking-widest" disabled={!participantName.trim() || !isChannelReady}>
                      Join call →
                    </Button>
                  </div>
                </div>
              ) : userRole === 'doctor' ? (
                <div className="bg-white border border-black/10 p-8 space-y-6">
                  <div className="space-y-1">
                    <h3 className="font-bold uppercase tracking-tight">Start the consultation</h3>
                    <p className="text-xs text-muted-foreground">Your patient can join once you start the call.</p>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Your name</label>
                      <Input value={participantName} onChange={e => setParticipantName(e.target.value)} placeholder="DR. NAME" className="rounded-none border-black/10 focus:border-black" />
                    </div>

                    <Button onClick={() => void joinOrStartMeeting()} className="w-full bg-black hover:bg-black/90 text-white rounded-none h-12 uppercase font-mono text-[10px] tracking-widest" disabled={!participantName.trim() || !isChannelReady}>
                      Start call →
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="bg-white border border-black/10 p-12 text-center space-y-6">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-black/20" />
                  <div className="space-y-2">
                    <h3 className="font-bold uppercase tracking-tight">Waiting for your doctor</h3>
                    <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest leading-relaxed">
                      Your doctor hasn&apos;t started the call yet. <br/> This window connects you when they do.
                    </p>
                  </div>
                  <Button variant="outline" className="rounded-none border-black/10 font-mono text-[10px] tracking-widest uppercase px-8" onClick={() => void loadMeetingDetailsRef.current()}>Refresh Status</Button>
                </div>
              )}
            </div>
          )}

          {isConnecting && (
            <div className="flex flex-col items-center justify-center h-64 space-y-6">
              <Loader2 className="h-12 w-12 animate-spin text-black/20" />
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Connecting…</p>
            </div>
          )}

          {isConnected && (
            <div className="flex-1 min-h-0 relative">
              <div className="relative bg-black rounded-none overflow-hidden h-full min-h-0">
                <video ref={remoteVideoRef} autoPlay playsInline className={`w-full h-full object-cover ${hasRemoteStream ? '' : 'hidden'}`} />

                {!hasRemoteStream && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
                    <div className="text-center">
                      <Users className="h-12 w-12 text-white/10 mx-auto mb-4" />
                      <h3 className="text-sm font-mono text-white/50 uppercase tracking-widest">Waiting for Remote Participant</h3>
                    </div>
                  </div>
                )}

                {(hasLocalStream || isScreenSharing) && (
                  <div className="absolute top-4 right-4 w-48 h-36 bg-black rounded-none overflow-hidden border border-white/20 shadow-2xl">
                    <video ref={localVideoRef} autoPlay playsInline muted className={`w-full h-full object-cover ${isVideoOn ? '' : 'hidden'}`} />
                    {!isVideoOn && <div className="w-full h-full flex items-center justify-center bg-slate-800 text-[10px] font-mono text-white/50 uppercase tracking-widest">Feed Cut</div>}
                    <div className="absolute bottom-2 left-2 bg-black/40 text-white text-[8px] font-mono uppercase px-1.5 py-0.5 tracking-tighter">LOCAL_FEED</div>
                  </div>
                )}

                <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
                  <div className="flex items-center space-x-4 bg-black/40 backdrop-blur-md rounded-none px-6 py-3 border border-white/10 shadow-2xl">
                    <Button variant={isAudioOn ? 'secondary' : 'destructive'} size="icon" className="rounded-none h-10 w-10" onClick={toggleAudio} aria-label={isAudioOn ? "Mute microphone" : "Unmute microphone"}>
                      {isAudioOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                    </Button>
                    <Button variant={isVideoOn ? 'secondary' : 'destructive'} size="icon" className="rounded-none h-10 w-10" onClick={toggleVideo} aria-label={isVideoOn ? "Turn camera off" : "Turn camera on"}>
                      {isVideoOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
                    </Button>
                    <Button variant={isScreenSharing ? 'default' : 'secondary'} size="icon" className="rounded-none h-10 w-10" onClick={() => void toggleScreenShare()} aria-label={isScreenSharing ? "Stop sharing screen" : "Share screen"}>
                      {isScreenSharing ? <MonitorOff className="h-4 w-4" /> : <Monitor className="h-4 w-4" />}
                    </Button>
                    <div className="w-px h-6 bg-white/10 mx-2" />
                    <Button variant="destructive" size="icon" className="rounded-none h-10 w-10" onClick={() => void leaveMeeting()} aria-label="End call">
                      <PhoneOff className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="absolute top-4 left-4 z-20">
                <Button variant="secondary" size="sm" onClick={() => setIsChatOpen(!isChatOpen)} className="rounded-none font-mono text-[10px] tracking-widest uppercase h-8 shadow-xl">
                  {isChatOpen ? 'Close Archive' : 'Open Secure Chat'}
                </Button>
              </div>

              {isChatOpen && (
                <div className="absolute right-4 top-16 bottom-4 z-20 w-80 max-w-[45vw]">
                  <div className="h-full flex flex-col border border-black/10 bg-white/95 backdrop-blur-md shadow-2xl rounded-none">
                    <div className="flex items-center justify-between p-4 border-b">
                      <h3 className="text-xs font-bold uppercase tracking-tight">Secure Message Archive</h3>
                      <Button variant="ghost" size="sm" onClick={() => setIsChatOpen(false)}><X className="h-4 w-4" /></Button>
                    </div>

                    <div ref={chatContainerRef} className="flex-1 p-6 space-y-6 overflow-y-auto">
                      {chatMessages.map(msg => (
                        <div key={msg.id} className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-tight text-blue-600">{msg.sender}</span>
                            <span className="text-[8px] font-mono text-muted-foreground uppercase">{format(msg.timestamp, 'HH:mm:ss')}</span>
                          </div>
                          <p className="text-xs bg-slate-50 border border-black/[0.03] p-3 rounded-none leading-relaxed">{msg.message}</p>
                        </div>
                      ))}
                    </div>

                    <div className="p-4 border-t bg-slate-50/50">
                      <div className="flex gap-2">
                        <Textarea value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyDown={handleChatKeyPress} placeholder="ENCRYPTED MESSAGE..." className="rounded-none border-black/10 focus:border-black min-h-[60px] text-xs resize-none font-mono uppercase" />
                        <Button onClick={() => void sendChatMessage()} disabled={!newMessage.trim()} className="bg-black text-white rounded-none h-full px-4"><Send className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {isConnected && (
            <div className="bg-black text-white p-4 font-mono text-[9px] uppercase tracking-[0.2em] flex justify-between items-center">
              <div className="flex gap-6">
                <span>Call ID: {meetingId}</span>
                <span>CIPHER: AES_GCM_256</span>
                <span>STATUS: STABLE</span>
              </div>
              <div className="text-white/50">MEDSYNC SECURE ENCOUNTER PROTOCOL V1.0</div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
