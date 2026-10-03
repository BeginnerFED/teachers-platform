import { getActivity } from '@/features/inbox/api'
import { ApiError } from '@/lib/api/errors'

/**
 * What an open inbox polls to learn whether it should fetch itself again. A route rather
 * than a server action because those run one at a time per tab: a poll in flight would
 * hold up the message somebody is sending.
 */
export async function GET(request: Request) {
  const headers = { 'Cache-Control': 'private, no-store' }

  try {
    return Response.json({ data: await getActivity(request.signal) }, { headers })
  } catch (error) {
    return Response.json(
      { error: error instanceof ApiError ? error.code : 'internal' },
      { status: error instanceof ApiError ? error.status : 500, headers },
    )
  }
}
