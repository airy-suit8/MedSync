import type React from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

// Shared frame for sign-in and sign-up, so both pages look like the same product.
export default function AuthFrame({
  label,
  title,
  subtitle,
  children,
}: {
  label: string
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-white relative overflow-hidden flex flex-col selection:bg-black selection:text-white">
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none opacity-[0.02]">
        <div className="h-full w-full" style={{
          backgroundImage: `linear-gradient(to right, black 1px, transparent 1px),
                           linear-gradient(to bottom, black 1px, transparent 1px)`,
          backgroundSize: '40px 40px'
        }} />
      </div>

      <div className="container mx-auto px-6 py-6 relative z-10 flex-1 flex flex-col">
        <header className="mb-8">
          <Link href="/" className="inline-flex items-center space-x-2 group">
            <span className="bg-black text-white p-1 rounded-sm group-hover:bg-black/80 transition-colors">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="text-sm font-mono uppercase tracking-widest text-black/60 group-hover:text-black transition-colors">Home</span>
          </Link>
        </header>

        <main className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-lg py-8">
            <div className="mb-6 border-b border-black/10 pb-2">
              <span className="text-[11px] font-mono tracking-[0.2em] text-black/55 uppercase">
                &quot;{label}&quot;
              </span>
            </div>

            <h1 className="text-5xl sm:text-6xl font-bold tracking-tighter mb-2">{title}</h1>
            <p className="text-xl text-black/60 font-light mb-10 max-w-sm text-balance">{subtitle}</p>

            <div className="bg-white border border-black/10 relative">
              <div aria-hidden="true" className="absolute -top-1 -right-1 w-4 h-4 border-t border-r border-black" />
              <div aria-hidden="true" className="absolute -bottom-1 -left-1 w-4 h-4 border-b border-l border-black" />
              <div className="p-6 sm:p-8 lg:p-10">{children}</div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
