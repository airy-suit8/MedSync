import { NextRequest, NextResponse } from 'next/server'
import { verifySession, unauthorizedResponse } from '@/lib/api-utils'

export async function POST(request: NextRequest) {
  try {
    // Verify session
    const { user } = await verifySession()
    if (!user) {
      return unauthorizedResponse()
    }

    const { prompt, context, provider } = await request.json()

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }

    if (typeof prompt !== 'string' || prompt.length > 4000) {
      return NextResponse.json(
        { error: 'Prompt must be a string of 4000 characters or fewer' },
        { status: 400 },
      )
    }

    // =========================
    // GEMINI PROVIDER
    // =========================
    if (provider === 'gemini') {
      const GEMINI_API_KEY = process.env.GEMINI_API_KEY

      if (!GEMINI_API_KEY) {
        return NextResponse.json(
          {
            error: {
              message: 'Gemini API key not configured on server.',
              details: 'Set GEMINI_API_KEY in server environment variables.'
            }
          },
          { status: 500 }
        )
      }

      const fullPrompt = context
        ? `${context}\n\n${prompt}`
        : prompt

      // Keep to currently supported/known working model IDs, newest first.
      const models = ['gemini-2.5-flash', 'gemini-2.0-flash']

      let lastError: any = null
      let isTransient = false

      for (const model of models) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`

          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  role: 'user',
                  parts: [{ text: fullPrompt }]
                }
              ],
              generationConfig: {
                temperature: 0.7,
                topP: 0.9,
                maxOutputTokens: 1024
              }
            })
          })

          const raw = await response.text()
          let data: any = null
          try {
            data = raw ? JSON.parse(raw) : null
          } catch {
            data = null
          }

          if (response.ok && !data?.error) {
            const text =
              data?.candidates?.[0]?.content?.parts?.[0]?.text || ''

            return NextResponse.json({
              provider: 'gemini',
              model,
              text
            })
          }

          lastError =
            data?.error || {
              message: `Model ${model} failed (${response.status})`,
              details:
                raw?.startsWith('<!DOCTYPE') || raw?.startsWith('<html')
                  ? 'Provider returned non-JSON response'
                  : raw,
            }

          console.warn(`Gemini ${model} failed:`, lastError)

          // Quota and availability failures get a "try again" response below.
          if (
            response.status === 429 ||
            response.status === 503 ||
            lastError?.status === 'RESOURCE_EXHAUSTED' ||
            lastError?.status === 'UNAVAILABLE'
          ) {
            isTransient = true
          }
        } catch (err: any) {
          lastError = err
          isTransient = true
        }
      }

      if (isTransient) {
        return NextResponse.json(
          {
            error: {
              message: 'AI assistant temporarily unavailable. Please try again shortly.',
              details: lastError?.message || 'Gemini request failed.',
            }
          },
          {
            status:
              lastError?.status === 'RESOURCE_EXHAUSTED' || lastError?.code === 429
                ? 429
                : 503
          }
        )
      }

      return NextResponse.json(
        {
          error: {
            message: 'All Gemini models failed',
            details: lastError?.message || lastError || 'Unknown Gemini error',
          },
        },
        { status: 500 }
      )
    }

    // =========================
    // INVALID PROVIDER
    // =========================
    return NextResponse.json(
      { error: 'Invalid provider' },
      { status: 400 }
    )
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}