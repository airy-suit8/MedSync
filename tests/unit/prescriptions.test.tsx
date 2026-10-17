// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const { createClientMock, toast } = vi.hoisted(() => ({ createClientMock: vi.fn(), toast: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ createClient: createClientMock }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }))

import PrescriptionForm from '@/components/medical/PrescriptionForm'
import { describeItem, filledItems, PRESCRIPTIONS_CHANGED } from '@/lib/prescriptions'

afterEach(cleanup)

describe('prescription helpers', () => {
  it('drops rows without a medicine', () => {
    expect(filledItems([
      { medicine: 'A', dose: null, frequency: null, duration: null, instructions: null },
      { medicine: '  ', dose: '1', frequency: null, duration: null, instructions: null },
    ])).toHaveLength(1)
  })
  it('describes a medicine for the patient', () => {
    expect(describeItem({ medicine: 'A', dose: '1 tablet', frequency: 'Twice a day', duration: '5 days', instructions: null }))
      .toBe('1 tablet · Twice a day · for 5 days')
  })
})

describe('PrescriptionForm', () => {
  let rpc: ReturnType<typeof vi.fn>
  beforeEach(() => {
    toast.mockReset()
    rpc = vi.fn().mockResolvedValue({ data: 'rx-1', error: null })
    createClientMock.mockReset().mockReturnValue({ rpc })
  })

  it('saves the filled medicines with the report link and announces it', async () => {
    const changed = vi.fn()
    window.addEventListener(PRESCRIPTIONS_CHANGED, changed)
    render(<PrescriptionForm patientId="p1" patientName="Ravi" reportId="r1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Write prescription' }))
    fireEvent.change(await screen.findByLabelText('Medicine 1'), { target: { value: 'Paracetamol 500 mg' } })
    fireEvent.change(screen.getByLabelText('How often'), { target: { value: 'Twice a day' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add medicine' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save prescription' }))
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('create_prescription', expect.objectContaining({
      p_patient_id: 'p1', p_report_id: 'r1', p_appointment_id: null,
      p_items: [expect.objectContaining({ medicine: 'Paracetamol 500 mg', frequency: 'Twice a day' })],
    })))
    expect(await screen.findByRole('link', { name: 'Open and print' })).toHaveProperty('href', expect.stringContaining('/prescriptions/rx-1'))
    expect(changed).toHaveBeenCalled()
    window.removeEventListener(PRESCRIPTIONS_CHANGED, changed)
  })

  it('needs at least one medicine', async () => {
    render(<PrescriptionForm patientId="p1" patientName="Ravi" />)
    fireEvent.click(screen.getByRole('button', { name: 'Write prescription' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Save prescription' }))
    expect(rpc).not.toHaveBeenCalled()
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Add at least one medicine' }))
  })
})
