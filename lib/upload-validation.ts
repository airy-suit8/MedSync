// What a lab may upload as a report: PDF, JPEG, PNG or DICOM, at most 10 MB, with a
// matching extension AND matching file contents (the first bytes), so "scan.pdf.exe",
// empty files or a renamed text file are refused before anything is stored.
export const MAX_REPORT_BYTES = 10 * 1024 * 1024

const KINDS: Record<string, { mime: string; matches: (b: Uint8Array) => boolean }> = {
  pdf: { mime: "application/pdf", matches: (b) => ascii(b, 0, 5) === "%PDF-" },
  png: { mime: "image/png", matches: (b) => b[0] === 0x89 && ascii(b, 1, 4) === "PNG" },
  jpg: { mime: "image/jpeg", matches: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  jpeg: { mime: "image/jpeg", matches: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  dcm: { mime: "application/dicom", matches: (b) => ascii(b, 128, 132) === "DICM" },
  dicom: { mime: "application/dicom", matches: (b) => ascii(b, 128, 132) === "DICM" },
}

function ascii(bytes: Uint8Array, from: number, to: number) {
  return String.fromCharCode(...bytes.slice(from, to))
}

export function extensionOf(name: string) {
  const dot = name.lastIndexOf(".")
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : ""
}

// Returns an error message for the lab, or null when the file is fine.
export async function checkReportFile(file: File): Promise<string | null> {
  if (file.size === 0) return "This file is empty."
  if (file.size > MAX_REPORT_BYTES) return "Files must be 10 MB or smaller."
  const kind = KINDS[extensionOf(file.name)]
  if (!kind) return "Upload a PDF, JPEG, PNG or DICOM file."
  const head = new Uint8Array(await file.slice(0, 132).arrayBuffer())
  if (!kind.matches(head)) return `This file is not a valid ${extensionOf(file.name).toUpperCase()}.`
  return null
}

export function contentTypeOf(file: File) {
  return KINDS[extensionOf(file.name)]?.mime || file.type || "application/octet-stream"
}
