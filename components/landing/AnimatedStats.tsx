"use client"

import { motion } from "framer-motion"

export default function AnimatedStats() {
  return (
    <div className="grid grid-cols-3 gap-8 mt-16 pt-16 border-t border-black/10 relative z-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <div className="text-4xl font-bold mb-2">3</div>
        <div className="text-sm text-black/60 font-mono uppercase tracking-wide">User Roles</div>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <div className="text-4xl font-bold mb-2">AI</div>
        <div className="text-sm text-black/60 font-mono uppercase tracking-wide">Powered Analysis</div>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.6 }}
      >
        <div className="text-4xl font-bold mb-2">∞</div>
        <div className="text-sm text-black/60 font-mono uppercase tracking-wide">Real-time Sync</div>
      </motion.div>
    </div>
  )
}
