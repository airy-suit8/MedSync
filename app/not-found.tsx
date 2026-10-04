"use client"

import { Button } from "@/components/ui/button"
import { ArrowLeft, Home } from "lucide-react"
import Link from "next/link"

export default function NotFound() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Grid Overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]">
        <div className="h-full w-full" style={{
          backgroundImage: `linear-gradient(to right, black 1px, transparent 1px),
                             linear-gradient(to bottom, black 1px, transparent 1px)`,
          backgroundSize: '40px 40px'
        }} />
      </div>

      <div className="max-w-2xl w-full relative z-10 text-center">
        <div className="mb-8">
          <span className="text-xs font-mono tracking-widest text-black/55 uppercase">
             &quot;SYSTEM ERROR&quot;
          </span>
        </div>

        <h1 className="text-[120px] leading-[0.8] font-bold tracking-tighter mb-6 text-black">
          404
        </h1>

        <div className="h-px w-24 bg-black/10 mx-auto mb-8" />

        <h2 className="text-2xl font-bold mb-4 uppercase tracking-tight">
          Page Not Found
        </h2>

        <p className="text-black/60 mb-12 max-w-md mx-auto font-light">
          The resource you are looking for has been moved, deleted, or does not exist.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button className="bg-black hover:bg-black/90 text-white rounded-none px-8 py-6 font-mono text-sm uppercase tracking-wide" asChild>
            <Link href="/">
              <Home className="h-4 w-4 mr-2" />
              Return Home
            </Link>
          </Button>
          <Button
            variant="outline"
            onClick={() => window.history.back()}
            className="rounded-none border-black/10 hover:bg-black/5 px-8 py-6 font-mono text-sm uppercase tracking-wide text-black"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
        </div>

        <div className="mt-16 text-xs font-mono text-black/20">
          ERROR_CODE: 404_NOT_FOUND // MEDSYNC_V2
        </div>
      </div>
    </div>
  )
}
