import { ApiError, unwrap } from '@/lib/api/errors'
import { getApi, getPublicApi } from '@/lib/api/server'

/**
 * Where a lesson's pictures and recordings actually come from. A page renders
 * `/media/<id>`; ordinary readers are checked and redirected to a signed URL. In a
 * live room, the room id in `?live=` grants access only while it is open, and the API
 * streams that lesson's referenced media without exposing a signed storage URL.
 *
 * Ordinary reads redirect so large files bypass this server; the signature is minted
 * when followed, after authorization. Live reads stay proxied so the browser never keeps
 * a storage link that would survive the room's end.
 */
export async function GET(request: Request, ctx: RouteContext<'/media/[assetId]'>) {
  const { assetId } = await ctx.params
  const sessionId = new URL(request.url).searchParams.get('live')
  const range = request.headers.get('range')

  try {
    if (sessionId) {
      const upstream = await getPublicApi().v1.assets[':assetId'].live[':sessionId'].$get(
        { param: { assetId, sessionId } },
        {
          init: {
            cache: 'no-store',
            headers: range ? { range } : undefined,
          },
        },
      )
      if (!upstream.ok && upstream.status !== 416) {
        return new Response(null, {
          status: upstream.status === 404 || upstream.status === 400 ? 404 : upstream.status,
          headers: { 'cache-control': 'no-store' },
        })
      }

      const headers = new Headers({ 'cache-control': 'private, no-store' })
      for (const name of ['content-type', 'content-length', 'content-range', 'accept-ranges']) {
        const value = upstream.headers.get(name)
        if (value) headers.set(name, value)
      }
      return new Response(upstream.body, { status: upstream.status, headers })
    }

    const api = await getApi()
    const { url, expiresIn } = await unwrap(
      await api.v1.assets[':assetId'].url.$get({ param: { assetId } }),
    )

    return new Response(null, {
      status: 307,
      headers: {
        location: url,
        // Half the life of the signature, so a cached redirect can never outlive what it
        // points at. Private: this answer was for one person.
        'cache-control': `private, max-age=${Math.floor(expiresIn / 2)}`,
      },
    })
  } catch (error) {
    if (error instanceof ApiError) {
      // The API answers "not yours" and "no such thing" identically, and so does this.
      return new Response(null, { status: error.status === 404 ? 404 : error.status })
    }

    throw error
  }
}
