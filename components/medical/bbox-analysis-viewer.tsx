"use client"

import Image from "next/image"
import { useMemo, useState } from "react"

type Detection = {
  confidence: number
  bbox: [number, number, number, number]
}

type AnalysisDetails = {
  uncertain?: boolean
  uncertainty_reason?: string
  models_agree?: boolean
  effnet_score?: number
  yolo_score?: number
  ensemble_score?: number
  image_width?: number
  image_height?: number
  detections?: Detection[]
}

interface Props {
  imageUrl: string
  details?: AnalysisDetails | null
}

export default function BBoxAnalysisViewer({ imageUrl, details }: Props) {
  const [showBoxes, setShowBoxes] = useState(true)
  const imageWidth = details?.image_width
  const imageHeight = details?.image_height

  const normalizedDetections = useMemo(() => {
    const detections = details?.detections ?? []
    if (!imageWidth || !imageHeight) return []

    return detections
      .map((det) => {
        const [x1, y1, x2, y2] = det.bbox
        const left = (x1 / imageWidth) * 100
        const top = (y1 / imageHeight) * 100
        const width = ((x2 - x1) / imageWidth) * 100
        const height = ((y2 - y1) / imageHeight) * 100
        return {
          confidence: det.confidence,
          left,
          top,
          width,
          height,
        }
      })
      .filter((det) => det.width > 0 && det.height > 0)
  }, [details?.detections, imageWidth, imageHeight])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">X-ray Bounding Box Analysis</h3>
        <button
          type="button"
          onClick={() => setShowBoxes((prev) => !prev)}
          className="rounded-md border px-3 py-1 text-sm hover:bg-gray-50"
        >
          {showBoxes ? "Hide Boxes" : "Show Boxes"}
        </button>
      </div>

      <div className="relative mx-auto w-full max-w-xl overflow-hidden rounded-lg border bg-black/5">
        <img
          src={imageUrl}
          alt="X-ray with detection overlay"
          className="h-auto w-full object-contain"
        />
        {showBoxes &&
          normalizedDetections.map((det, idx) => (
            <div
              key={`${idx}-${det.left}-${det.top}`}
              className="absolute border-2 border-red-500 bg-red-500/10"
              style={{
                left: `${det.left}%`,
                top: `${det.top}%`,
                width: `${det.width}%`,
                height: `${det.height}%`,
              }}
            >
              <span className="absolute left-0 top-0 -translate-y-full rounded bg-red-600 px-1 py-0.5 text-xs text-white">
                fracture {det.confidence.toFixed(2)}
              </span>
            </div>
          ))}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className={`rounded-lg p-3 ${details?.uncertain ? "bg-amber-50" : "bg-green-50"}`}>
          <p className="text-sm font-semibold">
            {details?.uncertain ? "Uncertainty: Review Required" : "Uncertainty: Low"}
          </p>
          <p className="text-sm text-gray-700">
            {details?.uncertainty_reason || "No uncertainty metadata available."}
          </p>
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-sm font-semibold">Model Metrics</p>
          <p className="text-sm text-gray-700">EfficientNet: {(details?.effnet_score ?? 0).toFixed(3)}</p>
          <p className="text-sm text-gray-700">YOLO: {(details?.yolo_score ?? 0).toFixed(3)}</p>
          <p className="text-sm text-gray-700">Ensemble: {(details?.ensemble_score ?? 0).toFixed(3)}</p>
          <p className="text-sm text-gray-700">
            Models agree: {details?.models_agree === true ? "Yes" : details?.models_agree === false ? "No" : "Unknown"}
          </p>
          <p className="text-sm text-gray-700">Detections: {details?.detections?.length || 0}</p>
        </div>
      </div>
    </div>
  )
}
