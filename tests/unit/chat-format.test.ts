import { describe, expect, it, vi } from 'vitest'
vi.mock('@/lib/supabase', () => ({ createClient: () => ({}) }))
import { formatFileSize, getFileIcon, isImageFile } from '@/lib/chat-api'

describe('chat file display helpers', () => {
  it.each([[0, '0 Bytes'], [1023, '1023 Bytes'], [1024, '1 KB'], [1024 * 1024, '1 MB'], [-1, 'NaN undefined']])('formats %s bytes', (size, expected) => expect(formatFileSize(size)).toBe(expected))
  it.each([['scan.PNG', true], ['photo.jpeg', true], ['doc.pdf', false], ['image.png.exe', false], ['', false]])('recognizes image %s', (name, expected) => expect(isImageFile(name)).toBe(expected))
  it.each([['file.pdf', '📄'], ['photo.png', '🖼️'], ['clip.mp4', '📎'], ['archive.zip', '📎'], ['a.PDF', '📄']])('chooses icon for %s', (name, expected) => expect(getFileIcon(name)).toBe(expected))
})
