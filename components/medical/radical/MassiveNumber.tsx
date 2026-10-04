// Massive Number Display - Kanye Yeezy Style
import React from 'react'
import { cn } from '@/lib/utils'

interface MassiveNumberProps {
    value: number | string
    label: string
    sublabel?: string
    trend?: {
        value: string
        positive?: boolean
    }
    className?: string
}

export function MassiveNumber({
    value,
    label,
    sublabel,
    trend,
    className
}: MassiveNumberProps) {
    return (
        <div className={cn("relative", className)}>
            {/* The massive number */}
            <div className="flex items-baseline gap-4 md:gap-8">
                <div className="text-[8rem] md:text-[12rem] lg:text-[20rem] font-black leading-none tracking-tighter">
                    {value}
                </div>

                <div className="flex flex-col justify-end pb-8 md:pb-16">
                    {/* Quoted label */}
                    <div className="text-xl md:text-2xl font-mono uppercase tracking-[0.3em] mb-2">
                         &quot;{label}&quot;
                    </div>

                    {/* Sublabel */}
                    {sublabel && (
                        <div className="text-lg md:text-xl text-black/40 uppercase font-light">
                            {sublabel}
                        </div>
                    )}

                    {/* Trend indicator */}
                    {trend && (
                        <div className="mt-4 flex items-center gap-2">
                            <div className={cn(
                                "w-2 h-2 rounded-full animate-pulse",
                                trend.positive ? "bg-green-500" : "bg-red-500"
                            )}></div>
                            <span className="text-sm font-mono uppercase tracking-wider">
                                {trend.value}
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
