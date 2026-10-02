'use client'

import type { CSSProperties } from 'react'
import { CHAPTERS } from '../film'
import { FPS, interpolate, useFilmTime } from '../time'

const MONO: CSSProperties = {
  // Inter, not the mono face: the mono face has no Cyrillic, and chapter names are Ukrainian.
  fontFamily: 'var(--font-sans), system-ui, sans-serif',
  fontVariantNumeric: 'tabular-nums',
  fontWeight: 500,
  fontSize: 15,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  color: 'rgb(255 255 255 / 0.55)',
}

function timecode(ms: number): string {
  const total = Math.floor(ms / 1000)
  const frames = Math.floor(((ms % 1000) / 1000) * FPS)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `00:${pad(Math.floor(total / 60))}:${pad(total % 60)}:${pad(frames)}`
}

/**
 * The corners of a motion reel: the brand top-left, a running timecode top-right, the
 * chapter bottom-right. Bottom-left stays empty: on the sign-in page the player puts its
 * pause and sound buttons there. Quiet by design — it frames the picture, it never
 * competes with it. Fades in after the opening and out at the end.
 */
export function Hud({
  brand,
  chapterNames,
}: {
  brand: string
  chapterNames: Record<string, string>
}) {
  const t = useFilmTime()
  // Only between the brand moments: the opening lockup and the closing card say the name
  // themselves, and the climax and end are no chapter.
  const opacity = interpolate(t, [3900, 4500, 41700, 42300], [0, 1, 1, 0])
  if (opacity <= 0.001) return null

  const chapter = CHAPTERS.findLast((entry) => t >= entry.start) ?? null
  const index = chapter ? CHAPTERS.indexOf(chapter) : -1

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0" style={{ opacity }}>
      <div style={{ ...MONO, position: 'absolute', left: 56, top: 52 }}>{brand}</div>
      <div
        style={{
          ...MONO,
          position: 'absolute',
          right: 56,
          top: 52,
          display: 'flex',
          gap: 14,
          alignItems: 'center',
        }}
      >
        <span
          style={{
            width: 9,
            height: 9,
            borderRadius: 99,
            background: '#ff4f01',
            opacity: 0.5 + 0.5 * Math.round((Math.sin(t / 260) + 1) / 2),
            boxShadow: '0 0 10px #ff4f01',
          }}
        />
        {timecode(t)}
      </div>
      <div style={{ ...MONO, position: 'absolute', right: 56, bottom: 54 }}>
        {chapter && index >= 0
          ? `${String(index + 1).padStart(2, '0')} / ${String(CHAPTERS.length).padStart(2, '0')} — ${chapterNames[chapter.id] ?? ''}`
          : ''}
      </div>
    </div>
  )
}
