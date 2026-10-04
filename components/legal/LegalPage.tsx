import Link from "next/link"

// Shared frame for the Privacy and Terms pages. Both are drafts until the team has them reviewed.
export default function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-white text-black">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link href="/" className="text-xs font-mono uppercase tracking-widest text-black/55 hover:text-black">
          ← MedSync
        </Link>
        <p role="note" className="mt-8 border border-amber-600/30 bg-amber-50 p-3 text-xs font-mono uppercase text-amber-800">
          DRAFT — needs human/legal review before MedSync handles real patients.
        </p>
        <h1 className="mt-8 text-4xl font-bold tracking-tight uppercase">{title}</h1>
        <p className="mt-2 text-sm font-mono text-black/55">Last updated {updated}</p>
        <div className="mt-10 space-y-8 leading-relaxed text-black/80 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:uppercase [&_h2]:mb-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1 [&_a]:underline">
          {children}
        </div>
      </div>
    </main>
  )
}
