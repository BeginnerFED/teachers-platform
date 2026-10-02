'use client'

import { PauseIcon, PlayIcon, Volume2Icon, VolumeXIcon } from 'lucide-react'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Button } from '@/components/ui/button'

/**
 * The promo film, as the files the renderer writes into `public/promo`. Versioned in the
 * name so a new cut is never served from an old cache.
 */
export const PROMO_FILM = {
  webm: '/promo/teachers-platform-v1.webm',
  mp4: '/promo/teachers-platform-v1.mp4',
  poster: '/promo/teachers-platform-v1.jpg',
} as const

export type PromoVideoCopy = { play: string; pause: string; soundOn: string; soundOff: string }

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION)
  query.addEventListener('change', onChange)

  return () => query.removeEventListener('change', onChange)
}

const readReducedMotion = () => window.matchMedia(REDUCED_MOTION).matches
const serverFalse = () => false

/** Over the film: dark glass, so the controls read on any frame. */
const CONTROL =
  'bg-black/45 text-white ring-1 ring-white/15 hover:bg-black/65 hover:text-white dark:hover:bg-black/65'

/**
 * The promo film beside the sign-in form.
 *
 * It plays muted and loops — a browser only lets sound start from a click, and a sign-in
 * page has no business making noise on its own. The two controls are always on screen:
 * pause, for anyone the motion bothers, and sound, for anyone who wants the whole thing.
 * Reduced motion starts it paused on its poster. A hidden tab pauses it.
 */
export function PromoVideo({ copy }: { copy: PromoVideoCopy }) {
  const reduced = useSyncExternalStore(subscribeReducedMotion, readReducedMotion, serverFalse)
  const video = useRef<HTMLVideoElement>(null)
  const [paused, setPaused] = useState(reduced)
  const [muted, setMuted] = useState(true)
  const chosePause = useRef(reduced)

  useEffect(() => {
    const element = video.current
    if (!element) return

    if (paused) element.pause()
    else element.play().catch(() => setPaused(true))
  }, [paused])

  useEffect(() => {
    if (video.current) video.current.muted = muted
  }, [muted])

  useEffect(() => {
    const onVisibility = () => {
      const element = video.current
      if (!element) return
      if (document.hidden) element.pause()
      else if (!chosePause.current) element.play().catch(() => undefined)
    }

    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  const togglePause = () => {
    chosePause.current = !paused
    setPaused(!paused)
  }

  return (
    <div data-promo-ready className="absolute inset-0">
      <video
        ref={video}
        className="absolute inset-0 size-full object-cover"
        poster={PROMO_FILM.poster}
        autoPlay={!reduced}
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden
        tabIndex={-1}
      >
        <source src={PROMO_FILM.webm} type="video/webm" />
        <source src={PROMO_FILM.mp4} type="video/mp4" />
      </video>

      <div className="absolute bottom-6 left-6 flex gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={paused ? copy.play : copy.pause}
          onClick={togglePause}
          className={CONTROL}
        >
          {paused ? <PlayIcon /> : <PauseIcon />}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={muted ? copy.soundOn : copy.soundOff}
          aria-pressed={!muted}
          onClick={() => setMuted(!muted)}
          className={CONTROL}
        >
          {muted ? <VolumeXIcon /> : <Volume2Icon />}
        </Button>
      </div>
    </div>
  )
}
