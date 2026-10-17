import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { KeyboardEvent } from "react"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Makes a clickable card or list row reachable and operable by keyboard (Tab, Enter, Space).
export function pressable(onPress: () => void) {
  return {
    role: "button",
    tabIndex: 0,
    onClick: onPress,
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      // Keys pressed on a nested button or input belong to that control.
      if (e.target !== e.currentTarget) return
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        onPress()
      }
    },
  }
}

// Report test types (reports.test_type) and their names on screen. `ai`: tests the AI can
// read (scan models for X-ray/MRI, lab-value reader for blood/urine).
export const TEST_TYPES: { value: string; label: string; ai: boolean }[] = [
  { value: "x_ray", label: "X-ray", ai: true },
  { value: "mri", label: "MRI", ai: true },
  { value: "blood_test", label: "Blood test", ai: true },
  { value: "urine_test", label: "Urine test", ai: true },
  { value: "ct_scan", label: "CT scan", ai: false },
  { value: "ultrasound", label: "Ultrasound", ai: false },
  { value: "ecg", label: "ECG", ai: false },
  { value: "other", label: "Other", ai: false },
]

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "")
const TEST_LABELS = new Map(TEST_TYPES.map((t) => [squash(t.value), t.label]))

// "x_ray", "X Ray", "xray" -> "X-ray"; "mri" -> "MRI"; unknown types -> "Lipid panel".
export function testLabel(type?: string | null): string {
  if (!type?.trim()) return "Report"
  const known = TEST_LABELS.get(squash(type))
  if (known) return known
  const words = type.trim().replace(/[_-]+/g, " ").toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}
