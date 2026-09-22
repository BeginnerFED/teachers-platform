'use client'

import { createContext, useContext, useEffect, useRef } from 'react'
import type { LiveMedia } from '@tp/shared'

/**
 * How a player in one browser tells the players in the others what it is doing. Provided
 * by a live lesson; absent everywhere else, where a video is just a video.
 */
export type MediaSync = {
  /**
   * Whether this browser speaks for the room when somebody new asks where a video is.
   * One browser must, and only one should, or newcomers would be pulled every way.
   */
  leads: boolean
  /** Who this browser is in the room, for the tie-break below. */
  me: string
  /** This player was played, paused or moved. */
  publish: (media: Omit<LiveMedia, 'from'>) => void
  /** Hear what happened to the same block's player elsewhere. */
  subscribe: (blockId: string, listener: (media: LiveMedia) => void) => () => void
  /**
   * Hear that somebody new is in the room. A player that knows where the room's video is
   * says so again, so the newcomer does not start it from the beginning for everyone.
   */
  onJoin: (listener: () => void) => () => void
}

export const MediaSyncContext = createContext<MediaSync | null>(null)

/**
 * A room's hub: what one player says is fanned out to the players in the same block
 * everywhere else. Built once per room; the listeners come and go with the blocks, and
 * the way out to the wire is given to it once the channel exists.
 */
export function createMediaHub(me: string) {
  const listeners = new Map<string, Set<(media: LiveMedia) => void>>()
  const joinListeners = new Set<() => void>()
  // The board stores one room-wide command. Keeping exactly one here means opening the
  // commanded block later catches up, without reviving an older player from another step.
  let latest: LiveMedia | null = null
  let send: (media: Omit<LiveMedia, 'from'>) => void = () => {}

  const sync: MediaSync = {
    leads: false,
    me,
    publish: (media) => send(media),
    subscribe(blockId, listener) {
      const set = listeners.get(blockId) ?? new Set()
      set.add(listener)
      listeners.set(blockId, set)
      if (latest?.blockId === blockId) listener(latest)

      return () => {
        set.delete(listener)
        if (set.size === 0) listeners.delete(blockId)
      }
    },
    onJoin(listener) {
      joinListeners.add(listener)
      return () => {
        joinListeners.delete(listener)
      }
    },
  }

  /** What came in over the wire, handed to whoever is listening for that block. */
  const dispatch = (media: LiveMedia) => {
    latest = media
    listeners.get(media.blockId)?.forEach((listener) => listener(media))
  }

  /** Somebody new is in the room. */
  const joined = () => {
    joinListeners.forEach((listener) => listener())
  }

  /** The way out to the wire. */
  const connect = (sender: typeof send) => {
    send = sender
  }

  /** The room, as the blocks see it, with whether this browser leads it. */
  const withLeads = (leads: boolean): MediaSync => ({ ...sync, leads })

  return { sync, dispatch, joined, connect, withLeads }
}

/**
 * Subscribes a block's player to the room, if there is one. The listener is read through
 * a ref so the subscription made once keeps calling the latest closure.
 */
export function useMediaSync(
  blockId: string,
  onRemote: (media: LiveMedia) => void,
  onJoin: () => void,
) {
  const sync = useContext(MediaSyncContext)
  const listener = useRef(onRemote)
  const joinListener = useRef(onJoin)
  useEffect(() => {
    listener.current = onRemote
    joinListener.current = onJoin
  }, [onRemote, onJoin])

  useEffect(() => {
    if (!sync) return

    const unsubscribe = sync.subscribe(blockId, (media) => listener.current(media))
    const unsubscribeJoin = sync.onJoin(() => joinListener.current())

    return () => {
      unsubscribe()
      unsubscribeJoin()
    }
  }, [sync, blockId])

  return sync
}

/**
 * Two people who touched the same player at once: each one's message was already on its
 * way when the other's left, so neither is the later. Within this long after speaking, a
 * message from somebody else is treated as having crossed with ours rather than as an
 * answer to it — see `speaksOver` below.
 */
export const CROSSED_MS = 700

/**
 * Which of two people who spoke at once the room listens to. Nothing about the moment can
 * decide it — the clocks are different browsers' clocks, and each side sees the other's
 * message arrive last — so it is settled by the one thing both sides agree on: the ids.
 * Both browsers reach the same answer, so both end up playing or both end up paused,
 * instead of one of each.
 */
export function speaksOver(theirs: string, mine: string) {
  return theirs > mine
}

/**
 * Where a remote player must be now, given where it said it was and when. A message takes
 * time to arrive; a player that is playing has moved on since.
 */
export function expectedTime(
  media: Pick<LiveMedia, 'playing' | 'time' | 'rate' | 'at'>,
  now = Date.now(),
): number {
  if (!media.playing) return media.time

  return media.time + ((now - media.at) / 1000) * (media.rate || 1)
}
