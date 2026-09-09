import { notFound } from 'next/navigation'
import { DEFAULT_LOCALE } from '@tp/shared'
import { getLiveRoom, getPublicLiveRoom } from '@/features/live/api'
import { GuestGate } from '@/features/live/components/guest-gate'
import { LiveRoom } from '@/features/live/components/live-room'
import { ApiError } from '@/lib/api/errors'
import { getViewer } from '@/lib/auth'
import { getMessages } from '@/messages/server'

const missing = (error: unknown) => {
  if (error instanceof ApiError && error.status === 404) notFound()

  throw error
}

/**
 * The room, for whoever is allowed in. Signed in, the API knows who you are and whether
 * you drive; in by the link alone, it hands over the open room and the browser asks your
 * name. Everything from here on happens in the browser.
 */
export default async function LivePage({ params }: PageProps<'/live/[sessionId]'>) {
  const [viewer, t, { sessionId }] = await Promise.all([getViewer(), getMessages(), params])

  if (!viewer) {
    const room = await getPublicLiveRoom(sessionId).catch(missing)

    // No profile to read a language from; the product's own.
    return <GuestGate room={room} locale={DEFAULT_LOCALE} t={t} />
  }

  const room = await getLiveRoom(sessionId).catch(missing)

  return <LiveRoom room={room} locale={viewer.locale} t={t} />
}
