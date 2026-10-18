// MedSync's mark: a pulse line that spells M. Drawn here, so there is no third-party
// artwork to credit or license. `inverted` is for dark backgrounds.
export default function Logo({ className = "h-8 w-8", inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" focusable="false">
      <rect width="32" height="32" fill={inverted ? "#ffffff" : "#0a0a0a"} />
      <path d="M5 19h5l3-10 3 12 3-12 3 10h5" fill="none" stroke={inverted ? "#0a0a0a" : "#ffffff"} strokeWidth="2.5" strokeLinecap="square" />
    </svg>
  )
}
