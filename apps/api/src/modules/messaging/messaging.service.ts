import type {
  ConversationSummary,
  Correspondent,
  Role,
  Thread,
  ThreadMessage,
} from '@tp/shared'
import { ForbiddenError, NotFoundError } from '../../http/errors'
import { systemClock, type Clock } from '../../lib/clock'
import { otherParticipant, toCorrespondent, toThreadMessage, unreadFor } from './messaging.mapper'
import { messagingRepository, type MessagingRepository, type PersonRow } from './messaging.repository'

/**
 * A long conversation past this point is history rather than a thread anybody is reading.
 * Paging back through it is a thing to build when somebody asks for it.
 */
const THREAD_LIMIT = 200

/** Sorted, so the same two people produce the same key whichever of them starts. */
function pairKeyFor(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`
}

export type MessagingServiceDeps = {
  messaging: MessagingRepository
  clock: Clock
}

export function createMessagingService({ messaging, clock }: MessagingServiceDeps) {
  /**
   * Who may write to whom. An administrator runs the platform and can reach anyone; a
   * teacher and a student may write to each other only while one of them is teaching the
   * other. Nothing else — two teachers have no business here, and two students less.
   */
  async function mayMessage(
    viewer: { id: string; role: Role },
    other: PersonRow,
  ): Promise<boolean> {
    if (viewer.id === other.id) return false
    if (viewer.role === 'admin' || other.role === 'admin') return true

    if (viewer.role === 'teacher' && other.role === 'student') {
      return messaging.areLinked(viewer.id, other.id)
    }

    if (viewer.role === 'student' && other.role === 'teacher') {
      return messaging.areLinked(other.id, viewer.id)
    }

    return false
  }

  async function requirePerson(profileId: string): Promise<PersonRow> {
    const person = await messaging.findPerson(profileId)
    if (!person) throw new NotFoundError('No such person')

    return person
  }

  /** Membership is the whole of the permission to read a thread. */
  async function requireMembership(conversationId: string, viewerId: string) {
    const conversation = await messaging.findConversation(conversationId)
    if (!conversation) throw new NotFoundError('No such conversation')

    const isMember = conversation.conversation_participants.some(
      (participant) => participant.profile_id === viewerId,
    )
    // Not found rather than forbidden: whether a conversation exists is itself something
    // an outsider should not be able to learn by guessing at ids.
    if (!isMember) throw new NotFoundError('No such conversation')

    return conversation
  }

  return {
    /**
     * Two reads for the whole inbox, however many conversations are in it. The last line
     * and the unread count are both kept on the row by the trigger that writes messages;
     * working them out here meant a pair of queries per conversation, and a dozen round
     * trips to Frankfurt before an inbox of five appeared.
     */
    async listConversations(viewerId: string): Promise<ConversationSummary[]> {
      const rows = await messaging.listConversations(viewerId)

      return rows.flatMap((row) => {
        const other = otherParticipant(row, viewerId)
        if (!other || !row.last_message_at || row.last_message_body === null) return []

        return [
          {
            id: row.id,
            other: toCorrespondent(other),
            lastMessage: {
              body: row.last_message_body,
              createdAt: row.last_message_at,
              mine: row.last_message_sender_id === viewerId,
            },
            unread: unreadFor(row, viewerId),
          } satisfies ConversationSummary,
        ]
      })
    },

    /**
     * The one number the sidebar needs, without the conversations behind it. Asked for on
     * every page of the product, so it is a single read of a counter rather than a walk
     * through an inbox.
     */
    unreadTotal(viewerId: string): Promise<number> {
      return messaging.sumUnread(viewerId)
    },

    async getThread(conversationId: string, viewerId: string): Promise<Thread> {
      const conversation = await requireMembership(conversationId, viewerId)

      const other = otherParticipant(conversation, viewerId)
      if (!other) throw new NotFoundError('That conversation has nobody else in it')

      const rows = await messaging.listMessages(conversationId, THREAD_LIMIT)

      return {
        id: conversation.id,
        other: toCorrespondent(other),
        // Read newest first so the limit keeps the recent end, then turned round so it
        // reads downwards the way a conversation does.
        messages: rows.reverse().map((row): ThreadMessage => toThreadMessage(row, viewerId)),
      }
    },

    async send({
      conversationId,
      viewerId,
      body,
    }: {
      conversationId: string
      viewerId: string
      body: string
    }): Promise<ThreadMessage> {
      await requireMembership(conversationId, viewerId)

      const row = await messaging.insertMessage({ conversationId, senderId: viewerId, body })

      // Sending is reading: nothing you just wrote should come back as unread to you.
      await messaging.markRead(conversationId, viewerId, row.created_at)

      return toThreadMessage(row, viewerId)
    },

    /**
     * Idempotent. Opening a conversation with somebody you already have one with returns
     * the one that exists rather than a second empty thread beside it.
     *
     * The lookup comes first, and answers on its own when it finds something. That is not
     * a shortcut past the permission check: the key is built from the caller's own id, so
     * a conversation carrying it is one the caller is in by construction. Checking anyway
     * cost three more round trips on the commonest path there is — reopening a chat.
     */
    async startWith({
      viewer,
      recipientId,
    }: {
      /** Taken from the verified token, so reading the caller's profile again is waste. */
      viewer: { id: string; role: Role }
      recipientId: string
    }): Promise<{ id: string }> {
      const pairKey = pairKeyFor(viewer.id, recipientId)

      const existing = await messaging.findByPairKey(pairKey)
      if (existing) return { id: existing.id }

      const recipient = await requirePerson(recipientId)

      if (!(await mayMessage({ id: viewer.id, role: viewer.role }, recipient))) {
        throw new ForbiddenError('You cannot message that person')
      }

      return { id: await messaging.createConversation(pairKey, [viewer.id, recipientId]) }
    },

    async markRead(conversationId: string, viewerId: string): Promise<void> {
      await requireMembership(conversationId, viewerId)
      await messaging.markRead(conversationId, viewerId, clock.now().toISOString())
    },

    /** Everyone this person is allowed to start a conversation with. */
    async recipientsFor(viewerId: string): Promise<Correspondent[]> {
      const viewer = await requirePerson(viewerId)

      if (viewer.role === 'admin') {
        // An admin may reach anyone, but a list of every account on the platform is not a
        // picker. Teachers are who an admin actually writes to; a student with a problem
        // takes it to their teacher.
        return (await messaging.listByRole('teacher')).map(toCorrespondent)
      }

      const [linked, admins] = await Promise.all([
        messaging.listLinkedTo(viewerId, viewer.role),
        messaging.listByRole('admin'),
      ])

      // A student taught by two teachers has two rows for whoever they share; the same
      // person must not appear twice in a picker.
      const seen = new Set<string>()

      return [...linked, ...admins]
        .filter((person) => !seen.has(person.id) && seen.add(person.id))
        .map(toCorrespondent)
    },
  }
}

export type MessagingService = ReturnType<typeof createMessagingService>

export const messagingService = createMessagingService({
  messaging: messagingRepository,
  clock: systemClock,
})
