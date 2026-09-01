import { conversationIdParam, sendMessageBody, startConversationBody } from '@tp/shared'
import { getAuth } from '../../http/context'
import { factory } from '../../http/factory'
import { validate } from '../../http/validate'
import { requireAuth } from '../../middleware/auth'
import { messagingService } from './messaging.service'

// Not admin-only: this is the one part of the platform every role uses. Who may write to
// whom is a question about the pair, not about a rank, so the service answers it.
export const listConversations = factory.createHandlers(requireAuth, async (c) => {
  const data = await messagingService.listConversations(getAuth(c).userId)

  return c.json({ data })
})

export const getUnreadTotal = factory.createHandlers(requireAuth, async (c) => {
  const unread = await messagingService.unreadTotal(getAuth(c).userId)

  return c.json({ data: { unread } })
})

export const listRecipients = factory.createHandlers(requireAuth, async (c) => {
  const data = await messagingService.recipientsFor(getAuth(c).userId)

  return c.json({ data })
})

export const startConversation = factory.createHandlers(
  requireAuth,
  validate('json', startConversationBody),
  async (c) => {
    const data = await messagingService.startWith({
      viewerId: getAuth(c).userId,
      recipientId: c.req.valid('json').recipientId,
    })

    return c.json({ data })
  },
)

export const getThread = factory.createHandlers(
  requireAuth,
  validate('param', conversationIdParam),
  async (c) => {
    const data = await messagingService.getThread(
      c.req.valid('param').conversationId,
      getAuth(c).userId,
    )

    return c.json({ data })
  },
)

export const sendMessage = factory.createHandlers(
  requireAuth,
  validate('param', conversationIdParam),
  validate('json', sendMessageBody),
  async (c) => {
    const data = await messagingService.send({
      conversationId: c.req.valid('param').conversationId,
      viewerId: getAuth(c).userId,
      body: c.req.valid('json').body,
    })

    return c.json({ data }, 201)
  },
)

export const markRead = factory.createHandlers(
  requireAuth,
  validate('param', conversationIdParam),
  async (c) => {
    await messagingService.markRead(c.req.valid('param').conversationId, getAuth(c).userId)

    return c.json({ data: { id: c.req.valid('param').conversationId } })
  },
)
