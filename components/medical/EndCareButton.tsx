"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"

// Ends a doctor-patient link (end_care). Asks once before doing it, because the doctor
// loses access to the patient's reports straight away.
export default function EndCareButton({
  otherId,
  otherName,
  role,
  onEnded,
}: {
  otherId: string
  otherName: string
  role: "doctor" | "patient"
  onEnded: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const { toast } = useToast()

  const endCare = async () => {
    setBusy(true)
    const { error } = await createClient().rpc("end_care", { p_other_id: otherId })
    setBusy(false)
    if (error) {
      toast({ title: "Could not end care", description: error.message, variant: "destructive" })
      return
    }
    toast({
      title: "Care ended",
      description: role === "patient"
        ? `${otherName} can no longer see your reports.`
        : `You no longer have access to ${otherName}'s reports.`,
    })
    onEnded()
  }

  if (!confirming) {
    return (
      <Button variant="outline" onClick={() => setConfirming(true)} className="rounded-none border-black/30 font-mono text-xs uppercase tracking-widest">
        End care
      </Button>
    )
  }

  return (
    <div role="group" aria-label={`End care with ${otherName}`} className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-black/60">
        {role === "patient" ? "Remove their access to your reports?" : "Remove your access to their reports?"}
      </span>
      <Button onClick={endCare} disabled={busy} className="rounded-none bg-black text-white hover:bg-black/90 font-mono text-xs uppercase tracking-widest">
        {busy ? "Ending…" : "Yes, end care"}
      </Button>
      <Button variant="ghost" onClick={() => setConfirming(false)} disabled={busy} className="rounded-none font-mono text-xs uppercase tracking-widest">
        Keep
      </Button>
    </div>
  )
}
