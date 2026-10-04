import { z } from "zod"

export const analysisRequestSchema = z.object({
    fileName: z.string().min(1, "File name is required"),
    originalName: z.string().min(1, "Original name is required"),
    patientId: z.string().min(1, "Patient ID is required"),
    doctorId: z.string().optional().nullable(),
    testType: z.enum(["x_ray", "mri", "blood_test", "other"], {
        errorMap: () => ({ message: "Invalid test type" }),
    }),
    reportId: z.string().uuid("Invalid Report ID format"),
})

export type AnalysisRequest = z.infer<typeof analysisRequestSchema>
