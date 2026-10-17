import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function AnimatedHero() {
  return (
    <div className="max-w-6xl relative z-10">
      <div className="reveal mb-8">
        <span className="text-xs font-mono tracking-widest text-black/55 uppercase">
           &quot;HEALTHCARE PLATFORM&quot;
        </span>
      </div>

      {/* 40px keeps "COLLABORATION" inside a 390px phone; 96px is the desktop display size. */}
      <h1 className="text-[40px] sm:text-[64px] lg:text-[96px] leading-[0.95] font-bold tracking-tight mb-8">
        <span className="reveal block [--reveal-y:40px] [--reveal-duration:0.7s] [--reveal-delay:0.2s]">
          AI-POWERED
        </span>
        <span className="reveal block [--reveal-y:40px] [--reveal-duration:0.7s] [--reveal-delay:0.3s]">
          CLINICAL
        </span>
        <span className="reveal text-black/55 block [--reveal-y:40px] [--reveal-duration:0.7s] [--reveal-delay:0.4s]">
          COLLABORATION
        </span>
      </h1>

      <p className="reveal [--reveal-y:0px] [--reveal-duration:1s] [--reveal-delay:0.6s] text-lg sm:text-xl lg:text-2xl text-black/60 max-w-2xl mb-12 font-light">
        A lab uploads a scan, our AI marks what it sees, the doctor reviews it and the
        patient gets the answer. One secure platform for all three.
      </p>

      <div className="reveal [--reveal-delay:0.8s]">
        <Button
            size="lg"
            className="bg-black hover:bg-black/90 text-white px-8 py-6 text-base font-medium"
           asChild>
          <Link href="/signup">
            CREATE ACCOUNT →
          </Link>
        </Button>
      </div>
    </div>
  )
}
