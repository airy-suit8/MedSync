// Reads a lab report (blood, urine) with Gemini: every test value with its reference
// range and a flag, plus a plain-language summary for the patient. Server-only (needs
// GEMINI_API_KEY). The doctor reviews the result before the patient sees it.
//
// Privacy: on Gemini's free tier Google may use submitted content to improve its
// products. Real patient reports need the paid tier (see docs/AUDIT_REPORT.md, D7).

export type LabFlag = "low" | "high" | "normal" | "unknown"
export type LabValue = { name: string; value: string; unit: string | null; range: string | null; flag: LabFlag }
export type LabReading = { tests: LabValue[]; summary: string }

export const LAB_AI_TEST_TYPES = ["blood_test", "urine_test"]
export const LAB_AI_MIME_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp"]
const MAX_INLINE_BYTES = 15 * 1024 * 1024
const MODELS = ["gemini-2.5-flash", "gemini-2.0-flash"]

const PROMPT = `You are reading a laboratory test report for a doctor.
Extract every test result exactly as printed: name, value, unit and the printed reference range.
Set flag to "low" or "high" only when the value is outside the printed reference range, "normal" when it is inside, and "unknown" when there is no range.
Then write "summary": 2 to 4 short sentences in plain English for the patient, saying which values are outside their reference range.
Do not diagnose, name diseases or suggest treatment; the doctor will review this first.
If the document is not a lab report, return an empty "tests" list and say so in "summary".`

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    tests: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          value: { type: "STRING" },
          unit: { type: "STRING", nullable: true },
          range: { type: "STRING", nullable: true },
          flag: { type: "STRING", enum: ["low", "high", "normal", "unknown"] },
        },
        required: ["name", "value", "flag"],
      },
    },
    summary: { type: "STRING" },
  },
  required: ["tests", "summary"],
}

const text = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null)

// Model output is untrusted: keep only well-formed rows, cap sizes.
export function parseLabReading(raw: unknown): LabReading {
  const obj = (typeof raw === "string" ? JSON.parse(raw) : raw) as { tests?: unknown; summary?: unknown }
  const tests = (Array.isArray(obj?.tests) ? obj.tests : []).slice(0, 200).flatMap((t: any) => {
    const name = text(t?.name, 120)
    const value = text(t?.value, 60)
    if (!name || !value) return []
    const flag: LabFlag = ["low", "high", "normal", "unknown"].includes(t?.flag) ? t.flag : "unknown"
    return [{ name, value, unit: text(t?.unit, 30), range: text(t?.range, 60), flag }]
  })
  const summary = text(obj?.summary, 1200)
  if (!summary) throw new Error("Lab reading had no summary")
  return { tests, summary }
}

// What goes into ml_suggestions. Severity only says whether anything is out of range;
// how much that matters is the doctor's call.
export function labReadingToSuggestion(reading: LabReading) {
  const outOfRange = reading.tests.filter((t) => t.flag === "low" || t.flag === "high")
  return {
    findings: reading.summary,
    recommendations: outOfRange.length
      ? `Outside the reference range: ${outOfRange.map((t) => `${t.name} (${t.flag})`).join(", ")}.`
      : reading.tests.length ? "All values are within their reference ranges." : "No test values could be read from this file.",
    confidence: null,
    severity: outOfRange.length ? "mild" : "none",
    details: { kind: "lab_values", tests: reading.tests },
  }
}

export async function readLabReport(file: Blob, mimeType: string, apiKey: string): Promise<LabReading> {
  if (!LAB_AI_MIME_TYPES.includes(mimeType)) throw new Error(`Cannot read ${mimeType} lab reports`)
  if (file.size > MAX_INLINE_BYTES) throw new Error("Lab report file is too large to read")
  const data = Buffer.from(await file.arrayBuffer()).toString("base64")
  let lastError = "no model tried"
  for (const model of MODELS) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ inline_data: { mime_type: mimeType, data } }, { text: PROMPT }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 8192, responseMimeType: "application/json", responseSchema: RESPONSE_SCHEMA },
      }),
      signal: AbortSignal.timeout(45_000),
    })
    if (!response.ok) {
      lastError = `${model} responded ${response.status}`
      continue
    }
    const body = await response.json()
    const out = body?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || "").join("")
    if (out) return parseLabReading(out)
    lastError = `${model} returned no content`
  }
  throw new Error(`Lab report could not be read: ${lastError}`)
}
