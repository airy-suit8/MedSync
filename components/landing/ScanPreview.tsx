// What the AI's first read looks like: a forearm X-ray (drawn, not a patient scan) with
// the fracture box the YOLOv8 detector draws. Box and label animate in once (globals.css).
export default function ScanPreview() {
  return (
    <figure className="bg-[#0a0a0a] text-white">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-3 text-[10px] font-mono uppercase tracking-[0.2em]">
        <span className="text-white/70">&quot;AI FIRST READ&quot;</span>
        <span className="text-white/50">Example output</span>
      </div>

      <div className="relative aspect-[4/5] overflow-hidden">
        <svg viewBox="0 0 320 400" className="h-full w-full" role="img" aria-label="Forearm X-ray with a box around a fracture of the radius, labelled fracture, confidence 0.87">
          <defs>
            <radialGradient id="scan-film" cx="50%" cy="45%" r="75%">
              <stop offset="0%" stopColor="#1f1f1f" />
              <stop offset="100%" stopColor="#060606" />
            </radialGradient>
            <linearGradient id="scan-bone" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor="#f2f2f2" />
              <stop offset="0.22" stopColor="#d4d4d4" />
              <stop offset="0.5" stopColor="#9a9a9a" />
              <stop offset="0.78" stopColor="#d4d4d4" />
              <stop offset="1" stopColor="#f2f2f2" />
            </linearGradient>
            <filter id="scan-soft" x="-30%" y="-10%" width="160%" height="120%">
              <feGaussianBlur stdDeviation="14" />
            </filter>
            <filter id="scan-edge">
              <feGaussianBlur stdDeviation="0.7" />
            </filter>
            {/* The radius splits along an irregular break; the lower piece is drawn shifted. */}
            <clipPath id="scan-above">
              <path d="M0 0 H320 V219 L166 219 L151 214 L142 220 L133 211 L124 216 L108 212 L0 212 Z" />
            </clipPath>
            <clipPath id="scan-below">
              <path d="M0 215 L108 215 L124 219 L133 214 L142 223 L151 217 L166 222 L320 222 V400 H0 Z" />
            </clipPath>
            <path id="scan-radius" d="M118 14 C118 4 150 2 154 12 C158 26 150 44 148 62 L150 250 C151 300 160 330 166 352 C171 370 168 392 152 396 L118 398 C102 396 98 378 104 360 C112 334 122 300 124 250 L122 62 C120 44 116 28 118 14 Z" />
          </defs>

          <rect width="320" height="400" fill="url(#scan-film)" />
          {/* Soft tissue */}
          <path d="M70 0 C62 120 72 280 92 400 L232 400 C250 280 262 120 252 0 Z" fill="#3a3a3a" opacity="0.5" filter="url(#scan-soft)" />
          {/* Radius (left) and ulna (right) */}
          <g filter="url(#scan-edge)" opacity="0.92">
            <use href="#scan-radius" fill="url(#scan-bone)" clipPath="url(#scan-above)" />
            <g transform="translate(3 2) rotate(-1.5 138 300)">
              <use href="#scan-radius" fill="url(#scan-bone)" clipPath="url(#scan-below)" />
            </g>
            <path d="M196 6 C198 -2 234 -2 238 10 C242 26 226 40 220 58 L210 330 C209 352 212 366 210 380 C208 394 188 394 186 380 C184 366 190 352 190 330 L196 58 C194 40 194 22 196 6 Z" fill="url(#scan-bone)" />
          </g>

          {/* Orientation markers, as on a real film */}
          <text x="18" y="34" fill="#d0d0d0" fontSize="20" fontWeight="700" fontFamily="ui-monospace, monospace">L</text>
          <text x="302" y="386" fill="#8a8a8a" fontSize="9" textAnchor="end" fontFamily="ui-monospace, monospace" letterSpacing="2">PA</text>

          {/* Detector box with corner ticks, and its label */}
          <g className="scan-box" fill="none" stroke="#ffffff">
            <rect x="104" y="188" width="64" height="58" strokeWidth="1.2" pathLength="244" />
            <path d="M104 198 V188 H114 M158 188 H168 V198 M168 236 V246 H158 M114 246 H104 V236" strokeWidth="2.6" pathLength="80" />
          </g>
          <g className="scan-label">
            <rect x="104" y="170" width="86" height="15" fill="#ffffff" />
            <text x="109" y="181" fill="#0a0a0a" fontSize="9" fontFamily="ui-monospace, monospace" letterSpacing="1">FRACTURE 0.87</text>
          </g>

          {/* One pass of the reading line */}
          <rect className="scan-sweep" x="0" y="0" width="320" height="2" fill="#ffffff" opacity="0" />
        </svg>
      </div>

      <dl className="divide-y divide-white/10 border-t border-white/10 px-5 font-mono text-[11px] uppercase tracking-[0.12em] tabular-nums">
        <div className="flex justify-between gap-4 py-2.5">
          <dt className="text-white/55">Finding</dt>
          <dd>Fracture · radius</dd>
        </div>
        <div className="flex justify-between gap-4 py-2.5">
          <dt className="text-white/55">Confidence</dt>
          <dd>0.87</dd>
        </div>
        <div className="flex justify-between gap-4 py-2.5">
          <dt className="text-white/55">Models</dt>
          <dd className="text-right">EfficientNet-B2 + YOLOv8m</dd>
        </div>
        <div className="flex justify-between gap-4 py-2.5">
          <dt className="text-white/55">Status</dt>
          <dd className="flex items-center gap-2">
            <span aria-hidden="true" className="h-2 w-2 rounded-full border border-white" />
            Awaiting doctor review
          </dd>
        </div>
      </dl>
    </figure>
  )
}
