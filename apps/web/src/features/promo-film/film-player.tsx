'use client'

import { PauseIcon, PlayIcon, Volume2Icon, VolumeXIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { Button } from '@/components/ui/button'
import { encodeWav, toBase64 } from './audio/wav'
import { renderSoundtrack } from './audio/soundtrack'
import type { FilmCopy } from './copy'
import { FILM_DURATION } from './film'
import { Film, filmCues } from './frame'
import { FPS, HEIGHT, INK, WIDTH } from './time'

type FilmApi = {
  duration: number
  fps: number
  width: number
  height: number
  /** Draws the frame at `ms` and settles every CSS and Web Animation on it. */
  seek: (ms: number) => Promise<void>
  /** The soundtrack as base64 WAV. */
  renderAudio: () => Promise<string>
}

declare global {
  interface Window {
    __film?: FilmApi
  }
}

const nextFrame = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  )

/**
 * Development only: plays the promo film in the browser and exposes `window.__film` for
 * the renderer, which steps it frame by frame into a video.
 *
 * Determinism: the film itself is a pure function of time, but the product screens it
 * films use CSS and Web Animations. Each one is pinned to the moment it first appeared
 * and set to `now − birth`, so every frame shows exactly what it would at that time.
 */
export function FilmPlayer({ copy, render }: { copy: FilmCopy; render: boolean }) {
  const [t, setT] = useState(0)
  const [epoch, setEpoch] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [sound, setSound] = useState(false)
  const [scale, setScale] = useState(1)

  const births = useRef(new Map<Animation, number>())
  const last = useRef(0)
  const audio = useRef<{
    context: AudioContext
    buffer: AudioBuffer | null
    source: AudioBufferSourceNode | null
  } | null>(null)

  // The renderer's handle.
  useEffect(() => {
    const seek = async (ms: number) => {
      if (ms < last.current) {
        births.current.clear()
        flushSync(() => setEpoch((value) => value + 1))
      }
      last.current = ms
      flushSync(() => setT(ms))
      for (const animation of document.getAnimations()) {
        if (!births.current.has(animation)) births.current.set(animation, ms)
        animation.pause()
        animation.currentTime = Math.max(0, ms - births.current.get(animation)!)
      }
      await nextFrame()
    }

    window.__film = {
      duration: FILM_DURATION,
      fps: FPS,
      width: WIDTH,
      height: HEIGHT,
      seek,
      renderAudio: async () =>
        toBase64(encodeWav(await renderSoundtrack(filmCues(), FILM_DURATION))),
    }
    document.body.style.background = INK

    return () => {
      delete window.__film
    }
  }, [])

  // Preview: fit the frame to the window.
  useEffect(() => {
    if (render) return
    const fit = () =>
      setScale(Math.min((window.innerHeight - 96) / HEIGHT, (window.innerWidth - 48) / WIDTH))
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [render])

  // Preview playback, frame-accurate through the same seek the renderer uses.
  useEffect(() => {
    if (!playing || !window.__film) return
    let frame = 0
    let stopped = false
    const origin = performance.now() - last.current

    const tick = async () => {
      if (stopped || !window.__film) return
      const player = audio.current
      const now =
        player?.source && player.context.state === 'running'
          ? (player.context.currentTime -
              (player.source as AudioBufferSourceNode & { startedAt: number }).startedAt) *
            1000
          : performance.now() - origin
      if (now >= FILM_DURATION) {
        setPlaying(false)
        return
      }
      await window.__film.seek(now)
      frame = requestAnimationFrame(() => void tick())
    }
    frame = requestAnimationFrame(() => void tick())

    return () => {
      stopped = true
      cancelAnimationFrame(frame)
    }
  }, [playing])

  const startAudio = async (from: number) => {
    if (!sound) return
    audio.current ??= { context: new AudioContext(), buffer: null, source: null }
    const player = audio.current
    player.buffer ??= await renderSoundtrack(filmCues(), FILM_DURATION)
    player.source?.stop()
    const source = player.context.createBufferSource() as AudioBufferSourceNode & {
      startedAt: number
    }
    source.buffer = player.buffer
    source.connect(player.context.destination)
    source.startedAt = player.context.currentTime - from / 1000
    source.start(0, from / 1000)
    player.source = source
    await player.context.resume()
  }

  const toggle = async () => {
    if (playing) {
      audio.current?.source?.stop()
      if (audio.current) audio.current.source = null
      setPlaying(false)
      return
    }
    const from = last.current >= FILM_DURATION - 50 ? 0 : last.current
    if (from === 0 && window.__film) await window.__film.seek(0)
    await startAudio(from)
    setPlaying(true)
  }

  const film = <Film key={epoch} t={t} copy={copy} />

  if (render) return <div style={{ width: WIDTH, height: HEIGHT }}>{film}</div>

  return (
    <div
      className="flex min-h-svh flex-col items-center justify-center gap-4 p-6"
      style={{ background: INK }}
    >
      <div style={{ width: WIDTH * scale, height: HEIGHT * scale }}>
        <div
          style={{
            transform: `scale(${scale})`,
            transformOrigin: '0 0',
            width: WIDTH,
            height: HEIGHT,
          }}
        >
          {film}
        </div>
      </div>
      <div className="flex w-full max-w-xl items-center gap-3 text-white">
        <Button
          size="icon"
          variant="secondary"
          onClick={() => void toggle()}
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="text-white hover:bg-white/10 hover:text-white"
          onClick={() => setSound((value) => !value)}
          aria-label={sound ? 'Mute' : 'Sound'}
        >
          {sound ? <Volume2Icon /> : <VolumeXIcon />}
        </Button>
        <input
          type="range"
          min={0}
          max={FILM_DURATION}
          step={1000 / FPS}
          value={t}
          onChange={(event) => {
            setPlaying(false)
            audio.current?.source?.stop()
            void window.__film?.seek(Number(event.target.value))
          }}
          className="flex-1 accent-[#ff4f01]"
        />
        <span className="w-16 text-right font-mono text-xs tabular-nums text-white/70">
          {(t / 1000).toFixed(2)}s
        </span>
      </div>
    </div>
  )
}
