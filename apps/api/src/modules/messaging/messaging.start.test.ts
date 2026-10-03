import { describe, expect, it, vi } from 'vitest'
import type { Clock } from '../../lib/clock'
import type { ConversationRow, MessagingRepository, PersonRow } from './messaging.repository'
import { createMessagingService } from './messaging.service'

// Ordered the way the pair key sorts them, so the expected key reads left to right.
const teacher: PersonRow = {
  id: '11111111-1111-4111-8111-111111111111',
  full_name: 'Teacher',
  email: 'teacher@example.com',
  role: 'teacher',
}
const student: PersonRow = {
  id: '22222222-2222-4222-8222-222222222222',
  full_name: 'Student',
  email: 'student@example.com',
  role: 'student',
}
const PAIR_KEY = `${teacher.id}:${student.id}`

function conversationWith(...people: PersonRow[]): ConversationRow {
  return {
    id: 'conversation',
    last_message_at: null,
    last_message_body: null,
    last_message_sender_id: null,
    conversation_participants: people.map((profile) => ({
      profile_id: profile.id,
      last_read_at: null,
      unread_count: 0,
      profile,
    })),
  }
}

/** The student writes to their teacher, who is linked to them unless a test says otherwise. */
function setup(existing: ConversationRow | null) {
  const messaging = {
    listConversations: vi.fn(),
    findConversation: vi.fn(),
    findByPairKey: vi.fn().mockResolvedValue(existing),
    openConversation: vi.fn().mockResolvedValue('opened'),
    sumUnread: vi.fn(),
    listActivity: vi.fn(),
    listMessages: vi.fn(),
    sendIfAllowed: vi.fn(),
    markRead: vi.fn(),
    findPerson: vi.fn().mockResolvedValue(teacher),
    listByRole: vi.fn(),
    listLinkedTo: vi.fn(),
    areLinked: vi.fn().mockResolvedValue(true),
  } satisfies MessagingRepository
  const clock: Clock = { now: () => new Date('2026-10-01T09:00:00.000Z') }
  const service = createMessagingService({ messaging, clock })

  return {
    messaging,
    start: () =>
      service.startWith({
        viewer: { id: student.id, role: student.role },
        recipientId: teacher.id,
      }),
  }
}

describe('starting a conversation', () => {
  it('returns the conversation the pair already has without writing anything', async () => {
    const { messaging, start } = setup(conversationWith(teacher, student))

    await expect(start()).resolves.toEqual({ id: 'conversation' })
    expect(messaging.findByPairKey).toHaveBeenCalledWith(PAIR_KEY)
    expect(messaging.findPerson).not.toHaveBeenCalled()
    expect(messaging.openConversation).not.toHaveBeenCalled()
  })

  it('opens a new one through the write that two simultaneous starts can share', async () => {
    const { messaging, start } = setup(null)

    await expect(start()).resolves.toEqual({ id: 'opened' })
    expect(messaging.areLinked).toHaveBeenCalledWith(teacher.id, student.id)
    expect(messaging.openConversation).toHaveBeenCalledWith(PAIR_KEY, [student.id, teacher.id])
  })

  // The two writes behind a new conversation are separate requests. When the second one
  // failed, the pair used to be answered "no such person" from then on.
  it.each([
    ['nobody', []],
    ['only the caller', [student]],
  ])('finishes a conversation left with %s in it', async (_, people) => {
    const { messaging, start } = setup(conversationWith(...people))

    await expect(start()).resolves.toEqual({ id: 'opened' })
    expect(messaging.findPerson).toHaveBeenCalledWith(teacher.id)
    expect(messaging.openConversation).toHaveBeenCalledWith(PAIR_KEY, [student.id, teacher.id])
  })

  it('still refuses somebody the caller may not write to', async () => {
    const { messaging, start } = setup(conversationWith(student))
    messaging.areLinked.mockResolvedValue(false)

    await expect(start()).rejects.toMatchObject({ code: 'forbidden', status: 403 })
    expect(messaging.openConversation).not.toHaveBeenCalled()
  })

  it('answers not found for somebody who is not there', async () => {
    const { messaging, start } = setup(null)
    messaging.findPerson.mockResolvedValue(null)

    await expect(start()).rejects.toMatchObject({ code: 'not_found', status: 404 })
    expect(messaging.openConversation).not.toHaveBeenCalled()
  })
})
