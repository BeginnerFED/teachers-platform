import { z } from 'zod'
import type { Role } from '../constants'

export const conversationIdParam = z.object({
  conversationId: z.uuid(),
})

export const sendMessageBody = z.object({
  // The same ceiling the database enforces, so a long paste is refused before it travels.
  body: z.string().trim().min(1).max(4000),
})

export type SendMessageBody = z.infer<typeof sendMessageBody>

export const startConversationBody = z.object({
  recipientId: z.uuid(),
})

export type StartConversationBody = z.infer<typeof startConversationBody>

export type Correspondent = {
  id: string
  fullName: string | null
  email: string
  role: Role
}

export type ConversationSummary = {
  id: string
  /** The other person. Every conversation has exactly two people in it for now. */
  other: Correspondent
  lastMessage: {
    body: string
    createdAt: string
    /** Whether the last word was yours, which is what a reply prompt hangs on. */
    mine: boolean
  } | null
  /** Messages from the other person since you last opened it. */
  unread: number
}

export type ThreadMessage = {
  id: string
  body: string
  createdAt: string
  mine: boolean
}

export type Thread = {
  id: string
  other: Correspondent
  /** Oldest first, so it reads downwards like a conversation. */
  messages: ThreadMessage[]
}
