"use client"

import { Button } from './button'
import { Download } from 'lucide-react'

export function PrintButton({ className }: { className?: string }) {
  return (
    <Button
      onClick={() => window.print()}
      className={className}
    >
      <Download className="h-4 w-4 mr-2" />
      SAVE AS PDF
    </Button>
  )
}
