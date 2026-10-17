"use client"

import { Badge } from "@/components/ui/badge"

interface StatusBadgeProps {
  status: 'urgent' | 'high' | 'normal' | 'low' | 'completed' | 'pending' | 'reviewed' | 'new'
  size?: 'sm' | 'md' | 'lg'
}

const statusConfig = {
  urgent: {
    label: 'Urgent',
    className: 'border-red-600 text-red-600 bg-red-50'
  },
  high: {
    label: 'High Priority',
    className: 'border-orange-500 text-orange-500 bg-orange-50'
  },
  normal: {
    label: 'Normal',
    className: 'border-black/20 text-black/60 bg-black/[0.02]'
  },
  low: {
    label: 'Low Priority',
    className: 'border-black/10 text-black/55 bg-black/[0.01]'
  },
  completed: {
    label: 'Completed',
    className: 'border-emerald-600 text-emerald-600 bg-emerald-50'
  },
  pending: {
    label: 'Pending',
    className: 'border-amber-500 text-amber-500 bg-amber-50'
  },
  reviewed: {
    label: 'Reviewed',
    className: 'border-indigo-600 text-indigo-600 bg-indigo-50'
  },
  confirmed: {
    label: 'Confirmed',
    className: 'border-black text-black bg-white'
  },
  scheduled: {
    label: 'To confirm',
    className: 'border-amber-600 text-amber-700 bg-amber-50'
  },
  new: {
    label: 'New',
    className: 'border-indigo-600 text-indigo-600 bg-indigo-50'
  }
}

const sizeClasses = {
  sm: 'text-[10px] px-2 py-0.5',
  md: 'text-xs px-3 py-1',
  lg: 'text-sm px-4 py-1.5'
}

export default function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.normal

  return (
    <Badge 
      variant="outline"
      className={`${config.className} ${sizeClasses[size]} font-mono font-bold uppercase tracking-tighter rounded-none transition-all hover:opacity-80`}
    >
      {config.label}
    </Badge>
  )
}
