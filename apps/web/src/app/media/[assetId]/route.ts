import { ApiError, unwrap } from '@/lib/api/errors'
import { getApi, getPublicApi, peerHeaders } from '@/lib/api/server'

/**
 * The longest a live room's file waits for its budget to come back. A browser never asks
 * again for a picture that failed, so one short wait is the difference between a picture a
 * moment late and one never shown; more than one would only keep a flood's requests open.
 */
const LIVE_RETRY_LIMIT_MS = 2_000

/**
 * As long as the API asked for, spread a little: a class turned away together should not
 * all come back in the same instant and be turned away together again.
 */
function retryWait(response: Response): number {
  const seconds = Number(response.headers.get('retry-after'))

  return (seconds > 0 ? seconds : 1) * 1000 + Math.random() * 300
}

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
      const ask = () =>
        getPublicApi().v1.assets[':assetId'].live[':sessionId'].$get(
          { param: { assetId, sessionId } },
          {
            init: {
              cache: 'no-store',
              headers: { ...peerHeaders(request.headers), ...(range ? { range } : {}) },
              // The browser's own: the file stops coming the moment nobody is waiting for
              // it. A signal is also what keeps Next from deduplicating this fetch, which
              // would answer a second ask with a copy of the first and park a duplicate of
              // every file streamed through here in memory until the request is done.
              signal: request.signal,
            },
          },
        )

      // A whole class turning to a step at once can spend the room's budget for a moment.
      let upstream = await ask()
      const wait = upstream.status === 429 ? retryWait(upstream) : 0
      if (wait && wait <= LIVE_RETRY_LIMIT_MS && !request.signal.aborted) {
        await upstream.body?.cancel()
        await new Promise((resolve) => setTimeout(resolve, wait))
        upstream = await ask()
      }

      if (!upstream.ok && upstream.status !== 416) {
        const retryAfter = upstream.headers.get('retry-after')

        return new Response(null, {
          status: upstream.status === 404 || upstream.status === 400 ? 404 : upstream.status,
          headers: {
            'cache-control': 'no-store',
            ...(retryAfter ? { 'retry-after': retryAfter } : {}),
          },
        })
      }

      // How long the browser may keep the file is the API's call; this passes it on.
      const headers = new Headers()
      for (const name of [
        'cache-control',
        'content-type',
        'content-length',
        'content-range',
        'accept-ranges',
      ]) {
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

    // The browser left before its file came, as a page turned mid-load does; there is
    // nobody to answer and nothing went wrong.
    if (request.signal.aborted) return new Response(null, { status: 499 })

    throw error
  }
}
