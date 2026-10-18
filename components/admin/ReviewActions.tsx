"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { createClient } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import type { Account } from "@/lib/admin"

const BUTTON = "h-10 rounded-none px-5 font-mono text-xs uppercase tracking-widest"

// Approve a doctor or lab, or turn them down / withdraw verification with a reason they
// will see (admin_review_account notifies them and logs the decision).
export default function ReviewActions({ account, onDone }: { account: Account; onDone: () => void }) {
  const [askingReason, setAskingReason] = useState(false)
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const { toast } = useToast()
  const who = account.name || "This account"

  const review = async (approve: boolean) => {
    setBusy(true)
    const { error } = await createClient().rpc("admin_review_account", {
      p_user: account.id, p_approve: approve, p_note: approve ? null : reason.trim(),
    })
    setBusy(false)
    if (error) {
      toast({ title: "Couldn't save that", description: error.message, variant: "destructive" })
      return
    }
    toast({
      title: approve ? `${who} is verified` : account.verified ? `${who}'s verification is withdrawn` : `${who} is turned down`,
      description: "They have a notification about it.",
    })
    setAskingReason(false)
    setReason("")
    onDone()
  }

  const submitReason = (e: React.FormEvent) => {
    e.preventDefault()
    review(false)
  }

  if (askingReason) {
    return (
      <form onSubmit={submitReason} className="w-full max-w-xl space-y-2">
        <Label htmlFor={`reason-${account.id}`} className="font-mono text-[11px] uppercase tracking-widest text-black/60">
          Reason (they see this)
        </Label>
        <Textarea id={`reason-${account.id}`} value={reason} onChange={(e) => setReason(e.target.value)} required maxLength={500} rows={2}
          placeholder="e.g. This number isn't on the Karnataka register. Check it and send it again."
          className="rounded-none border-black/20 focus:border-black" />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={busy || !reason.trim()} className={`${BUTTON} bg-red-700 text-white hover:bg-red-800`}>
            {busy ? "Saving…" : account.verified ? "Withdraw verification" : "Turn down"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setAskingReason(false)} className={BUTTON}>Cancel</Button>
        </div>
      </form>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      {!account.verified && (
        <Button type="button" onClick={() => review(true)} disabled={busy} className={`${BUTTON} bg-black text-white hover:bg-black/90`}>
          {busy ? "Saving…" : "Approve"}
        </Button>
      )}
      {account.verified ? (
        <button type="button" onClick={() => setAskingReason(true)}
          className="font-mono text-[11px] uppercase tracking-widest text-black/60 underline underline-offset-4 hover:text-red-800">
          Withdraw verification
        </button>
      ) : (
        <Button type="button" variant="outline" onClick={() => setAskingReason(true)} className={`${BUTTON} border-black/30`}>
          {account.verification_reviewed_at ? "Change reason" : "Turn down"}
        </Button>
      )}
    </div>
  )
}
