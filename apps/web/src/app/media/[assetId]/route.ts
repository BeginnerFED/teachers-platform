import { ApiError, unwrap } from '@/lib/api/errors'
import { getApi } from '@/lib/api/server'

/**
 * Where a lesson's pictures and recordings actually come from. A page renders
 * `/media/<id>`; this checks the viewer may read the lesson that file belongs to, then
 * sends them on to a signed URL that stops working within the hour.
 *
 * A redirect rather than the bytes themselves: a 20 MB recording has no business passing
 * through this server twice. And a redirect rather than the signed URL written straight
 * into the page, because a URL written into a page is a URL that expires while somebody is
 * still reading — this one is minted at the moment it is followed.
 */
export async function GET(_request: Request, ctx: RouteContext<'/media/[assetId]'>) {
  const { assetId } = await ctx.params

  try {
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
