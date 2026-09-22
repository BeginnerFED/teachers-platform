import { describe, expect, it, vi } from 'vitest'
import type { Clock } from '../../lib/clock'
import type {
  ConversationRow,
  MessageRow,
  MessagingRepository,
  PersonRow,
} from './messaging.repository'
import { createMessagingService } from './messaging.service'

const NOW = '2026-09-22T09:00:00.000Z'

const teacher: PersonRow = {
  id: 'teacher',
  full_name: 'Teacher',
  email: 'teacher@example.com',
  role: 'teacher',
}
const student: PersonRow = {
  id: 'student',
  full_name: 'Student',
  email: 'student@example.com',
  role: 'student',
}
const admin: PersonRow = {
  id: 'admin',
  full_name: 'Admin',
  email: 'admin@example.com',
  role: 'admin',
}

function conversationBetween(first: PersonRow, second: PersonRow): ConversationRow {
  return {
    id: 'conversation',
    last_message_at: NOW,
    last_message_body: 'Earlier message',
    last_message_sender_id: first.id,
    conversation_participants: [first, second].map((profile) => ({
      profile_id: profile.id,
      last_read_at: null,
      unread_count: 0,
      profile,
    })),
  }
}

function repository(overrides: Partial<MessagingRepository> = {}): MessagingRepository {
  return {
    listConversations: vi.fn().mockResolvedValue([]),
    findConversation: vi.fn().mockResolvedValue(null),
    findByPairKey: vi.fn().mockResolvedValue(null),
    createConversation: vi.fn().mockResolvedValue('conversation'),
    sumUnread: vi.fn().mockResolvedValue(0),
    listMessages: vi.fn().mockResolvedValue([]),
    sendIfAllowed: vi.fn(),
    markRead: vi.fn().mockResolvedValue(undefined),
    findPerson: vi.fn().mockResolvedValue(null),
    listByRole: vi.fn().mockResolvedValue([]),
    listLinkedTo: vi.fn().mockResolvedValue([]),
    areLinked: vi.fn().mockResolvedValue(false),
    ...overrides,
  }
}

function service(messaging: MessagingRepository) {
  const clock: Clock = { now: () => new Date(NOW) }
  return createMessagingService({ messaging, clock })
}

describe('messaging authorization', () => {
  it.each([
    ['teacher', teacher, student],
    ['student', student, teacher],
  ] as const)(
    'blocks an unlinked %s from writing to an existing conversation',
    async (_, viewer, other) => {
      const sendIfAllowed = vi.fn()
      const markRead = vi.fn()
      const areLinked = vi.fn().mockResolvedValue(false)
      const messaging = repository({
        findConversation: vi.fn().mockResolvedValue(conversationBetween(viewer, other)),
        sendIfAllowed,
        markRead,
        areLinked,
      })

      await expect(
        service(messaging).send({
          conversationId: 'conversation',
          viewerId: viewer.id,
          body: 'Should not be sent',
        }),
      ).rejects.toMatchObject({ code: 'forbidden', status: 403 })

      expect(areLinked).toHaveBeenCalledWith(teacher.id, student.id)
      expect(sendIfAllowed).not.toHaveBeenCalled()
      expect(markRead).not.toHaveBeenCalled()
    },
  )

  it('rechecks an inactive link before reopening an existing conversation', async () => {
    const createConversation = vi.fn()
    const findPerson = vi.fn()
    const messaging = repository({
      findByPairKey: vi.fn().mockResolvedValue(conversationBetween(teacher, student)),
      createConversation,
      findPerson,
      areLinked: vi.fn().mockResolvedValue(false),
    })

    await expect(
      service(messaging).startWith({
        viewer: { id: teacher.id, role: teacher.role },
        recipientId: student.id,
      }),
    ).rejects.toMatchObject({ code: 'forbidden', status: 403 })

    expect(findPerson).not.toHaveBeenCalled()
    expect(createConversation).not.toHaveBeenCalled()
  })

  it("keeps an ended relationship's conversation history readable", async () => {
    const areLinked = vi.fn()
    const message: MessageRow = {
      id: 'message',
      body: 'Saved history',
      created_at: NOW,
      sender_id: teacher.id,
    }
    const messaging = repository({
      findConversation: vi.fn().mockResolvedValue(conversationBetween(teacher, student)),
      listMessages: vi.fn().mockResolvedValue([message]),
      areLinked,
    })

    await expect(service(messaging).getThread('conversation', teacher.id)).resolves.toMatchObject({
      id: 'conversation',
      messages: [{ id: message.id, body: message.body, mine: true }],
    })
    expect(areLinked).not.toHaveBeenCalled()
  })

  it('sends while the teacher-student link is active', async () => {
    const sent: MessageRow = {
      id: 'sent',
      body: 'Current lesson',
      created_at: NOW,
      sender_id: teacher.id,
    }
    const sendIfAllowed = vi.fn().mockResolvedValue(sent)
    const markRead = vi.fn().mockResolvedValue(undefined)
    const messaging = repository({
      findConversation: vi.fn().mockResolvedValue(conversationBetween(teacher, student)),
      areLinked: vi.fn().mockResolvedValue(true),
      sendIfAllowed,
      markRead,
    })

    await expect(
      service(messaging).send({
        conversationId: 'conversation',
        viewerId: teacher.id,
        body: sent.body,
      }),
    ).resolves.toEqual({ id: sent.id, body: sent.body, createdAt: NOW, mine: true })
    expect(sendIfAllowed).toHaveBeenCalledWith({
      conversationId: 'conversation',
      senderId: teacher.id,
      body: sent.body,
    })
    expect(markRead).not.toHaveBeenCalled()
  })

  it('keeps administrator conversations independent of teacher-student links', async () => {
    const sent: MessageRow = {
      id: 'sent',
      body: 'Account help',
      created_at: NOW,
      sender_id: admin.id,
    }
    const areLinked = vi.fn()
    const messaging = repository({
      findConversation: vi.fn().mockResolvedValue(conversationBetween(admin, teacher)),
      areLinked,
      sendIfAllowed: vi.fn().mockResolvedValue(sent),
    })

    await expect(
      service(messaging).send({
        conversationId: 'conversation',
        viewerId: admin.id,
        body: sent.body,
      }),
    ).resolves.toMatchObject({ id: sent.id, mine: true })
    expect(areLinked).not.toHaveBeenCalled()
  })
})
