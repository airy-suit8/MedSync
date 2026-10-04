import { NextRequest, NextResponse } from 'next/server'
import { verifySession, unauthorizedResponse } from '@/lib/api-utils'

async function generateWithHuggingFace(prompt: string, context?: string) {
  const HF_API_KEY = process.env.HF_API_KEY
  if (!HF_API_KEY) {
    return {
      text: 'Hugging Face fallback is not configured on server.',
      status: 503,
      ok: false
    }
  }
  const HF_API_URL =
    'https://api-inference.huggingface.co/models/microsoft/DialoGPT-medium'

  const fullPrompt = context
    ? `${context}\n\nUser: ${prompt}`
    : `User: ${prompt}`

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }

  if (HF_API_KEY) {
    headers['Authorization'] = `Bearer ${HF_API_KEY}`
  }

  const response = await fetch(HF_API_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ inputs: fullPrompt })
  })

  const raw = await response.text()
  let data: any = null
  try {
    data = raw ? JSON.parse(raw) : null
  } catch {
    data = null
  }

  const text =
    data?.generated_text ||
    data?.[0]?.generated_text ||
    data?.error ||
    (raw?.startsWith('<!DOCTYPE') || raw?.startsWith('<html')
      ? 'Upstream AI provider returned a non-JSON error page. Please try again shortly.'
      : raw) ||
    'Upstream AI provider returned an empty response.'

  return { text, status: response.status, ok: response.ok }
}

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

      // Smart model selection with modern-first fallback
      const isComplex =
        prompt.length > 300 ||
        /explain|why|how|analyze|compare/i.test(prompt)

      // Keep to currently supported/known working model IDs.
      const models = isComplex
        ? ['gemini-2.5-flash', 'gemini-2.0-flash']
        : ['gemini-2.5-flash', 'gemini-2.0-flash']

      let lastError: any = null
      let shouldFallbackToHf = false

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

          if (response.ok && !data.error) {
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

          // Gemini-specific transient/quota failures should fallback to HF.
          if (
            response.status === 429 ||
            response.status === 503 ||
            lastError?.status === 'RESOURCE_EXHAUSTED' ||
            lastError?.status === 'UNAVAILABLE'
          ) {
            shouldFallbackToHf = true
          }
        } catch (err: any) {
          lastError = err
          shouldFallbackToHf = true
        }
      }

      if (shouldFallbackToHf) {
        const hfFallback = await generateWithHuggingFace(prompt, context)
        if (hfFallback.ok) {
          return NextResponse.json({
            provider: 'huggingface',
            model: 'microsoft/DialoGPT-medium',
            text: hfFallback.text,
            fallbackReason: lastError?.message || 'Gemini is temporarily unavailable'
          })
        }

        // If Gemini failed and HF fallback is unavailable, return clear actionable error.
        const fallbackDetails = [
          lastError?.message || 'Gemini request failed.',
          hfFallback.text || 'Hugging Face fallback unavailable.'
        ].join(' ')

        return NextResponse.json(
          {
            error: {
              message: 'AI provider temporarily unavailable.',
              details: fallbackDetails,
              suggestion:
                'Retry after the Gemini cooldown, or configure HF_API_KEY for fallback.'
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
    // HUGGING FACE PROVIDER
    // =========================
    if (provider === 'huggingface') {
      const result = await generateWithHuggingFace(prompt, context)
      if (!result.ok) {
        return NextResponse.json(
          {
            error: {
              message: 'Hugging Face request failed.',
              details: result.text
            }
          },
          { status: result.status || 503 }
        )
      }

      return NextResponse.json({
        provider: 'huggingface',
        model: 'microsoft/DialoGPT-medium',
        text: result.text
      })
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