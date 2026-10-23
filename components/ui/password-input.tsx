"use client"

import * as React from "react"
import { Eye, EyeOff } from "lucide-react"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

// Password field with a show/hide toggle. Wrap it in a `relative` container; the toggle
// sits on the right edge of the input.
const PasswordInput = React.forwardRef<HTMLInputElement, Omit<React.ComponentProps<"input">, "type">>(
  ({ className, ...props }, ref) => {
    const [visible, setVisible] = React.useState(false)

    return (
      <>
        <Input ref={ref} type={visible ? "text" : "password"} className={cn("pr-10", className)} {...props} />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          aria-controls={props.id}
          className="absolute right-0 top-0 flex h-12 w-10 items-center justify-center text-black/40 hover:text-black focus-visible:text-black focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-black transition-colors"
        >
          {visible ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
        </button>
      </>
    )
  }
)
PasswordInput.displayName = "PasswordInput"

export { PasswordInput }
