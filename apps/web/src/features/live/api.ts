import 'server-only'
import type { LivePublicRoom, LiveRoom, LiveSession } from '@tp/shared'
import { unwrap } from '@/lib/api/errors'
import { getApi, getPublicApi } from '@/lib/api/server'

/** The only place the web app asks the API about live lessons. */
export async function getLiveRoom(sessionId: string): Promise<LiveRoom> {
  const api = await getApi()

  return unwrap(await api.v1.live[':sessionId'].$get({ param: { sessionId } }))
}

/** The room for somebody who holds only its link. Not there once the room has closed. */
export async function getPublicLiveRoom(sessionId: string): Promise<LivePublicRoom> {
  const api = getPublicApi()

  return unwrap(await api.v1.live.public[':sessionId'].$get({ param: { sessionId } }))
}

/** The host's open room, if they have one. */
export async function myLiveSession(): Promise<LiveSession | null> {
  const api = await getApi()

  return unwrap(await api.v1.live.mine.$get())
}

/** The rooms a student could walk into right now. */
export async function joinableLiveSessions(): Promise<LiveSession[]> {
  const api = await getApi()

  return unwrap(await api.v1.live.joinable.$get())
}
