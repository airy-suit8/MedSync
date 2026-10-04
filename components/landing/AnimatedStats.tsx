export default function AnimatedStats() {
  return (
    <div className="grid grid-cols-3 gap-8 mt-16 pt-16 border-t border-black/10 relative z-10">
      <div className="reveal-on-scroll">
        <div className="text-4xl font-bold mb-2">3</div>
        <div className="text-sm text-black/60 font-mono uppercase tracking-wide">User Roles</div>
      </div>
      <div className="reveal-on-scroll">
        <div className="text-4xl font-bold mb-2">AI</div>
        <div className="text-sm text-black/60 font-mono uppercase tracking-wide">Powered Analysis</div>
      </div>
      <div className="reveal-on-scroll">
        <div className="text-4xl font-bold mb-2">∞</div>
        <div className="text-sm text-black/60 font-mono uppercase tracking-wide">Real-time Sync</div>
      </div>
    </div>
  )
}
