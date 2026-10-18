import { Button } from "@/components/ui/button"
import Link from "next/link"
import Image from "next/image"
import AnimatedHero from "@/components/landing/AnimatedHero"
import ScanPreview from "@/components/landing/ScanPreview"

// The four hand-offs every scan goes through; the order is the point, so it's numbered.
const FLOW = [
  { role: "LAB", title: "Upload the scan", text: "An X-ray or MRI goes in once, stored privately and linked to the patient and their doctor." },
  { role: "AI", title: "First read", text: "Our models mark what they see: the finding, a confidence score and the region." },
  { role: "DOCTOR", title: "Review and decide", text: "The patient's doctor is notified, checks the AI's read and makes the call." },
  { role: "PATIENT", title: "Get the answer", text: "The report lands in the patient's portal, with chat and video one tap away." },
]

const ROLES = [
  {
    name: "Patients",
    summary: "Your scans, explained, and your doctor one message away.",
    items: ["Reports with the AI's findings", "Confirm appointment requests", "Chat and video calls with your doctor", "AI assistant for general health questions"],
  },
  {
    name: "Doctors",
    summary: "Every scan arrives with a first read. You make the call.",
    items: ["AI-assisted report review", "Patients, schedule and appointments", "Chat and video consultations", "Verified by registration number"],
  },
  {
    name: "Labs",
    summary: "Upload once. The right doctor is told straight away.",
    items: ["X-ray, MRI and lab report uploads", "Sample and imaging tracking", "Doctor notified on every upload", "Direct messages with doctors"],
  },
]

const STACK = [
  ["Frontend", "Next.js 15"],
  ["Backend", "Supabase"],
  ["Assistant", "Gemini API"],
  ["Scan AI", "EfficientNet + YOLOv8"],
  ["Video", "Custom WebRTC"],
  ["Signaling", "Supabase Realtime"],
]

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white text-black selection:bg-black selection:text-white">
      <header className="border-b border-black/10 sticky top-0 z-50 bg-white/80 backdrop-blur-md">
        <div className="container mx-auto px-4 sm:px-6 lg:px-12 py-4 sm:py-6 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2 sm:gap-3 shrink-0">
            <Image
              src="/medi.png"
              alt=""
              width={32}
              height={32}
              className="rounded"
              priority
            />
            <span className="text-lg sm:text-xl font-bold tracking-tight">MedSync</span>
          </Link>
          <div className="flex items-center gap-1 sm:gap-4">
            <Button variant="ghost" className="text-sm font-medium px-3" asChild>
              <Link href="/login">Sign In</Link>
            </Button>
            <Button className="bg-black hover:bg-black/90 text-white text-xs sm:text-sm font-medium px-3 sm:px-6" asChild>
              <Link href="/signup">CREATE ACCOUNT</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero, then the product itself: one scan and what happens to it */}
      <section className="relative overflow-hidden border-b border-black/10">
        <div className="container mx-auto px-6 lg:px-12 py-16 lg:py-28">
          <AnimatedHero />

          <div className="mt-16 lg:mt-24 pt-12 lg:pt-16 border-t border-black/10 grid lg:grid-cols-12 gap-12 lg:gap-16 relative z-10">
            <div className="lg:col-span-5">
              <ScanPreview />
            </div>

            <div className="lg:col-span-7 flex flex-col">
              <h2 className="text-xs font-mono tracking-widest text-black/55 uppercase mb-8">
                &quot;HOW IT WORKS&quot;
              </h2>
              <ol className="border-t border-black/10">
                {FLOW.map((step, i) => (
                  <li key={step.role} className="grid grid-cols-[3rem_1fr] sm:grid-cols-[3rem_6rem_1fr] gap-x-4 gap-y-1 border-b border-black/10 py-6">
                    <span className="font-mono text-xs text-black/55 pt-1.5 tabular-nums">0{i + 1}</span>
                    <span className="font-mono text-xs tracking-widest text-black/55 pt-1.5 sm:row-span-2 col-start-2 sm:col-start-2">{step.role}</span>
                    <div className="col-start-2 sm:col-start-3 sm:row-start-1 sm:row-span-2">
                      <h3 className="text-xl lg:text-2xl font-bold">{step.title}</h3>
                      <p className="mt-1 text-black/60 leading-relaxed max-w-md">{step.text}</p>
                    </div>
                  </li>
                ))}
              </ol>

              <dl className="mt-10 grid grid-cols-2 gap-px bg-black/10 border border-black/10">
                <div className="bg-white p-6">
                  <dt className="font-mono text-xs uppercase tracking-widest text-black/55">Fracture detector</dt>
                  <dd className="mt-2 text-4xl font-bold tabular-nums">0.93<span className="ml-2 text-sm font-mono font-normal text-black/55">mAP@50</span></dd>
                </div>
                <div className="bg-white p-6">
                  <dt className="font-mono text-xs uppercase tracking-widest text-black/55">Fracture classifier</dt>
                  <dd className="mt-2 text-4xl font-bold tabular-nums">0.91<span className="ml-2 text-sm font-mono font-normal text-black/55">AUC</span></dd>
                </div>
              </dl>
              <p className="mt-4 text-sm text-black/60">
                Validation scores from training. The AI assists; a doctor makes every call.
              </p>
            </div>
          </div>
        </div>

        <div aria-hidden="true" className="absolute inset-0 pointer-events-none opacity-[0.02]">
          <div className="h-full w-full" style={{
            backgroundImage: `linear-gradient(to right, black 1px, transparent 1px),
                             linear-gradient(to bottom, black 1px, transparent 1px)`,
            backgroundSize: '40px 40px'
          }} />
        </div>
      </section>

      {/* Who it's for */}
      <section className="border-b border-black/10">
        <div className="container mx-auto px-6 lg:px-12 py-20 lg:py-24">
          <h2 className="text-xs font-mono tracking-widest text-black/55 uppercase mb-12">
            &quot;WHO IT&apos;S FOR&quot;
          </h2>
          <div className="grid lg:grid-cols-3 gap-px bg-black/10 border border-black/10">
            {ROLES.map((role) => (
              <div key={role.name} className="reveal-on-scroll bg-white p-8 lg:p-10">
                <h3 className="text-3xl lg:text-4xl font-bold uppercase tracking-tight">{role.name}</h3>
                <p className="mt-3 mb-8 text-black/60 leading-relaxed">{role.summary}</p>
                <ul className="border-t border-black/10">
                  {role.items.map((item) => (
                    <li key={item} className="border-b border-black/10 py-3 text-sm">{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Under the hood */}
      <section className="border-b border-black/10 bg-black/[0.02]">
        <div className="container mx-auto px-6 lg:px-12 py-20 lg:py-24">
          <div className="mb-8">
            <span className="text-xs font-mono tracking-widest text-black/55 uppercase">
               &quot;TECHNICAL ARCHITECTURE&quot;
            </span>
          </div>

          <div className="grid lg:grid-cols-12 gap-10 lg:gap-16">
            <div className="lg:col-span-5">
              <h2 className="text-5xl lg:text-6xl font-bold tracking-tight uppercase">
                Under the
                <br />
                <span className="text-black/55">Hood</span>
              </h2>
              <p className="mt-8 text-lg text-black/60 font-light max-w-md">
                Row-level security on every table. Report files open only for the people allowed
                to see them. Video calls go peer to peer and never pass through our servers.
              </p>
            </div>

            <div className="lg:col-span-7 self-end grid grid-cols-2 sm:grid-cols-3 gap-px bg-black/10 border border-black/10">
              {STACK.map(([layer, tech]) => (
                <div key={layer} className="bg-white p-6 lg:p-8">
                  <div className="text-xs font-mono text-black/55 mb-2 uppercase tracking-widest">{layer}</div>
                  <div className="font-bold">{tech}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-b border-black/10">
        <div className="container mx-auto px-6 lg:px-12 py-20 lg:py-24">
          <div className="text-center">
            <div className="mb-6">
              <span className="text-xs font-mono tracking-widest text-black/55 uppercase">
                 &quot;GET ACCESS&quot;
              </span>
            </div>
            <h2 className="text-4xl lg:text-6xl font-bold tracking-tight mb-4 uppercase">
              Start collaborating
              <br />
              today.
            </h2>
            <p className="text-xl text-black/60 font-light">
              Patients, doctors and labs on one platform.
            </p>
          </div>
        </div>
      </section>

      <footer className="bg-black text-white">
        <div className="container mx-auto px-6 lg:px-12 py-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-16">
            <div>
              <div className="text-xs font-mono text-white/60 mb-4 tracking-widest uppercase">
                About MedSync
              </div>
              <p className="text-sm text-white/80 max-w-sm leading-relaxed">
                A healthcare collaboration platform that brings patients, doctors and lab
                technicians together around every scan, with AI that gives each one a first read.
              </p>
            </div>
            <div>
              <div className="text-xs font-mono text-white/60 mb-4 tracking-widest uppercase">
                Platform
              </div>
              <ul className="space-y-3 text-sm text-white/80">
                <li><Link href="/login" className="hover:text-white transition-colors">Sign in</Link></li>
                <li><Link href="/signup" className="hover:text-white transition-colors">Create account</Link></li>
              </ul>
            </div>
            <div>
              <div className="text-xs font-mono text-white/60 mb-4 tracking-widest uppercase">
                Project
              </div>
              <ul className="space-y-3 text-sm text-white/80">
                <li><a href="mailto:reach.medsync@gmail.com" className="hover:text-white transition-colors">reach.medsync@gmail.com</a></li>
                <li><a href="https://github.com/EvanGregor/MedSync" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">Source code on GitHub</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-white/10 pt-8 flex flex-col lg:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <Image
                src="/medi.png"
                alt=""
                width={24}
                height={24}
                className="rounded"
              />
              <span className="font-bold tracking-tight">MedSync</span>
            </div>
            <nav aria-label="Legal" className="flex gap-6 text-[11px] font-mono uppercase tracking-[0.2em] text-white/70">
              <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
              <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
            </nav>
            <div className="text-[11px] text-white/60 font-mono uppercase tracking-[0.2em]">
              © {new Date().getFullYear()} MedSync
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
