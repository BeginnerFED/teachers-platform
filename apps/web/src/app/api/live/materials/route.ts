import { listMaterialsQuery } from '@tp/shared'
import { ApiError, unwrapPage } from '@/lib/api/errors'
import { getApi } from '@/lib/api/server'

export async function GET(request: Request) {
  const headers = { 'Cache-Control': 'private, no-store' }
  const url = new URL(request.url)
  const parsed = listMaterialsQuery.safeParse({
    query: url.searchParams.get('query')?.trim() || undefined,
    level: url.searchParams.get('level') || undefined,
    page: url.searchParams.get('page') || 1,
    perPage: 8,
  })
  if (!parsed.success)
    return Response.json({ error: 'validation_failed' }, { status: 400, headers })
  try {
    const api = await getApi()
    const query = parsed.data
    const data = await unwrapPage(
      await api.v1.materials.$get(
        {
          query: {
            scope: 'all',
            deleted: 'false',
            page: String(query.page),
            perPage: '8',
            ...(query.query ? { query: query.query } : {}),
            ...(query.level ? { level: query.level } : {}),
          },
        },
        { init: { signal: request.signal, cache: 'no-store' } },
      ),
    )
    return Response.json(data, { headers })
  } catch (error) {
    return Response.json(
      { error: error instanceof ApiError ? error.code : 'internal' },
      { status: error instanceof ApiError ? error.status : 500, headers },
    )
  }
}
