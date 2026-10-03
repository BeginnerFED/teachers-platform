import { ApiError, unwrap } from '@/lib/api/errors'
import { getApi } from '@/lib/api/server'

/**
 * What the shell polls to keep the bell current. The inbox's unread count comes along with
 * it, so the sidebar's mark is kept current by the same request instead of a second poll
 * beside it.
 */
export async function GET(request: Request) {
  const headers = { 'Cache-Control': 'private, no-store' }
  const init = { init: { signal: request.signal, cache: 'no-store' } } as const
  try {
    const api = await getApi()
    const [data, unread] = await Promise.all([
      api.v1.me.notifications.$get({}, init).then(unwrap),
      // Null rather than 0 when it cannot be read, unlike the shell's own read: a poll that
      // cannot reach the inbox should leave the mark as it was, not clear it. Nor is a
      // count that failed a reason to fail the notifications it came with.
      api.v1.conversations.unread
        .$get({}, init)
        .then(unwrap)
        .then(({ unread }) => unread)
        .catch((error: unknown) => {
          if (error instanceof ApiError) return null

          throw error
        }),
    ])
    return Response.json({ data, unread }, { headers })
  } catch (error) {
    return Response.json(
      { error: error instanceof ApiError ? error.code : 'internal' },
      { status: error instanceof ApiError ? error.status : 500, headers },
    )
  }
}
