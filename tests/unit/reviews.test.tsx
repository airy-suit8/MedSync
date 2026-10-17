// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const { createClientMock, toast } = vi.hoisted(() => ({ createClientMock: vi.fn(), toast: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ createClient: createClientMock }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }))

import ReportReviewPanel from '@/components/medical/ReportReviewPanel'
import DictationButton from '@/components/medical/DictationButton'

afterEach(() => {
  cleanup()
  delete (window as any).webkitSpeechRecognition
})

function query(result: unknown) {
  const builder: any = new Proxy({}, {
    get: (_t, prop) => prop === 'then' ? (resolve: (v: unknown) => void) => resolve(result) : () => builder,
  })
  return builder
}

describe('ReportReviewPanel', () => {
  let rpc: ReturnType<typeof vi.fn>
  beforeEach(() => {
    toast.mockReset()
    rpc = vi.fn().mockResolvedValue({ error: null })
    createClientMock.mockReset().mockReturnValue({
      from: () => query({ data: [] }),
      rpc,
      storage: { from: () => ({ createSignedUrl: vi.fn().mockResolvedValue({ data: null }), upload: vi.fn().mockResolvedValue({ error: null }) }) },
    })
  })

  it('offers a verdict on the AI reading and saves the review', async () => {
    render(<ReportReviewPanel reportId="r1" doctorId="d1" hasAi />)
    fireEvent.click(await screen.findByLabelText('Agree with the AI'))
    fireEvent.change(screen.getByLabelText('Note for the patient'), { target: { value: 'Keep the cast on.' } })
    fireEvent.change(screen.getByLabelText('Private note for other doctors'), { target: { value: 'Re-image in 6 weeks.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save review' }))
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('submit_report_review', {
      p_report_id: 'r1', p_verdict: 'agree', p_patient_note: 'Keep the cast on.', p_private_note: 'Re-image in 6 weeks.', p_note_image_path: null,
    }))
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Review saved' }))
  })

  it('asks for a verdict before saving', async () => {
    render(<ReportReviewPanel reportId="r1" doctorId="d1" hasAi />)
    fireEvent.click(await screen.findByRole('button', { name: 'Save review' }))
    expect(rpc).not.toHaveBeenCalled()
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Choose a verdict' }))
  })

  it('only offers "Reviewed" when there is no AI reading', async () => {
    render(<ReportReviewPanel reportId="r1" doctorId="d1" hasAi={false} />)
    const reviewed = await screen.findByLabelText('Reviewed')
    await waitFor(() => expect((reviewed as HTMLInputElement).checked).toBe(true))
    expect(screen.queryByLabelText('Agree with the AI')).toBeNull()
  })
})

describe('DictationButton', () => {
  it('is hidden when the browser has no speech recognition', () => {
    render(<DictationButton label="note" onText={vi.fn()} />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('appends what was said', async () => {
    let instance: any
    ;(window as any).webkitSpeechRecognition = function (this: any) { instance = this; this.start = vi.fn(); this.stop = vi.fn() }
    const onText = vi.fn()
    render(<DictationButton label="note" onText={onText} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Dictate note' }))
    instance.onresult({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: ' fracture of the radius ' } }] })
    expect(onText).toHaveBeenCalledWith('fracture of the radius')
  })
})
