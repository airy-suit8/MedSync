"use client"

import { LucideIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface MetricCardProps {
  title: string
  value: string | number
  description?: string
  icon: LucideIcon
  trend?: {
    value: number
    label: string
    positive?: boolean
  }
  status?: 'normal' | 'warning' | 'critical' | 'success'
  onClick?: () => void
}

const statusColors = {
  normal: 'border-black/10 hover:border-black/30',
  warning: 'border-yellow-500/30 hover:border-yellow-500/50',
  critical: 'border-red-500/30 hover:border-red-500/50',
  success: 'border-green-500/30 hover:border-green-500/50'
}

const iconColors = {
  normal: 'bg-black/5',
  warning: 'bg-yellow-500/10',
  critical: 'bg-red-500/10',
  success: 'bg-green-500/10'
}

export default function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  status = 'normal',
  onClick
}: MetricCardProps) {
  return (
    <div
      className={`
        bg-white border rounded-lg p-6 transition-all duration-200
        ${statusColors[status]}
        ${onClick ? 'cursor-pointer hover:shadow-sm' : ''}
      `}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-lg ${iconColors[status]}`}>
          <Icon className="h-6 w-6 stroke-[1.5]" />
        </div>
        {trend && (
          <Badge
            variant="outline"
            className={`text-xs border-black/10 ${trend.positive
                ? 'text-green-700'
                : 'text-red-700'
              }`}
          >
            {trend.positive ? '+' : ''}{trend.value}% {trend.label}
          </Badge>
        )}
      </div>

      <div className="space-y-1">
        <h3 className="text-3xl font-bold tracking-tight">{value}</h3>
        <p className="text-sm font-medium text-black/60">{title}</p>
        {description && (
          <p className="text-xs text-black/40">{description}</p>
        )}
      </div>
    </div>
  )
}
