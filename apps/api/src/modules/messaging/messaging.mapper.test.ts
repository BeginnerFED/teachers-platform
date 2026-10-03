import { describe, expect, it } from 'vitest'
import { toInboxActivity } from './messaging.mapper'

describe('inbox activity', () => {
  it('adds up what is unread and keeps the newest line wherever it is', () => {
    expect(
      toInboxActivity([
        { unread_count: 2, conversation: { last_message_at: '2026-10-01T09:00:00.5+00:00' } },
        { unread_count: 0, conversation: { last_message_at: null } },
        { unread_count: 1, conversation: { last_message_at: '2026-10-01T09:00:00.75+00:00' } },
        { unread_count: 0, conversation: { last_message_at: '2026-10-01T08:59:59+00:00' } },
      ]),
    ).toEqual({ unread: 3, lastMessageAt: '2026-10-01T09:00:00.75+00:00' })
  })

  it('is empty for somebody who has not written or been written to yet', () => {
    expect(toInboxActivity([])).toEqual({ unread: 0, lastMessageAt: null })
    expect(toInboxActivity([{ unread_count: 0, conversation: null }])).toEqual({
      unread: 0,
      lastMessageAt: null,
    })
  })
})
