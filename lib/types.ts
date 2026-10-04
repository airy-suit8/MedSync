import { Database } from './database.types'

export interface PatientInfo {
  patientId: string
  fullName: string
  dateOfBirth: string
  age: number
  gender: string
  phoneNumber: string
  address: string
  eyeSide: string
  familyHistoryOfCancer: string
  previousDiagnosis: string
  ongoingTreatments: string
  recordCreated: string
  lastUpdated: string
}

export interface ReportResult {
  // Legacy fields (to be removed)
  prediction?: boolean
  probability?: number
  message?: string
  success?: boolean
  
  // Med-Gemma specific fields
  findings?: string
  confidence?: number
  recommendations?: string
  severity?: string
  details?: {
    effnet_score?: number
    yolo_score?: number
    ensemble_score?: number
    models_agree?: boolean
    uncertain?: boolean
    uncertainty_reason?: string
    image_width?: number
    image_height?: number
    detections?: Array<{
      confidence: number
      bbox: [number, number, number, number]
    }>
  }
}

type DbReport = Database['public']['Tables']['reports']['Row']

export interface Report extends Omit<DbReport, 'result' | 'patient_info'> {
  // Override JSONB fields with custom interfaces
  result?: ReportResult | null
  patient_info?: PatientInfo | null
  
  // Keep legacy camelCase fields to prevent massive regressions in components
  overlayedImageUrl?: string | null
  maskedImageUrl?: string | null
  originalImageUrl?: string | null
  patientInfo?: PatientInfo | null
  createdAt?: string | null
  updatedAt?: string | null
  user_name?: string | null
}