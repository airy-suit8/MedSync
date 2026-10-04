// Deconstructed Card Component - Virgil Abloh Style
import React from 'react'
import { cn } from '@/lib/utils'

interface DeconstructedCardProps {
    children: React.ReactNode
    number?: string
    title: string
    accent?: 'orange' | 'blue' | 'none'
    rotation?: number
    className?: string
    timestamp?: boolean
}

export function DeconstructedCard({
    children,
    number,
    title,
    accent = 'none',
    rotation = 0,
    className,
    timestamp = true
}: DeconstructedCardProps) {
    const accentColors = {
        orange: 'bg-[#FF6B00]',
        blue: 'bg-[#0066FF]',
        none: 'bg-transparent'
    }

    const now = new Date()
    const timeString = now.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    })

    return (
        <div
            className={cn("relative group", className)}
            style={{ transform: `rotate(${rotation}deg)` }}
        >
            {/* Blueprint label */}
            {number && (
                <div className="absolute -top-8 left-0 flex items-center gap-4">
                    <span className="text-[10px] font-mono text-black/30 uppercase tracking-[0.3em]">
                        {number}/ SECTION
                    </span>
                    <div className="h-px flex-1 bg-black/10"></div>
                </div>
            )}

            {/* Main card - NO round corners */}
            <div className="border-2 border-black bg-white relative overflow-visible p-8 transition-all hover:border-black/60">
                {/* Accent bar */}
                {accent !== 'none' && (
                    <div className={cn("absolute top-0 left-0 w-1 h-full", accentColors[accent])}></div>
                )}

                {/* Quotation title */}
                <h3 className="text-3xl md:text-5xl font-black uppercase mb-6 leading-none tracking-tighter">
                     &quot;{title}&quot;
                </h3>

                {/* Content */}
                <div className="text-black/80">
                    {children}
                </div>

                {/* Arrow indicator on hover */}
                <div className="absolute -right-6 bottom-8 text-4xl transform rotate-45 opacity-0 group-hover:opacity-100 transition-opacity">
                    →
                </div>
            </div>

            {/* Timestamp */}
            {timestamp && (
                <div className="absolute -bottom-6 right-0 text-[10px] font-mono text-black/20 uppercase">
                    LAST UPDATED: {timeString}
                </div>
            )}
        </div>
    )
}
