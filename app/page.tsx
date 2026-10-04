import { Button } from "@/components/ui/button"
import { Zap, Shield, Activity, Brain, FileText, Users } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import AnimatedHero from "@/components/landing/AnimatedHero"
import AnimatedStats from "@/components/landing/AnimatedStats"
import FeatureCard from "@/components/landing/FeatureCard"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white text-black">
      {/* Header - Ultra Minimal */}
      <header className="border-b border-black/10 sticky top-0 z-50 bg-white/80 backdrop-blur-md">
        <div className="container mx-auto px-6 lg:px-12 py-6 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Image
              src="/medi.png"
              alt="MedSync Logo"
              width={36}
              height={36}
              className="rounded"
              priority
            />
            <span className="text-xl font-bold tracking-tight">MedSync</span>
          </div>
          <div className="flex items-center space-x-6">
            <Link href="/login">
              <Button variant="ghost" className="text-sm font-medium">
                Sign In
              </Button>
            </Link>
            <Link href="/signup">
              <Button className="bg-black hover:bg-black/90 text-white text-sm font-medium px-6">
                GET STARTED →
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section - Virgil Abloh Bold Typography */}
      <section className="relative overflow-hidden border-b border-black/10">
        <div className="container mx-auto px-6 lg:px-12 py-20 lg:py-32">
          <AnimatedHero />
          <AnimatedStats />
        </div>

        {/* Grid Overlay - Subtle */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.02]">
          <div className="h-full w-full" style={{
            backgroundImage: `linear-gradient(to right, black 1px, transparent 1px),
                             linear-gradient(to bottom, black 1px, transparent 1px)`,
            backgroundSize: '40px 40px'
          }} />
        </div>
      </section>

      {/* Features Grid - Deconstructed & Labeled */}
      <section className="border-b border-black/10">
        <div className="container mx-auto px-6 lg:px-12 py-20 lg:py-32">
          {/* Section Label */}
          <div className="mb-16">
            <span className="text-xs font-mono tracking-widest text-black/40 uppercase">
               &quot;CORE FUNCTIONALITY&quot;
            </span>
          </div>

          {/* 3x2 Grid with borders */}
          <div className="grid lg:grid-cols-3 gap-[1px] bg-black/10">
            <FeatureCard 
              index="01" 
              iconName="Activity" 
              title='"AI ANALYSIS"' 
              description="Medical image interpretation with confidence scoring. X-ray fracture detection and brain tumor MRI analysis."
              tag="GEMINI + ML"
            />
            <FeatureCard 
              index="02" 
              iconName="Zap" 
              title='"REAL-TIME"' 
              description="Instant communication between doctors, labs, and patients. Live notifications and synchronized dashboards."
              tag="WEBSOCKET"
              delay={0.1}
            />
            <FeatureCard 
              index="03" 
              iconName="Shield" 
              title='"SECURE"' 
              description="Role-based access control with audit trails and encrypted data storage."
              tag="RLS + JWT"
              delay={0.2}
            />
            <FeatureCard 
              index="04" 
              iconName="Users" 
              title='"DOCTORS"' 
              description="Complete patient management with AI diagnostic support. Review reports, schedule consultations, communicate."
              tag="DASHBOARD"
              delay={0.3}
            />
            <FeatureCard 
              index="05" 
              iconName="FileText" 
              title='"PATIENTS"' 
              description="Access health records and communicate with healthcare providers. AI assistant for medication information."
              tag="PORTAL"
              delay={0.4}
            />
            <FeatureCard 
              index="06" 
              iconName="Brain" 
              title='"LABS"' 
              description="Sample management and result uploads with automatic AI processing. Coordinate directly with physicians."
              tag="INTERFACE"
              delay={0.5}
            />
          </div>
        </div>
      </section>

      {/* AI Visualization Section - Futuristic */}
      <section className="border-b border-black/10 bg-gradient-to-b from-white to-black/[0.02]">
        <div className="container mx-auto px-6 lg:px-12 py-20 lg:py-32 text-center">
          <div className="max-w-4xl mx-auto">
            <div className="mb-8">
              <span className="text-xs font-mono tracking-widest text-black/40 uppercase">
                 &quot;TECHNICAL ARCHITECTURE&quot;
              </span>
            </div>

            <h2 className="text-5xl lg:text-6xl font-bold tracking-tight mb-8 uppercase">
              Built for
              <br />
              <span className="text-black/40">Scale</span>
            </h2>

            <p className="text-xl text-black/60 mb-16 font-light max-w-2xl mx-auto">
              Next.js 15, Supabase, Google Gemini AI. Production-grade infrastructure with real-time capabilities.
            </p>

            {/* Tech Stack Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-[1px] bg-black/10">
              <div className="bg-white p-8 hover:bg-black/[0.02] transition-colors">
                <div className="text-sm font-mono text-black/40 mb-2 uppercase">Frontend</div>
                <div className="font-bold">Next.js 15</div>
              </div>
              <div className="bg-white p-8 hover:bg-black/[0.02] transition-colors">
                <div className="text-sm font-mono text-black/40 mb-2 uppercase">Backend</div>
                <div className="font-bold">Supabase</div>
              </div>
              <div className="bg-white p-8 hover:bg-black/[0.02] transition-colors">
                <div className="text-sm font-mono text-black/40 mb-2 uppercase">AI/ML</div>
                <div className="font-bold">Gemini API</div>
              </div>
              <div className="bg-white p-8 hover:bg-black/[0.02] transition-colors">
                <div className="text-sm font-mono text-black/40 mb-2 uppercase">Video</div>
                <div className="font-bold">Custom WebRTC</div>
              </div>
              <div className="bg-white p-8 hover:bg-black/[0.02] transition-colors">
                <div className="text-sm font-mono text-black/40 mb-2 uppercase">Signaling</div>
                <div className="font-bold">Supabase Realtime</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section - Deconstructed */}
      <section className="border-b border-black/10">
        <div className="container mx-auto px-6 lg:px-12 py-20 lg:py-32">
          <div className="max-w-4xl mx-auto">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-12">
              <div>
                <div className="mb-6">
                  <span className="text-xs font-mono tracking-widest text-black/40 uppercase">
                     &quot;GET ACCESS&quot;
                  </span>
                </div>
                <h2 className="text-4xl lg:text-5xl font-bold tracking-tight mb-4 uppercase">
                  Start collaborating
                  <br />
                  today.
                </h2>
                <p className="text-xl text-black/60 font-light">
                  Join healthcare professionals transforming patient care.
                </p>
              </div>
              <div className="flex flex-col items-start gap-4">
                <Link href="/signup">
                  <Button
                    size="lg"
                    className="bg-black hover:bg-black/90 text-white px-10 py-6 text-base font-medium"
                  >
                    CREATE ACCOUNT →
                  </Button>
                </Link>
                <span className="text-sm text-black/40 font-mono">
                  {'// FREE TRIAL AVAILABLE'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer - Minimal Archive */}
      <footer className="bg-black text-white">
        <div className="container mx-auto px-6 lg:px-12 py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-16">
            <div>
              <div className="text-xs font-mono text-white/40 mb-4 tracking-widest uppercase">
                About MedSync
              </div>
              <p className="text-sm text-white/80 max-w-sm leading-relaxed">
                An AI-powered healthcare collaboration platform connecting patients, doctors, and laboratory technicians for seamless medical care and advanced diagnostics.
              </p>
            </div>
            <div className="md:text-right">
              <div className="text-xs font-mono text-white/40 mb-4 tracking-widest uppercase">
                Social
              </div>
              <ul className="space-y-3 text-sm text-white/80">
                <li><Link href="https://twitter.com/medsync" className="hover:text-white transition-colors">Twitter</Link></li>
                <li><Link href="https://linkedin.com/company/medsync" className="hover:text-white transition-colors">LinkedIn</Link></li>
                <li><Link href="https://github.com/medsync" className="hover:text-white transition-colors">GitHub</Link></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-white/10 pt-8 flex flex-col lg:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <Image
                src="/medi.png"
                alt="MedSync Icon"
                width={24}
                height={24}
                className="rounded"
              />
              <span className="font-bold tracking-tight">MedSync</span>
            </div>
            <div className="text-[10px] text-white/40 font-mono uppercase tracking-[0.2em]">
              © 2025 MedSync Platform / All Rights Reserved
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
