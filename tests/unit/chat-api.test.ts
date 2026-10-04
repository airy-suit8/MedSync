import { beforeEach, describe, expect, it, vi } from 'vitest'

const { client, queryResult, inserted, handlers } = vi.hoisted(() => {
  const queryResult = { data: null as any, count: null as number | null, error: null as any }
  const inserted: any[] = []
  const handlers: Function[] = []
  const builder: any = {}
  for (const method of ['insert', 'update', 'select', 'eq', 'or', 'order', 'upsert', 'limit']) {
    builder[method] = vi.fn((value?: any) => { if (method === 'insert' || method === 'update' || method === 'upsert') inserted.push(value); return builder })
  }
  builder.single = vi.fn(async () => queryResult)
  builder.then = (resolve: any) => Promise.resolve(queryResult).then(resolve)
  const channel: any = {
    on: vi.fn((_kind: any, _filter: any, callback: Function) => { handlers.push(callback); return channel }),
    subscribe: vi.fn(() => channel), unsubscribe: vi.fn(), send: vi.fn(async () => ({ status: 'ok' })),
  }
  const client = {
    from: vi.fn(() => builder), channel: vi.fn(() => channel),
    storage: { from: vi.fn(() => ({ upload: vi.fn(async () => ({ data: {}, error: null })), getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://files.test/a' } })) })) },
  }
  return { client, queryResult, inserted, handlers }
})
vi.mock('@/lib/supabase', () => ({ createClient: () => client }))
import { chatAPI } from '@/lib/chat-api'

describe('ChatAPI with an isolated query client', () => {
  beforeEach(() => {
    queryResult.data = null; queryResult.count = null; queryResult.error = null
    inserted.length = 0; handlers.length = 0
  })
  it('creates messages and preserves HTML text as text payload', async () => {
    const row = { id: 'm1', content: '<script>x</script>', sender_id: 'a', receiver_id: 'b' }
    queryResult.data = row
    await expect(chatAPI.sendMessage({ content: row.content, sender_id: 'a', sender_name: 'A', sender_role: 'patient', receiver_id: 'b', receiver_name: 'B', receiver_role: 'doctor' })).resolves.toEqual(row)
    expect(inserted[0]).toMatchObject({ content: row.content, is_read: false, message_type: 'text' })
  })
  it('returns null for insert errors and sends file metadata', async () => {
    queryResult.error = { message: 'denied' }
    await expect(chatAPI.sendMessage({ content: 'x', sender_id: 'a', sender_name: 'A', sender_role: 'lab', receiver_id: 'b', receiver_name: 'B', receiver_role: 'doctor' })).resolves.toBeNull()
    queryResult.error = null; queryResult.data = { id: 'file-message' }
    await expect(chatAPI.sendFile(new File(['data'], 'scan.png'), 'a', 'A', 'lab', 'b', 'B', 'doctor')).resolves.toMatchObject({ id: 'file-message' })
    expect(inserted.at(-1)).toMatchObject({ message_type: 'file', file_url: 'https://files.test/a', file_name: 'scan.png', file_size: 4 })
  })
  it('lists messages and returns empty lists on query errors', async () => {
    queryResult.data = [{ id: 'm1' }]
    await expect(chatAPI.getMessages('a', 'b')).resolves.toEqual([{ id: 'm1' }])
    queryResult.error = { message: 'denied' }
    await expect(chatAPI.getMessages('a', 'b')).resolves.toEqual([])
  })
  it('counts unread messages, reads typing status, and lists notifications', async () => {
    queryResult.count = 3
    await expect(chatAPI.getUnreadCount('b')).resolves.toBe(3)
    queryResult.data = { user_id: 'b', is_typing: true }
    await expect(chatAPI.getTypingStatus('b')).resolves.toEqual(queryResult.data)
    queryResult.data = [{ id: 'n1' }]
    await expect(chatAPI.getNotifications('b')).resolves.toEqual([{ id: 'n1' }])
  })
  it('writes typing and notification updates without surfacing rejected writes', async () => {
    await chatAPI.setTypingStatus('a', 'Alice', true)
    await chatAPI.sendNotification({ title: 'New message', message: 'Hello', type: 'message', sender_id: 'a', receiver_id: 'b', is_read: false })
    await chatAPI.markMessagesAsRead('a', 'b')
    await chatAPI.markNotificationAsRead('n1')
    expect(client.from).toHaveBeenCalledWith('typing_status')
    chatAPI.cleanup()
  })
  it('filters real-time messages to either conversation participant', () => {
    const callback = vi.fn()
    chatAPI.subscribeToMessages('me', callback)
    handlers.at(-1)?.({ new: { id: 'm1', sender_id: 'me', receiver_id: 'other' } })
    handlers.at(-1)?.({ new: { id: 'm2', sender_id: 'other', receiver_id: 'third' } })
    expect(callback).toHaveBeenCalledTimes(1)
  })
})
