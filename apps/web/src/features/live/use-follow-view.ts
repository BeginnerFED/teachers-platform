'use client'

import { useCallback, useEffect, useRef, type RefObject } from 'react'
import type { LiveView } from '@tp/shared'

/** The keys that scroll a page: pressing one while following is choosing not to. */
const SCROLL_KEYS = new Set([
  'ArrowDown',
  'ArrowUp',
  'PageDown',
  'PageUp',
  'Home',
  'End',
  ' ',
  'Space',
])

/**
 * Where this person's window sits over the lesson: the top of the window, measured from
 * the top of the lesson, as a fraction of the lesson's height — so a screen of another
 * size lands on the same part of the page.
 */
function viewOf(surface: HTMLElement, stepId: string): LiveView | null {
  const rect = surface.getBoundingClientRect()
  if (rect.height === 0) return null

  return { stepId, top: -rect.top / rect.height, height: window.innerHeight / rect.height }
}

/**
 * Following, the way a viewport follows in Figma: whoever is followed sends where their
 * window is as they scroll, and the follower's window goes there. Scrolling on your own
 * while following is letting go — the same as turning a page yourself.
 *
 * Only somebody who is followed sends anything; everyone else's scrolling is their own
 * business and stays off the wire.
 */
export function useFollowView({
  surface,
  stepId,
  following,
  followers,
  send,
  onLetGo,
}: {
  surface: RefObject<HTMLElement | null>
  stepId: string
  /** Whom this person follows, if anybody. */
  following: string | null
  /** How many people follow this person. */
  followers: number
  send: (view: LiveView) => void
  /** This person scrolled on their own while following. */
  onLetGo: () => void
}) {
  const latest = useRef({ surface, stepId, following, followers, send, onLetGo })
  useEffect(() => {
    latest.current = { surface, stepId, following, followers, send, onLetGo }
  }, [surface, stepId, following, followers, send, onLetGo])

  // The last view heard from the person followed, kept until this screen can honour it —
  // a view for a step this screen has not turned to yet is honoured once it has.
  const pending = useRef<LiveView | null>(null)

  const tell = useCallback(() => {
    const { surface: box, stepId: step, followers: count, send: say } = latest.current
    const root = box.current
    if (!root || count === 0) return
    const view = viewOf(root, step)
    if (view) say(view)
  }, [])

  /** Puts this window where the followed person's is. */
  const apply = useCallback((view: LiveView) => {
    const root = latest.current.surface.current
    if (!root) return
    if (view.stepId !== latest.current.stepId) {
      pending.current = view
      return
    }
    pending.current = null

    const rect = root.getBoundingClientRect()
    const target = window.scrollY + rect.top + view.top * rect.height
    window.scrollTo({ top: Math.max(0, target) })
  }, [])

  // A view heard for the next step lands once the step is here.
  useEffect(() => {
    const waiting = pending.current
    if (waiting && waiting.stepId === stepId) apply(waiting)
  }, [stepId, apply])

  // Somebody started following: say where this window is now, without waiting for a scroll.
  useEffect(() => {
    if (followers > 0) tell()
  }, [followers, stepId, tell])

  useEffect(() => {
    const onScroll = () => {
      if (latest.current.followers > 0) tell()
    }
    // A wheel, a finger, a key: the person's own hand on the page, never this hook's.
    const letGo = () => {
      if (latest.current.following) latest.current.onLetGo()
    }
    const onKey = (event: KeyboardEvent) => {
      if (!SCROLL_KEYS.has(event.key)) return
      const target = event.target as HTMLElement | null
      // Typing in a box is not scrolling the page.
      if (target && target.closest('input, textarea, [contenteditable="true"]')) return
      letGo()
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    window.addEventListener('wheel', letGo, { passive: true })
    window.addEventListener('touchmove', letGo, { passive: true })
    window.addEventListener('keydown', onKey)

    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      window.removeEventListener('wheel', letGo)
      window.removeEventListener('touchmove', letGo)
      window.removeEventListener('keydown', onKey)
    }
  }, [tell])

  return { apply }
}
