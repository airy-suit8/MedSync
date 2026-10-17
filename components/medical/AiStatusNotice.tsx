"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Brain, RotateCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"

const AI_TEST_TYPES = ["x_ray", "mri", "blood_test", "urine_test"]

// Where a report's AI reading stands when there is no reading to show yet, with a way to
// run it (again). While it runs, the page refreshes itself until the reading arrives.
export default function AiStatusNotice({ reportId, status, testType, reviewed }: {
  reportId: string
  status: string
  testType: string
  reviewed: boolean
}) {
  const [busy, setBusy] = useState(false)
  const router = useRouter()
  const { toast } = useToast()
  const running = status === "running" || status === "pending"

  useEffect(() => {
    if (!running) return
    const timer = setInterval(() => router.refresh(), 10_000)
    return () => clearInterval(timer)
  }, [running, router])

  const run = async () => {
    setBusy(true)
    const response = await fetch("/api/ml-process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reportId, runAi: true }),
    })
    setBusy(false)
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      toast({ title: "Could not start the AI", description: body.error || `Error ${response.status}`, variant: "destructive" })
      return
    }
    toast({ title: "AI is reading the report", description: "This usually takes under a minute." })
    router.refresh()
  }

  const canRun = AI_TEST_TYPES.includes(testType) && !reviewed && !running
  const message = running ? "The AI is reading this report. This page updates when it's done."
    : status === "failed" ? "The AI could not read this report. Review it yourself, or try again."
    : AI_TEST_TYPES.includes(testType) ? "No AI reading was requested for this report."
    : "There is no AI for this kind of test. Review it directly."

  return (
    <div role="status" className="flex flex-col gap-4 border border-black/10 bg-black/[0.02] p-6 sm:flex-row sm:items-center sm:justify-between">
      <p className="flex items-start gap-3 text-sm">
        <Brain className={`mt-0.5 h-4 w-4 shrink-0 ${running ? "animate-pulse" : ""}`} aria-hidden="true" />
        {message}
      </p>
      {canRun && (
        <Button onClick={run} disabled={busy} variant="outline" className="rounded-none border-black font-mono text-xs uppercase tracking-widest">
          <RotateCw className="mr-2 h-4 w-4" aria-hidden="true" />
          {busy ? "Starting…" : status === "failed" ? "Run AI again" : "Run AI"}
        </Button>
      )}
    </div>
  )
}
