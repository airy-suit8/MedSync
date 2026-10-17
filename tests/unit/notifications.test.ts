import { describe, expect, it } from 'vitest'
import { notificationLink, type AppNotification } from '@/lib/notifications'

const base: AppNotification = {
  id: 'n1', title: 't', message: 'm', notification_type: 'general', is_read: false,
  related_id: null, related_type: null, action_url: null, created_at: '2026-10-18T00:00:00Z',
}

describe('notificationLink', () => {
  it('uses the stored link within the viewer\'s own area', () => {
    expect(notificationLink({ ...base, action_url: '/doctor-dashboard/reports/r1' }, 'doctor')).toBe('/doctor-dashboard/reports/r1')
    expect(notificationLink({ ...base, action_url: '/prescriptions/x' }, 'patient')).toBe('/prescriptions/x')
  })

  it('never sends a user into another role\'s dashboard or off the site', () => {
    expect(notificationLink({ ...base, action_url: '/doctor-dashboard/reports/r1' }, 'patient')).toBeNull()
    expect(notificationLink({ ...base, action_url: 'https://evil.example' }, 'patient')).toBeNull()
    expect(notificationLink({ ...base, action_url: '//evil.example/x' }, 'patient')).toBeNull()
  })

  it.each([
    ['report', 'patient', '/patient-dashboard/reports/r1'],
    ['report', 'doctor', '/doctor-dashboard/reports/r1'],
    ['report', 'lab', null],
    ['prescription', 'patient', '/prescriptions/r1'],
    ['appointment', 'doctor', '/doctor-dashboard/patients'],
    ['ml_suggestion', 'doctor', '/doctor-dashboard/reports'],
    ['something_else', 'doctor', null],
  ] as const)('falls back for older %s notifications seen by a %s', (relatedType, role, expected) => {
    expect(notificationLink({ ...base, related_id: 'r1', related_type: relatedType }, role)).toBe(expected)
  })
})
