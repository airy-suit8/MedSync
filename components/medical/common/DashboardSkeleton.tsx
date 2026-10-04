import { Skeleton } from "@/components/ui/skeleton"

// Placeholder in the shape of a dashboard (header, stat row, two panels) while data loads.
export default function DashboardSkeleton({ label = "Loading dashboard" }: { label?: string }) {
  return (
    <div className="min-h-screen p-6 md:p-12 max-w-7xl mx-auto" aria-busy="true">
      <span className="sr-only" role="status">{label}</span>
      <div className="border-b border-black/10 pb-8 mb-10 space-y-3">
        <Skeleton className="h-3 w-32 rounded-none bg-black/[0.06]" />
        <Skeleton className="h-10 w-72 rounded-none bg-black/[0.06]" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-black/10 border border-black/10 mb-10">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="bg-white p-6 space-y-3">
            <Skeleton className="h-3 w-20 rounded-none bg-black/[0.06]" />
            <Skeleton className="h-8 w-12 rounded-none bg-black/[0.06]" />
          </div>
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        {[0, 1].map(i => (
          <div key={i} className="border border-black/10 p-6 space-y-4">
            <Skeleton className="h-4 w-40 rounded-none bg-black/[0.06]" />
            <Skeleton className="h-16 w-full rounded-none bg-black/[0.04]" />
            <Skeleton className="h-16 w-full rounded-none bg-black/[0.04]" />
          </div>
        ))}
      </div>
    </div>
  )
}
