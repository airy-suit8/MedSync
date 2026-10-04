"use client"

import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function AnimatedHero() {
  return (
    <div className="max-w-6xl mx-auto relative z-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8"
      >
        <span className="text-xs font-mono tracking-widest text-black/40 uppercase">
           &quot;HEALTHCARE PLATFORM&quot;
        </span>
      </motion.div>

      <h1 className="text-[64px] lg:text-[96px] leading-[0.95] font-bold tracking-tight mb-8">
        <motion.span
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="block"
        >
          AI-POWERED
        </motion.span>
        <motion.span
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="block"
        >
          CLINICAL
        </motion.span>
        <motion.span
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="text-black/40 block"
        >
          COLLABORATION
        </motion.span>
      </h1>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 0.6 }}
        className="text-xl lg:text-2xl text-black/60 max-w-2xl mb-12 font-light"
      >
        Bridging doctors, laboratories, and patients through real-time intelligence.
        Professional. Precise. Human.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.8 }}
        className="flex items-center space-x-6"
      >
        <Link href="/signup">
          <Button
            size="lg"
            className="bg-black hover:bg-black/90 text-white px-8 py-6 text-base font-medium"
          >
            ACCESS PORTAL →
          </Button>
        </Link>
        <span className="text-sm font-mono text-black/40">v2.0.25</span>
      </motion.div>
    </div>
  )
}
