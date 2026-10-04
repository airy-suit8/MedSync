import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { callGeminiAPI } from '@/lib/gemini'

describe('callGeminiAPI', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('returns trimmed text from a successful proxy response', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ text: '  Review the result.  ' }), { status: 200 }))

    await expect(callGeminiAPI('Summarize this report', 'doctor context')).resolves.toEqual({
      success: true,
      message: 'Review the result.',
    })
    expect(fetch).toHaveBeenCalledWith('/api/chat', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ provider: 'gemini', prompt: 'Summarize this report', context: 'doctor context' }),
      signal: expect.any(AbortSignal),
    }))
  })

  it('returns a controlled failure for an HTTP API error', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('service unavailable', { status: 503 }))

    const result = await callGeminiAPI('Explain this result')
    expect(result.success).toBe(false)
    expect(result.error).toContain('Proxy request failed: 503')
    expect(result.message).toContain('trouble connecting')
  })

  it('aborts and returns a controlled failure when the request times out', async () => {
    vi.useFakeTimers()
    vi.mocked(fetch).mockImplementation((_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true })
    }))

    const pending = callGeminiAPI('Explain this result')
    await vi.advanceTimersByTimeAsync(15_000)
    const result = await pending

    expect(result.success).toBe(false)
    expect(result.error).toBe('Gemini request timed out.')
    expect(vi.mocked(fetch).mock.calls[0][1]?.signal?.aborted).toBe(true)
  })

  it.each(['', '   ', null])('rejects an empty or malformed prompt (%s) without a network call', async (prompt) => {
    const result = await callGeminiAPI(prompt as string)

    expect(result).toMatchObject({ success: false, error: 'Prompt is required.' })
    expect(fetch).not.toHaveBeenCalled()
  })
})
