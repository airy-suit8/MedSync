'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SignalPayload {
  type: 'ready' | 'offer' | 'answer' | 'ice-candidate' | 'hangup'
  fromUserId: string
  senderName: string
  description?: RTCSessionDescriptionInit
  candidate?: RTCIceCandidateInit
}

export interface ChatBroadcastPayload {
  fromUserId: string
  senderName: string
  message: string
  timestamp: string
}

export interface UseWebRTCOptions {
  consultationId: string | undefined
  isOpen: boolean
  isHost: boolean
  participantName: string
  currentUserId: string | null
}

export interface UseWebRTCReturn {
  // State
  isConnected: boolean
  isChannelReady: boolean
  hasLocalStream: boolean
  hasRemoteStream: boolean
  isVideoOn: boolean
  isAudioOn: boolean
  isScreenSharing: boolean

  // Refs for video elements
  localVideoRef: React.RefObject<HTMLVideoElement | null>
  remoteVideoRef: React.RefObject<HTMLVideoElement | null>

  // Actions
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  toggleVideo: () => void
  toggleAudio: () => void
  toggleScreenShare: () => Promise<void>
  sendSignal: (payload: Omit<SignalPayload, 'fromUserId' | 'senderName'>) => Promise<void>
  sendChat: (payload: ChatBroadcastPayload) => Promise<void>

  // Signaling channel ref (for chat broadcast)
  signalingChannelRef: React.RefObject<RealtimeChannel | null>

  // Callbacks for the component to hook into
  onSignal: (handler: (payload: SignalPayload) => void) => void
  onChat: (handler: (payload: ChatBroadcastPayload) => void) => void
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useWebRTC({
  consultationId,
  isOpen,
  isHost,
  participantName,
  currentUserId,
}: UseWebRTCOptions): UseWebRTCReturn {
  // ─── State ───
  const [isConnected, setIsConnected] = useState(false)
  const [isChannelReady, setIsChannelReady] = useState(false)
  const [hasLocalStream, setHasLocalStream] = useState(false)
  const [hasRemoteStream, setHasRemoteStream] = useState(false)
  const [isVideoOn, setIsVideoOn] = useState(true)
  const [isAudioOn, setIsAudioOn] = useState(true)
  const [isScreenSharing, setIsScreenSharing] = useState(false)

  // ─── Refs ───
  const localVideoRef = useRef<HTMLVideoElement | null>(null)
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const screenStreamRef = useRef<MediaStream | null>(null)
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const signalingChannelRef = useRef<RealtimeChannel | null>(null)
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([])
  const isCreatingOfferRef = useRef(false)

  // Stable refs that track latest values (avoids stale closures)
  const isHostRef = useRef(isHost)
  const isConnectedRef = useRef(false)
  const currentUserIdRef = useRef(currentUserId)
  const participantNameRef = useRef(participantName)

  // External signal/chat handlers set by the component
  const onSignalRef = useRef<((p: SignalPayload) => void) | null>(null)
  const onChatRef = useRef<((p: ChatBroadcastPayload) => void) | null>(null)

  // ─── Sync refs ───
  useEffect(() => { isHostRef.current = isHost }, [isHost])
  useEffect(() => { isConnectedRef.current = isConnected }, [isConnected])
  useEffect(() => { currentUserIdRef.current = currentUserId }, [currentUserId])
  useEffect(() => { participantNameRef.current = participantName }, [participantName])

  // ─── Helpers ───

  const clearRemoteVideo = useCallback(() => {
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null
    setHasRemoteStream(false)
  }, [])

  const attachLocalTracks = useCallback((pc: RTCPeerConnection) => {
    const localStream = localStreamRef.current
    if (!localStream) return
    const existingTrackIds = new Set(
      pc.getSenders().map(s => s.track?.id).filter(Boolean)
    )
    localStream.getTracks().forEach(track => {
      if (!existingTrackIds.has(track.id)) {
        pc.addTrack(track, localStream)
      }
    })
  }, [])

  const sendSignalFn = useCallback(
    async (payload: Omit<SignalPayload, 'fromUserId' | 'senderName'>) => {
      const channel = signalingChannelRef.current
      const userId = currentUserIdRef.current
      if (!channel || !userId) return

      const senderName = participantNameRef.current.trim() || 'Participant'

      await channel.send({
        type: 'broadcast',
        event: 'signal',
        payload: { ...payload, fromUserId: userId, senderName },
      })
    },
    [],
  )

  const createPeerConnection = useCallback(async () => {
    if (peerConnectionRef.current) return peerConnectionRef.current

    const iceServers: RTCIceServer[] = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ]

    const turnUrl = process.env.NEXT_PUBLIC_TURN_URL
    const turnUsername = process.env.NEXT_PUBLIC_TURN_USERNAME
    const turnCredential = process.env.NEXT_PUBLIC_TURN_CREDENTIAL
    if (turnUrl && turnUsername && turnCredential) {
      iceServers.push({ urls: turnUrl, username: turnUsername, credential: turnCredential })
    }

    const pc = new RTCPeerConnection({ iceServers })

    pc.onicecandidate = event => {
      if (event.candidate) {
        void sendSignalFn({ type: 'ice-candidate', candidate: event.candidate.toJSON() })
      }
    }

    pc.ontrack = event => {
      const [stream] = event.streams
      if (stream && remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream
        setHasRemoteStream(true)
      }
    }

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState
      if (state === 'failed' || state === 'disconnected' || state === 'closed') {
        setHasRemoteStream(false)
      }
    }

    attachLocalTracks(pc)
    peerConnectionRef.current = pc
    return pc
  }, [attachLocalTracks, sendSignalFn])

  const flushPendingIceCandidates = useCallback(async (pc: RTCPeerConnection) => {
    if (!pc.remoteDescription) return
    while (pendingIceCandidatesRef.current.length > 0) {
      const candidate = pendingIceCandidatesRef.current.shift()
      if (!candidate) continue
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate))
      } catch (error) {
        console.error('Error adding queued ICE candidate:', error)
      }
    }
  }, [])

  const createAndSendOffer = useCallback(async () => {
    if (!isHostRef.current || !isConnectedRef.current || isCreatingOfferRef.current) return
    isCreatingOfferRef.current = true
    try {
      const pc = await createPeerConnection()
      attachLocalTracks(pc)
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      await sendSignalFn({ type: 'offer', description: offer })
    } catch (error) {
      console.error('Error creating offer:', error)
    } finally {
      isCreatingOfferRef.current = false
    }
  }, [createPeerConnection, attachLocalTracks, sendSignalFn])

  // ─── Media ───

  const initializeLocalMedia = useCallback(async (): Promise<MediaStream | null> => {
    if (localStreamRef.current) return localStreamRef.current
    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        return null
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: { echoCancellation: true, noiseSuppression: true },
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
    } catch (error) {
      console.error('Error initializing local media:', error)
      setHasLocalStream(false)
      return null
    }
  }, [])

  const stopScreenShare = useCallback(async () => {
    if (!screenStreamRef.current) return
    screenStreamRef.current.getTracks().forEach(t => t.stop())
    screenStreamRef.current = null

    const cameraTrack = localStreamRef.current?.getVideoTracks()[0]
    if (cameraTrack && peerConnectionRef.current) {
      const sender = peerConnectionRef.current.getSenders().find(s => s.track?.kind === 'video')
      if (sender) await sender.replaceTrack(cameraTrack)
    }
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current
    }
    setIsScreenSharing(false)
    setIsVideoOn(Boolean(cameraTrack?.enabled))
  }, [])

  // ─── Signaling handler (called by channel subscription) ───

  const handleIncomingSignal = useCallback(
    async (payload: SignalPayload) => {
      if (!payload || payload.fromUserId === currentUserIdRef.current) return

      // Forward to component handler first
      onSignalRef.current?.(payload)

      try {
        if (payload.type === 'ready') {
          if (isHostRef.current && isConnectedRef.current) {
            await createAndSendOffer()
          }
          return
        }

        if (payload.type === 'hangup') {
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
          await sendSignalFn({ type: 'answer', description: answer })
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
        console.error('Error handling signaling payload:', payload.type, error)
      }
    },
    [createPeerConnection, createAndSendOffer, flushPendingIceCandidates, sendSignalFn, clearRemoteVideo],
  )

  // ─── Cleanup ───

  const cleanupConnectionResources = useCallback(() => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => t.stop())
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
      localStreamRef.current.getTracks().forEach(t => t.stop())
      localStreamRef.current = null
    }
    pendingIceCandidatesRef.current = []
    clearRemoteVideo()
    setHasLocalStream(false)
  }, [clearRemoteVideo])

  // ─── Public actions ───

  const connect = useCallback(async () => {
    const localStream = await initializeLocalMedia()
    const pc = await createPeerConnection()
    if (localStream) attachLocalTracks(pc)
    setIsConnected(true)
    await sendSignalFn({ type: 'ready' })
    if (isHostRef.current) await createAndSendOffer()
  }, [initializeLocalMedia, createPeerConnection, attachLocalTracks, sendSignalFn, createAndSendOffer])

  const disconnect = useCallback(async () => {
    try {
      if (isConnectedRef.current) await sendSignalFn({ type: 'hangup' })
    } finally {
      cleanupConnectionResources()
      setIsConnected(false)
      setIsScreenSharing(false)
    }
  }, [sendSignalFn, cleanupConnectionResources])

  const toggleVideo = useCallback(() => {
    if (!isConnectedRef.current) return
    const stream = isScreenSharing ? screenStreamRef.current : localStreamRef.current
    const videoTrack = stream?.getVideoTracks()[0]
    if (!videoTrack) return
    videoTrack.enabled = !videoTrack.enabled
    setIsVideoOn(videoTrack.enabled)
  }, [isScreenSharing])

  const toggleAudio = useCallback(() => {
    if (!isConnectedRef.current || !localStreamRef.current) return
    const audioTrack = localStreamRef.current.getAudioTracks()[0]
    if (!audioTrack) return
    audioTrack.enabled = !audioTrack.enabled
    setIsAudioOn(audioTrack.enabled)
  }, [])

  const toggleScreenShare = useCallback(async () => {
    if (!isConnectedRef.current) return
    if (isScreenSharing) {
      await stopScreenShare()
      return
    }
    try {
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
    } catch (error) {
      console.error('Error toggling screen share:', error)
    }
  }, [isScreenSharing, stopScreenShare])

  const sendChat = useCallback(async (payload: ChatBroadcastPayload) => {
    if (signalingChannelRef.current) {
      await signalingChannelRef.current.send({
        type: 'broadcast',
        event: 'chat',
        payload,
      })
    }
  }, [])

  // ─── Signaling channel lifecycle ───

  useEffect(() => {
    if (!isOpen || !consultationId) return
    const supabase = createClient()
    const channel = supabase
      .channel(`consultation-signal-${consultationId}`)
      .on('broadcast', { event: 'signal' }, ({ payload }: { payload: any }) => {
        void handleIncomingSignal(payload as SignalPayload)
      })
      .on('broadcast', { event: 'chat' }, ({ payload }: { payload: any }) => {
        const chatPayload = payload as ChatBroadcastPayload
        if (chatPayload.fromUserId !== currentUserIdRef.current) {
          onChatRef.current?.(chatPayload)
        }
      })
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') setIsChannelReady(true)
        else if (status === 'CHANNEL_ERROR') setIsChannelReady(false)
      })

    signalingChannelRef.current = channel

    return () => {
      setIsChannelReady(false)
      channel.unsubscribe()
      signalingChannelRef.current = null
    }
  }, [isOpen, consultationId, handleIncomingSignal])

  // ─── Sync local video preview when state changes ───

  useEffect(() => {
    if (!isConnected || !localVideoRef.current) return
    const previewStream = isScreenSharing
      ? (screenStreamRef.current || localStreamRef.current)
      : localStreamRef.current
    if (previewStream) {
      localVideoRef.current.srcObject = previewStream
      localVideoRef.current.style.transform = 'none'
      localVideoRef.current.style.webkitTransform = 'none'
      void localVideoRef.current.play().catch(() => {})
      setHasLocalStream(true)
    }
  }, [isConnected, isScreenSharing, isVideoOn])

  // ─── Cleanup on close ───

  useEffect(() => {
    if (!isOpen) {
      cleanupConnectionResources()
      setIsConnected(false)
      setIsScreenSharing(false)
      setHasRemoteStream(false)
    }
  }, [isOpen, cleanupConnectionResources])

  // ─── Handler registration ───

  const onSignal = useCallback((handler: (p: SignalPayload) => void) => {
    onSignalRef.current = handler
  }, [])

  const onChat = useCallback((handler: (p: ChatBroadcastPayload) => void) => {
    onChatRef.current = handler
  }, [])

  return {
    isConnected,
    isChannelReady,
    hasLocalStream,
    hasRemoteStream,
    isVideoOn,
    isAudioOn,
    isScreenSharing,
    localVideoRef,
    remoteVideoRef,
    connect,
    disconnect,
    toggleVideo,
    toggleAudio,
    toggleScreenShare,
    sendSignal: sendSignalFn,
    sendChat,
    signalingChannelRef,
    onSignal,
    onChat,
  }
}
