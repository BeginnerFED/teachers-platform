'use client'

import { useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { InfoIcon, LightbulbIcon, PlayIcon, TriangleAlertIcon } from 'lucide-react'
import { MEDIA_DRIFT_S, type LiveMedia } from '@tp/shared'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Messages } from '@/messages'
import { mediaSrc } from '../media'
import { expectedTime, MediaSyncContext, useMediaSync } from './media-sync'
import { isBoolean, shape, useBlockState, type StudentBlockOf } from './types'
import { loadYouTube, YT_STATE, type YTPlayer, type YTPlayerEvent } from './youtube'

/** Blocks that say something rather than ask something. Nothing here takes an answer. */

export function HeadingBlock({ block }: { block: StudentBlockOf<'heading'> }) {
  const Tag = block.level === 2 ? 'h2' : 'h3'

  return (
    <Tag className={cn('font-semibold', block.level === 2 ? 'text-xl' : 'text-base')}>
      {block.text}
    </Tag>
  )
}

export function TextBlock({ block }: { block: StudentBlockOf<'text'> }) {
  // Line breaks the author typed are line breaks the student sees. Without this a
  // two-line contrast — the whole point of most grammar notes — collapses into one.
  return <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{block.text}</p>
}

/** Exported for the editor, which draws the same box around the text being typed into it. */
export const CALLOUT_STYLE = {
  info: {
    icon: InfoIcon,
    className: 'border-sky-500/30 bg-sky-500/5 text-sky-700 dark:text-sky-300',
  },
  tip: {
    icon: LightbulbIcon,
    className: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300',
  },
  warning: {
    icon: TriangleAlertIcon,
    className: 'border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300',
  },
  grammar: {
    icon: InfoIcon,
    className: 'border-primary/30 bg-primary/5 text-foreground',
  },
} as const

export function CalloutBlock({ block }: { block: StudentBlockOf<'callout'> }) {
  const { icon: Icon, className } = CALLOUT_STYLE[block.tone]

  return (
    <aside className={cn('flex gap-3 rounded-lg border p-4', className)}>
      <Icon className="mt-0.5 size-4 shrink-0" />

      <div className="space-y-1">
        {block.title ? <p className="text-sm font-semibold">{block.title}</p> : null}
        <p className="text-foreground/90 whitespace-pre-wrap text-sm leading-relaxed">
          {block.text}
        </p>
      </div>
    </aside>
  )
}

export function ImageBlock({ block }: { block: StudentBlockOf<'image'> }) {
  return (
    <figure className="space-y-2">
      {/* Not next/image: the source is a redirect this app guards, and what it points at is
          signed afresh every hour — the opposite of something to build a cache key from. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={mediaSrc(block.assetId)}
        alt={block.alt}
        loading="lazy"
        className="max-h-[32rem] w-full rounded-lg border object-contain"
      />
      {block.caption ? (
        <figcaption className="text-muted-foreground text-xs">{block.caption}</figcaption>
      ) : null}
    </figure>
  )
}

/* -------------------------------------------------------------------- sound --- */

/**
 * What the room believes a player is doing — the last thing it was told, by us or by
 * somebody else. A player that reports being exactly there has nothing to add; that is
 * how what the room told it to do is not told back to the room.
 */
type Known = Pick<LiveMedia, 'playing' | 'time' | 'rate' | 'at'>

/**
 * Whether a player is where the room believes it is — or merely behind it while playing,
 * which is a slow connection catching up and not a jump. Letting the slowest screen in the
 * room drag everyone back would be worse than the lag.
 */
function agrees(
  known: Known | null,
  playing: boolean,
  time: number,
  tolerance: number,
  lag: number,
) {
  if (known === null || known.playing !== playing) return false

  const ahead = time - expectedTime(known)
  if (Math.abs(ahead) <= tolerance) return true

  return playing && ahead < 0 && ahead > -lag
}

/** A playing audio this far behind the room is buffering, not somewhere else. */
const AUDIO_LAG_S = 3

/**
 * A browser's own `<audio>`, kept in step with the room's. What one person does to it —
 * play, pause, jump — is announced; what the room announces is done to it quietly, so the
 * doing is not announced back. Outside a live lesson this does nothing at all.
 */
function useSyncedAudio(blockId: string) {
  const sync = useContext(MediaSyncContext)
  const element = useRef<HTMLAudioElement>(null)
  const known = useRef<Known | null>(null)
  const [needsTap, setNeedsTap] = useState(false)

  const apply = useCallback((media: LiveMedia) => {
    const audio = element.current
    if (!audio) return
    // Two messages that crossed on the wire: the later one is the room's mind.
    if (known.current && media.at < known.current.at) return

    const target = expectedTime(media)
    known.current = media

    if (Math.abs(audio.currentTime - target) > MEDIA_DRIFT_S.audio) audio.currentTime = target
    if (media.rate && audio.playbackRate !== media.rate) audio.playbackRate = media.rate

    if (media.playing && audio.paused) {
      // A browser that has never been tapped may refuse to play on somebody else's say-so.
      audio.play().then(
        () => setNeedsTap(false),
        () => setNeedsTap(true),
      )
    } else if (!media.playing && !audio.paused) {
      audio.pause()
    }
  }, [])

  /** Tells the room where this audio is, whatever it believed before. */
  const publish = useCallback(
    (audio: HTMLAudioElement, playing: boolean) => {
      const media: Known = {
        playing,
        time: audio.currentTime,
        rate: audio.playbackRate || 1,
        at: Date.now(),
      }
      known.current = media
      sync?.publish({ blockId, kind: 'audio', ...media })
    },
    [sync, blockId],
  )

  // Somebody new is in: the browser that leads the room says where this audio is, so the
  // newcomer joins it here rather than starting it from the top for everyone. What it says
  // is the room's mind — its own player, if that player is there, or what it was last told.
  const announce = useCallback(() => {
    const audio = element.current
    const belief = known.current
    if (!sync?.leads || !audio || !belief) return

    if (agrees(belief, !audio.paused, audio.currentTime, MEDIA_DRIFT_S.audio, AUDIO_LAG_S)) {
      publish(audio, !audio.paused)
    } else {
      sync.publish({ blockId, kind: 'audio', ...belief })
    }
  }, [sync, blockId, publish])

  useMediaSync(blockId, apply, announce)

  const report = (playing: boolean) => {
    const audio = element.current
    if (!sync || !audio) return
    if (agrees(known.current, playing, audio.currentTime, MEDIA_DRIFT_S.audio, AUDIO_LAG_S)) return

    publish(audio, playing)
  }

  // The tap the browser wanted: join the room where it is now, not where it was refused.
  const tap = () => {
    const audio = element.current
    if (!audio) return
    setNeedsTap(false)

    const belief = known.current
    if (belief) apply({ ...belief, blockId, kind: 'audio', from: '' })
    else void audio.play().catch(() => setNeedsTap(true))
  }

  const handlers = sync
    ? {
        onPlay: () => report(true),
        onPause: () => report(false),
        onEnded: () => report(false),
        onSeeked: () => {
          const audio = element.current
          if (audio) report(!audio.paused)
        },
        onRateChange: () => {
          const audio = element.current
          if (audio && known.current && known.current.rate !== audio.playbackRate) {
            publish(audio, !audio.paused)
          }
        },
      }
    : {}

  return { element, handlers, needsTap: sync ? needsTap : false, tap }
}

/** The "tap to join in" the browser sometimes needs before it will play on cue. */
function TapToPlay({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button type="button" variant="outline" size="sm" onClick={onClick} className="gap-2">
      <PlayIcon className="size-3.5" />
      {label}
    </Button>
  )
}

export function AudioBlock({
  block,
  ui,
  onUi,
  t,
}: {
  block: StudentBlockOf<'audio'>
  ui?: unknown
  onUi?: (value: unknown) => void
  t: Messages
}) {
  // Whether the transcript is open: this browser's, or the room's when there is one.
  const [{ transcript }, setState] = useBlockState(
    ui,
    onUi,
    { transcript: false },
    shape<{ transcript: boolean }>({ transcript: isBoolean }),
  )
  const { element, handlers, needsTap, tap } = useSyncedAudio(block.id)

  return (
    <div className="space-y-2">
      {/* Controls and nothing else: a lesson is not the place to reinvent a play button,
          and the browser's own is the one a student already knows how to use. */}
      <audio
        ref={element}
        src={mediaSrc(block.assetId)}
        controls
        preload="metadata"
        className="w-full"
        {...handlers}
      />

      {needsTap ? <TapToPlay label={t.live.tapToListen} onClick={tap} /> : null}

      {block.caption ? <p className="text-muted-foreground text-xs">{block.caption}</p> : null}

      {block.transcript ? (
        <div>
          {/* Hidden by default: a visible transcript turns listening practice into
              reading practice. */}
          <button
            type="button"
            onClick={() => setState({ transcript: !transcript })}
            className="text-muted-foreground hover:text-foreground text-xs underline underline-offset-4"
          >
            {transcript ? t.library.blocks.hideTranscript : t.library.blocks.showTranscript}
          </button>

          {transcript ? (
            <p className="text-muted-foreground mt-2 whitespace-pre-wrap text-sm">
              {block.transcript}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

/* -------------------------------------------------------------------- video --- */

const noSubscription = () => () => {}

export function VideoBlock({ block, t }: { block: StudentBlockOf<'video'>; t: Messages }) {
  const sync = useContext(MediaSyncContext)

  return sync ? <SyncedVideo block={block} t={t} /> : <PlainVideo block={block} />
}

function videoParams(block: StudentBlockOf<'video'>) {
  const params = new URLSearchParams({ rel: '0', modestbranding: '1' })
  if (block.start !== undefined) params.set('start', String(block.start))
  if (block.end !== undefined) params.set('end', String(block.end))

  return params
}

function VideoFigure({
  block,
  children,
}: {
  block: StudentBlockOf<'video'>
  children: React.ReactNode
}) {
  return (
    <figure className="space-y-2">
      <div className="relative aspect-video overflow-hidden rounded-lg border">{children}</div>
      {block.caption ? (
        <figcaption className="text-muted-foreground text-xs">{block.caption}</figcaption>
      ) : null}
    </figure>
  )
}

/** A video on its own: an embed, and nothing that talks to it. */
function PlainVideo({ block }: { block: StudentBlockOf<'video'> }) {
  return (
    <VideoFigure block={block}>
      {/* nocookie, because embedding a tracker into a lesson a child watches is not a
          decision this product gets to make on a teacher's behalf. */}
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${block.videoId}?${videoParams(block)}`}
        title={block.caption ?? 'Video'}
        allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture"
        allowFullScreen
        className="size-full"
      />
    </VideoFigure>
  )
}

/** How often a video is looked at for a jump the player did not announce. */
const SEEK_POLL_MS = 500
/** How far a video may be from where the room believes it is before that is a jump. */
const SEEK_JUMP_S = 2
/** A playing video this far behind the room is buffering, not somewhere else. */
const LAG_S = 6
/** How long to give a video told to play before deciding the browser refused. */
const AUTOPLAY_GRACE_MS = 1_500

/**
 * A video in a live lesson: the same embed, with YouTube's player API attached so that
 * play, pause and every jump made in one browser happen in all of them. Everyone may
 * drive it — a student who presses play is as much in the room as the teacher.
 *
 * The iframe is drawn only on the client, because the API wants to know the page's origin
 * and the server does not have one to give.
 */
function SyncedVideo({ block, t }: { block: StudentBlockOf<'video'>; t: Messages }) {
  const sync = useContext(MediaSyncContext)
  const origin = useSyncExternalStore(
    noSubscription,
    () => window.location.origin,
    () => null,
  )
  const frame = useRef<HTMLIFrameElement>(null)
  const player = useRef<YTPlayer | null>(null)
  const known = useRef<Known | null>(null)
  // What the room said before this player was ready to hear it.
  const backlog = useRef<LiveMedia | null>(null)
  const autoplayTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [needsTap, setNeedsTap] = useState(false)

  const apply = useCallback(
    (media: LiveMedia) => {
      const yt = player.current
      if (!yt) {
        backlog.current = media
        return
      }
      // Two messages that crossed on the wire: the later one is the room's mind.
      if (known.current && media.at < known.current.at) return

      const target = expectedTime(media)
      const state = yt.getPlayerState()
      const fresh = state === YT_STATE.UNSTARTED || state === YT_STATE.CUED
      known.current = media

      if (autoplayTimer.current) clearTimeout(autoplayTimer.current)
      if (media.rate && yt.getPlaybackRate() !== media.rate) yt.setPlaybackRate(media.rate)

      if (media.playing) {
        if (Math.abs(yt.getCurrentTime() - target) > MEDIA_DRIFT_S.video) yt.seekTo(target, true)
        if (state !== YT_STATE.PLAYING && state !== YT_STATE.BUFFERING) yt.playVideo()
        // A browser nobody has tapped may sit there; give it a moment, then ask for the
        // tap — unless the room has paused in the meantime, in which case sitting there
        // is exactly right.
        autoplayTimer.current = setTimeout(() => {
          const now = player.current?.getPlayerState()
          if (known.current?.playing && now !== YT_STATE.PLAYING && now !== YT_STATE.BUFFERING) {
            setNeedsTap(true)
          }
        }, AUTOPLAY_GRACE_MS)
      } else if (fresh) {
        // Seeking a player that has not started starts it. Cueing places it, silently.
        yt.cueVideoById({ videoId: block.videoId, startSeconds: Math.max(0, target) })
      } else {
        if (Math.abs(yt.getCurrentTime() - target) > MEDIA_DRIFT_S.video) yt.seekTo(target, true)
        // After the seek, whatever the player was doing before it: a seek can start one.
        yt.pauseVideo()
      }
    },
    [block.videoId],
  )

  /** Tells the room where this video is, whatever it believed before. */
  const publish = useCallback(
    (yt: YTPlayer, playing: boolean) => {
      const media: Known = {
        playing,
        time: yt.getCurrentTime(),
        rate: yt.getPlaybackRate() || 1,
        at: Date.now(),
      }
      known.current = media
      sync?.publish({ blockId: block.id, kind: 'video', ...media })
    },
    [sync, block.id],
  )

  /** Tells the room where this video is, unless the room already believes that. */
  const report = useCallback(
    (yt: YTPlayer, playing: boolean, tolerance: number) => {
      if (agrees(known.current, playing, yt.getCurrentTime(), tolerance, LAG_S)) return

      publish(yt, playing)
    },
    [publish],
  )

  // Somebody new is in: the browser that leads the room says where this video is — its
  // own player if that player is there, or what it was last told.
  const announce = useCallback(() => {
    const yt = player.current
    const belief = known.current
    if (!sync?.leads || !yt || !belief) return

    const state = yt.getPlayerState()
    const playing = state === YT_STATE.PLAYING || state === YT_STATE.BUFFERING
    if (agrees(belief, playing, yt.getCurrentTime(), MEDIA_DRIFT_S.video, LAG_S)) {
      publish(yt, playing)
    } else {
      sync.publish({ blockId: block.id, kind: 'video', ...belief })
    }
  }, [sync, block.id, publish])

  useMediaSync(block.id, apply, announce)

  // Attach the API to the iframe once it exists, and let go of it when the block goes.
  useEffect(() => {
    const iframe = frame.current
    if (!iframe) return

    let disposed = false
    let created: YTPlayer | null = null

    void loadYouTube().then((YT) => {
      if (disposed) return

      created = new YT.Player(iframe, {
        events: {
          onReady: (event: YTPlayerEvent) => {
            if (disposed) return
            player.current = event.target
            const waiting = backlog.current
            backlog.current = null
            if (waiting) apply(waiting)
          },
          onStateChange: (event: YTPlayerEvent) => {
            if (disposed) return
            const yt = event.target
            const playing = event.data === YT_STATE.PLAYING
            const stopped = event.data === YT_STATE.PAUSED || event.data === YT_STATE.ENDED
            if (!playing && !stopped) return

            if (autoplayTimer.current) clearTimeout(autoplayTimer.current)
            if (playing) setNeedsTap(false)

            // A pause or a play the room did not know about. Doing what the room said is
            // not news, and `report` knows the difference.
            report(yt, playing, MEDIA_DRIFT_S.video)
          },
          onPlaybackRateChange: (event: YTPlayerEvent) => {
            if (disposed) return
            const yt = event.target
            const belief = known.current
            if (belief && belief.rate !== yt.getPlaybackRate()) {
              const state = yt.getPlayerState()
              publish(yt, state === YT_STATE.PLAYING || state === YT_STATE.BUFFERING)
            }
          },
        },
      })
    })

    return () => {
      disposed = true
      player.current = null
      if (autoplayTimer.current) clearTimeout(autoplayTimer.current)
      try {
        created?.destroy()
      } catch {
        // The iframe may already be gone; there is nothing left to destroy.
      }
    }
  }, [origin, apply, report, publish])

  // YouTube says nothing when somebody drags the scrubber, so look for the jump: a video
  // that is not where the room believes it is, playing or paused.
  useEffect(() => {
    const poll = setInterval(() => {
      const yt = player.current
      const belief = known.current
      if (!yt || !belief) return

      const state = yt.getPlayerState()
      const playing = state === YT_STATE.PLAYING
      // Only the position is looked at here. Whether it plays is the player's own report,
      // through its events — a browser that refused to autoplay must not pause the room.
      if ((state !== YT_STATE.PLAYING && state !== YT_STATE.PAUSED) || playing !== belief.playing) {
        return
      }

      report(yt, playing, SEEK_JUMP_S)
    }, SEEK_POLL_MS)

    return () => clearInterval(poll)
  }, [report])

  // The tap the browser wanted: join the room where it is now, not where it was refused.
  const tap = () => {
    setNeedsTap(false)
    const belief = known.current
    if (belief) apply({ ...belief, blockId: block.id, kind: 'video', from: '' })
    else player.current?.playVideo()
  }

  return (
    <VideoFigure block={block}>
      {origin ? (
        <iframe
          ref={frame}
          src={`https://www.youtube-nocookie.com/embed/${block.videoId}?${videoParams(block)}&enablejsapi=1&origin=${encodeURIComponent(origin)}`}
          title={block.caption ?? 'Video'}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
          allowFullScreen
          className="size-full"
        />
      ) : (
        <div className="bg-muted size-full" />
      )}

      {needsTap ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
          <Button type="button" onClick={tap} className="gap-2 shadow-lg">
            <PlayIcon className="size-4" />
            {t.live.tapToPlay}
          </Button>
        </div>
      ) : null}
    </VideoFigure>
  )
}

export function DividerBlock() {
  return <hr className="border-border" />
}

/**
 * A passage. Comprehension questions are separate blocks placed under it, so this one
 * carries no answer of its own — it is something to read before the questions start.
 */
export function ReadingBlock({ block, t }: { block: StudentBlockOf<'reading'>; t: Messages }) {
  const { element, handlers, needsTap, tap } = useSyncedAudio(block.id)

  return (
    <article className="bg-muted/30 space-y-3 rounded-lg border p-4 sm:p-5">
      {block.title ? <h3 className="text-base font-semibold">{block.title}</h3> : null}

      {/* Read-along: above the passage, because it is meant to be started before reading. */}
      {block.audioAssetId ? (
        <>
          <audio
            ref={element}
            src={mediaSrc(block.audioAssetId)}
            controls
            preload="metadata"
            className="h-9 w-full"
            {...handlers}
          />
          {needsTap ? <TapToPlay label={t.live.tapToListen} onClick={tap} /> : null}
        </>
      ) : null}

      <p className="whitespace-pre-wrap text-[15px] leading-7">{block.passage}</p>
    </article>
  )
}
