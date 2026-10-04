// Blueprint Label - Construction aesthetic
import React from 'react'
import { cn } from '@/lib/utils'

interface BlueprintLabelProps {
    text: string
    className?: string
}

export function BlueprintLabel({ text, className }: BlueprintLabelProps) {
    return (
        <div className={cn("text-[10px] font-mono text-black/30 uppercase tracking-[0.3em]", className)}>
            {text}
        </div>
    )
}

// Grid Overlay - Visible structure
export function GridOverlay({ opacity = 0.05 }: { opacity?: number }) {
    return (
        <div
            className="absolute inset-0 pointer-events-none z-0"
            style={{ opacity }}
        >
            <div className="grid grid-cols-12 h-full">
                {[...Array(12)].map((_, i) => (
                    <div key={i} className="border-r border-black" />
                ))}
            </div>
        </div>
    )
}

// Construction Mark - Version/status stamps
interface ConstructionMarkProps {
    text: string
    type?: 'version' | 'status' | 'timestamp'
}

export function ConstructionMark({ text, type = 'status' }: ConstructionMarkProps) {
    return (
        <span className="inline-block px-2 py-1 border border-black/20 text-[10px] font-mono uppercase tracking-wider text-black/40">
            [{text}]
        </span>
    )
}

// Quotation Title - Virgil's signature
interface QuotationTitleProps {
    children: React.ReactNode
    size?: 'sm' | 'md' | 'lg' | 'xl'
    className?: string
}

export function QuotationTitle({ children, size = 'md', className }: QuotationTitleProps) {
    const sizes = {
        sm: 'text-2xl md:text-3xl',
        md: 'text-4xl md:text-6xl',
        lg: 'text-6xl md:text-8xl',
        xl: 'text-7xl md:text-9xl'
    }

    return (
        <h1 className={cn(
            "font-black uppercase tracking-tighter leading-none",
            sizes[size],
            className
        )}>
             &quot;{children}&quot;
        </h1>
    )
}
