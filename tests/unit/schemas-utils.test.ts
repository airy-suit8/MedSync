import { describe, expect, it } from 'vitest'
import { reportProcessingSchema } from '@/lib/schemas'
import { cn } from '@/lib/utils'
import { isValidUUID } from '@/lib/appointment-utils'

const reportId = '123e4567-e89b-12d3-a456-426614174000'
describe('report processing request validation', () => {
  it('needs only the report ID; AI runs unless switched off', () => {
    expect(reportProcessingSchema.parse({ reportId })).toEqual({ reportId, runAi: true })
    expect(reportProcessingSchema.parse({ reportId, runAi: false }).runAi).toBe(false)
  })
  it.each([
    [{}], [{ reportId: 'not-a-uuid' }], [{ reportId, runAi: 'yes' }], [null],
  ])('rejects %j', (body) => expect(reportProcessingSchema.safeParse(body).success).toBe(false))
  it('ignores client-sent file, patient and doctor details', () => {
    const parsed = reportProcessingSchema.parse({ reportId, fileName: 'x', patientId: 'p', doctorId: 'd' })
    expect(parsed).toEqual({ reportId, runAi: true })
  })
})
describe('appointment identifiers', () => {
  it.each(['123e4567-e89b-12d3-a456-426614174000', '550e8400-e29b-41d4-a716-446655440000'])('valid UUID %s', id => expect(isValidUUID(id)).toBe(true))
  it.each(['', 'x', 'demo-123', '123e4567-e89b-12d3-a456-42661417400z'])('rejects malformed UUID %s', id => expect(isValidUUID(id)).toBe(false))
})
describe('class names', () => {
  it('merges conflicting Tailwind classes and ignores false values', () => expect(cn('px-2', false && 'hidden', 'px-4', 'text-red-500')).toBe('px-4 text-red-500'))
})
