import { Hono } from 'hono'
import type { AppEnv } from '../../http/context'
import {
  getThread,
  getUnreadTotal,
  listConversations,
  listRecipients,
  markRead,
  sendMessage,
  startConversation,
} from './messaging.controller'

/**
 * Mounted at /v1/conversations. The fixed segments are declared before the parameterised
 * ones so that /recipients and /unread are not read as conversation ids.
 */
export const conversationsRoutes = new Hono<AppEnv>()
  .get('/', ...listConversations)
  .get('/unread', ...getUnreadTotal)
  .get('/recipients', ...listRecipients)
  .post('/', ...startConversation)
  .get('/:conversationId', ...getThread)
  .post('/:conversationId/messages', ...sendMessage)
  .post('/:conversationId/read', ...markRead)
