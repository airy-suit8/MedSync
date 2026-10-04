// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

vi.mock('@/lib/supabase', () => ({ createClient: vi.fn(() => ({})) }))
import { useWebRTC } from '@/hooks/use-webrtc'

describe('useWebRTC without an active call', () => {
  const options = { consultationId: undefined, isOpen: false, isHost: false, participantName: '', currentUserId: null }
  it('starts disconnected with media disabled', () => {
    const { result } = renderHook(() => useWebRTC(options))
    expect(result.current.isConnected).toBe(false)
    expect(result.current.isChannelReady).toBe(false)
    expect(result.current.hasLocalStream).toBe(false)
    expect(result.current.hasRemoteStream).toBe(false)
    expect(result.current.isVideoOn).toBe(true)
    expect(result.current.isAudioOn).toBe(true)
    expect(result.current.isScreenSharing).toBe(false)
  })
  it('ignores toggles and sends safely when there is no connection/channel', async () => {
    const { result } = renderHook(() => useWebRTC(options))
    act(() => { result.current.toggleVideo(); result.current.toggleAudio() })
    await act(async () => { await result.current.sendSignal({ type: 'ready' }); await result.current.sendChat({ fromUserId: 'x', senderName: 'x', message: 'hi', timestamp: 't' }) })
    expect(result.current.isVideoOn).toBe(true)
    expect(result.current.isAudioOn).toBe(true)
  })
})
