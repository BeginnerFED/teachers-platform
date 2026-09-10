import { searchQuery } from '@tp/shared'
import { ApiError, unwrap } from '@/lib/api/errors'
import { getApi } from '@/lib/api/server'

export async function GET(request: Request) {
  const headers = { 'Cache-Control': 'private, no-store' }
  const parsed = searchQuery.safeParse({ query: new URL(request.url).searchParams.get('query') })
  if (!parsed.success) {
    return Response.json({ error: 'validation_failed' }, { status: 400, headers })
  }

  try {
    const api = await getApi()
    const data = await unwrap(
      await api.v1.search.$get(
        { query: parsed.data },
        { init: { signal: request.signal, cache: 'no-store' } },
      ),
    )
    return Response.json({ data }, { headers })
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500
    return Response.json(
      { error: error instanceof ApiError ? error.code : 'internal' },
      { status, headers },
    )
  }
}
