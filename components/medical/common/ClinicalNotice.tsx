import { AlertCircle } from "lucide-react"

// Shown wherever AI/ML output or patient messaging appears: MedSync's models are an
// unvalidated research prototype, and nothing here is monitored for emergencies.
export default function ClinicalNotice({ children }: { children?: React.ReactNode }) {
  return (
    <div role="note" className="flex items-start gap-2 border border-red-500/20 bg-red-50 p-3 text-[11px] font-mono uppercase leading-relaxed text-red-700">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <p>
        Research prototype, not a medical device or diagnosis. In an emergency call 112.
        {children && <> {children}</>}
      </p>
    </div>
  )
}
