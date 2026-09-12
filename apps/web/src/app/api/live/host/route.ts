import { ApiError, unwrap } from '@/lib/api/errors'
import { getApi } from '@/lib/api/server'

export async function GET(request: Request) {
  const headers = { 'Cache-Control': 'private, no-store' }
  try {
    const api = await getApi()
    const data = await unwrap(
      await api.v1.live.mine.$get({}, { init: { signal: request.signal, cache: 'no-store' } }),
    )
    return Response.json({ data }, { headers })
  } catch (error) {
    return Response.json(
      { error: error instanceof ApiError ? error.code : 'internal' },
      { status: error instanceof ApiError ? error.status : 500, headers },
    )
  }
}
