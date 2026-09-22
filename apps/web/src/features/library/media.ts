'use client'

import { createContext, useContext } from 'react'

/** A live room grants its player a scoped media URL, even to a viewer without an account. */
export const LiveMediaSessionContext = createContext<string | null>(null)

/**
 * Where a lesson's files are fetched from. One function, because the editor and the player
 * both point at them and a second spelling of this path would be a second thing to keep
 * right.
 *
 * Never a storage URL: that route checks who is asking before it sends anyone anywhere.
 */
export function mediaSrc(assetId: string): string {
  return `/media/${assetId}`
}

export function useMediaSrc(assetId: string): string {
  const sessionId = useContext(LiveMediaSessionContext)
  return sessionId
    ? `${mediaSrc(assetId)}?live=${encodeURIComponent(sessionId)}`
    : mediaSrc(assetId)
}
