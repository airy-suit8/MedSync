"use client"

import { useEffect, useRef, useState } from "react"
import { Mic, Square } from "lucide-react"
import { Button } from "@/components/ui/button"

// Browser speech recognition (free; Chrome, Edge and Safari). The browser sends the audio
// to its own speech service (Google in Chrome, Microsoft in Edge, Apple in Safari), so the
// button says so. Hidden where the browser has no speech recognition (e.g. Firefox).
type Recognition = {
  lang: string
  continuous: boolean
  interimResults: boolean
  start(): void
  stop(): void
  onresult: ((event: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
}

function recognitionClass(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }
  return w.SpeechRecognition || w.webkitSpeechRecognition || null
}

export default function DictationButton({ onText, label }: { onText: (text: string) => void; label: string }) {
  const [supported, setSupported] = useState(false)
  const [listening, setListening] = useState(false)
  const recognition = useRef<Recognition | null>(null)

  useEffect(() => setSupported(recognitionClass() !== null), [])
  useEffect(() => () => recognition.current?.stop(), [])

  if (!supported) return null

  const toggle = () => {
    if (listening) {
      recognition.current?.stop()
      return
    }
    const Recognizer = recognitionClass()
    if (!Recognizer) return
    const r = new Recognizer()
    r.lang = navigator.language || "en-IN"
    r.continuous = true
    r.interimResults = false
    r.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) onText(result[0].transcript.trim())
      }
    }
    r.onend = () => setListening(false)
    r.onerror = () => setListening(false)
    recognition.current = r
    r.start()
    setListening(true)
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={toggle}
      aria-pressed={listening}
      aria-label={listening ? `Stop dictating ${label}` : `Dictate ${label}`}
      title="Uses your browser's speech service (Google in Chrome, Microsoft in Edge)"
      className={`h-8 rounded-none px-3 font-mono text-[11px] uppercase tracking-widest ${listening ? "border-red-600 text-red-700" : "border-black/30"}`}
    >
      {listening ? <Square className="mr-1.5 h-3 w-3" aria-hidden="true" /> : <Mic className="mr-1.5 h-3 w-3" aria-hidden="true" />}
      {listening ? "Stop" : "Dictate"}
    </Button>
  )
}
