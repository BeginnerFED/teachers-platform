import type { Correspondent, InboxActivity, ThreadMessage } from '@tp/shared'
import type { ActivityRow, ConversationRow, MessageRow, PersonRow } from './messaging.repository'

export function toCorrespondent(person: PersonRow): Correspondent {
  return {
    id: person.id,
    fullName: person.full_name,
    email: person.email,
    role: person.role,
  }
}

/**
 * The person on the other end. A conversation holds both sides so that either of them can
 * read it with the same query; which one is "the other" depends on who is asking.
 */
export function otherParticipant(row: ConversationRow, viewerId: string): PersonRow | null {
  return (
    row.conversation_participants.find(
      (participant) => participant.profile_id !== viewerId && participant.profile !== null,
    )?.profile ?? null
  )
}

/** Kept up to date by the trigger that writes messages, so reading it costs nothing. */
export function unreadFor(row: ConversationRow, viewerId: string): number {
  return (
    row.conversation_participants.find((participant) => participant.profile_id === viewerId)
      ?.unread_count ?? 0
  )
}

/**
 * Folded down to the two things a poll compares. Times are compared as instants rather
 * than as text, so the answer does not hang on how a time happens to be written out.
 */
export function toInboxActivity(rows: ActivityRow[]): InboxActivity {
  let lastMessageAt: string | null = null

  for (const row of rows) {
    const at = row.conversation?.last_message_at ?? null

    if (at && (!lastMessageAt || Date.parse(at) > Date.parse(lastMessageAt))) lastMessageAt = at
  }

  return {
    unread: rows.reduce((total, row) => total + row.unread_count, 0),
    lastMessageAt,
  }
}

export function toThreadMessage(row: MessageRow, viewerId: string): ThreadMessage {
  return {
    id: row.id,
    body: row.body,
    createdAt: row.created_at,
    // Resolved here rather than sent as a sender id the browser has to compare: the client
    // should not need to know its own id to lay out a conversation.
    mine: row.sender_id === viewerId,
  }
}
