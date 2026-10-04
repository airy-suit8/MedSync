import { describe, expect, it } from 'vitest'
import { analysisRequestSchema } from '@/lib/schemas'
import { cn } from '@/lib/utils'
import { isDemoAppointment, isValidUUID } from '@/lib/appointment-utils'

const valid = { fileName: 'abc.png', originalName: 'scan.png', patientId: 'p-1', testType: 'x_ray', reportId: '123e4567-e89b-12d3-a456-426614174000' }
describe('analysis request validation', () => {
  it('accepts valid shape and nullable doctor', () => {
    expect(analysisRequestSchema.parse(valid)).toEqual(valid)
    expect(analysisRequestSchema.parse({ ...valid, doctorId: null }).doctorId).toBeNull()
  })
  it.each([
    ['fileName', ''], ['originalName', ''], ['patientId', ''], ['testType', 'ultrasound'], ['reportId', 'not-a-uuid'],
  ])('rejects invalid %s', (field, value) => expect(analysisRequestSchema.safeParse({ ...valid, [field]: value }).success).toBe(false))
  it('rejects wrong field types, missing fields and bad report UUIDs', () => {
    expect(analysisRequestSchema.safeParse({ ...valid, patientId: 12 }).success).toBe(false)
    expect(analysisRequestSchema.safeParse({ ...valid, doctorId: 42 }).success).toBe(false)
    expect(analysisRequestSchema.safeParse({ ...valid, reportId: '00000000-0000-0000-0000-000000000000' }).success).toBe(true)
    expect(analysisRequestSchema.safeParse({ fileName: 'x' }).success).toBe(false)
  })
  it('currently accepts additional keys and long names (recorded behavior)', () => {
    expect(analysisRequestSchema.safeParse({ ...valid, ignored: true }).success).toBe(true)
    expect(analysisRequestSchema.safeParse({ ...valid, originalName: 'x'.repeat(10000) }).success).toBe(true)
  })
})
describe('appointment identifiers', () => {
  it.each(['123e4567-e89b-12d3-a456-426614174000', '550e8400-e29b-41d4-a716-446655440000'])('valid UUID %s', id => expect(isValidUUID(id)).toBe(true))
  it.each(['', 'x', 'demo-123', '123e4567-e89b-12d3-a456-42661417400z'])('rejects malformed UUID %s', id => expect(isValidUUID(id)).toBe(false))
  it('classifies demo and malformed IDs as demo appointments', () => {
    expect(isDemoAppointment('demo-42')).toBe(true)
    expect(isDemoAppointment('bad-id')).toBe(true)
    expect(isDemoAppointment('123e4567-e89b-12d3-a456-426614174000')).toBe(false)
  })
})
describe('class names', () => {
  it('merges conflicting Tailwind classes and ignores false values', () => expect(cn('px-2', false && 'hidden', 'px-4', 'text-red-500')).toBe('px-4 text-red-500'))
})
