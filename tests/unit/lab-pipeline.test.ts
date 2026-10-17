import { describe, expect, it } from 'vitest'
import { labReadingToSuggestion, parseLabReading } from '@/lib/lab-report-ai'
import { checkReportFile, extensionOf } from '@/lib/upload-validation'

describe('parseLabReading (model output is untrusted)', () => {
  it('keeps well-formed rows and normalises unknown flags', () => {
    const reading = parseLabReading(JSON.stringify({
      tests: [
        { name: 'Haemoglobin', value: '10.2', unit: 'g/dL', range: '13-17', flag: 'low' },
        { name: 'WBC', value: '7', unit: null, range: null, flag: 'weird' },
        { name: '', value: '1' },
        { value: 'no name' },
      ],
      summary: 'Haemoglobin is below its reference range.',
    }))
    expect(reading.tests).toEqual([
      { name: 'Haemoglobin', value: '10.2', unit: 'g/dL', range: '13-17', flag: 'low' },
      { name: 'WBC', value: '7', unit: null, range: null, flag: 'unknown' },
    ])
  })

  it('caps sizes and needs a summary', () => {
    const many = { tests: Array.from({ length: 500 }, (_, i) => ({ name: `T${i}`, value: '1', flag: 'normal' })), summary: 'x'.repeat(5000) }
    const reading = parseLabReading(many)
    expect(reading.tests).toHaveLength(200)
    expect(reading.summary).toHaveLength(1200)
    expect(() => parseLabReading({ tests: [] })).toThrow()
  })
})

describe('labReadingToSuggestion', () => {
  it('lists out-of-range values and marks them mild; the doctor judges how much they matter', () => {
    const s = labReadingToSuggestion({ summary: 'One value is low.', tests: [
      { name: 'Hb', value: '10', unit: null, range: '13-17', flag: 'low' },
      { name: 'WBC', value: '7', unit: null, range: '4-11', flag: 'normal' },
    ] })
    expect(s).toMatchObject({ severity: 'mild', confidence: null, recommendations: 'Outside the reference range: Hb (low).' })
    expect(s.details).toEqual({ kind: 'lab_values', tests: expect.any(Array) })
  })
  it('says when everything is in range, or when nothing could be read', () => {
    expect(labReadingToSuggestion({ summary: 's', tests: [{ name: 'A', value: '1', unit: null, range: '0-2', flag: 'normal' }] }).severity).toBe('none')
    expect(labReadingToSuggestion({ summary: 's', tests: [] }).recommendations).toMatch(/could be read/)
  })
})

describe('checkReportFile', () => {
  const file = (name: string, bytes: number[] | string, size?: number) => {
    const content = typeof bytes === 'string' ? new TextEncoder().encode(bytes) : new Uint8Array(bytes)
    const f = new File([content], name)
    return size ? Object.defineProperty(f, 'size', { value: size }) : f
  }

  it.each([
    ['report.pdf', '%PDF-1.4\n...', null],
    ['scan.PNG', [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a], null],
    ['photo.jpg', [0xff, 0xd8, 0xff, 0xe0], null],
  ])('accepts a real %s', async (name, bytes, expected) => {
    expect(await checkReportFile(file(name, bytes))).toBe(expected)
  })

  it.each([
    ['empty.pdf', '', /empty/],
    ['no-extension', '%PDF-1.4', /PDF, JPEG, PNG or DICOM/],
    ['double.pdf.exe', '%PDF-1.4', /PDF, JPEG, PNG or DICOM/],
    ['corrupt.pdf', 'not a PDF', /not a valid PDF/],
    ['renamed.png', '%PDF-1.4', /not a valid PNG/],
  ])('refuses %s', async (name, bytes, message) => {
    expect(await checkReportFile(file(name, bytes))).toMatch(message)
  })

  it('refuses files over 10 MB', async () => {
    expect(await checkReportFile(file('big.pdf', '%PDF-1.4', 10 * 1024 * 1024 + 1))).toMatch(/10 MB/)
  })

  it('reads only the last extension', () => {
    expect(extensionOf('a.pdf.exe')).toBe('exe')
    expect(extensionOf('.hidden')).toBe('')
  })
})
