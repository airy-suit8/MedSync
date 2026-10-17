import { z } from "zod"

// POST /api/ml-process: everything else (file, patient, doctor, test type) is read from
// the report itself, so the browser can't send mismatched details.
export const reportProcessingSchema = z.object({
    reportId: z.string().uuid("Invalid Report ID format"),
    runAi: z.boolean().default(true),
})

export type ReportProcessingRequest = z.infer<typeof reportProcessingSchema>
