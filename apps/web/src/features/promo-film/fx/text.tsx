'use client'

import { Fragment, type CSSProperties } from 'react'
import { BRAND, ease, mix, progress, useShot, type Easing } from '../time'

type Pose = {
  y?: number
  x?: number
  blur?: number
  scale?: number
  rotate?: number
  opacity?: number
}

const REST: Required<Pose> = { y: 0, x: 0, blur: 0, scale: 1, rotate: 0, opacity: 1 }

function pose(from: Required<Pose>, to: Required<Pose>, amount: number): CSSProperties {
  const blur = mix(from.blur, to.blur, amount)
  return {
    opacity: mix(from.opacity, to.opacity, amount),
    transform: `translate(${mix(from.x, to.x, amount)}px, ${mix(from.y, to.y, amount)}px) scale(${mix(from.scale, to.scale, amount)}) rotate(${mix(from.rotate, to.rotate, amount)}deg)`,
    filter: blur > 0.05 ? `blur(${blur}px)` : undefined,
  }
}

/**
 * Splits `*marked*` words out of a line. The dictionary marks the word that carries the
 * colour, so every language chooses its own: "Поверніть собі *час*." / "*Zamanını* geri al."
 */
export function parseAccents(text: string): { word: string; accent: boolean }[] {
  const words: { word: string; accent: boolean }[] = []
  let accent = false
  for (const raw of text.split(' ')) {
    if (!raw) continue
    let word = raw
    const opens = word.startsWith('*')
    if (opens) {
      accent = true
      word = word.slice(1)
    }
    const closes = /\*([.,!?:;…»)]*)$/.test(word)
    if (closes) word = word.replace(/\*([.,!?:;…»)]*)$/, '$1')
    words.push({ word, accent })
    if (closes) accent = false
  }
  return words
}

/** The text without its accent marks, for screen readers and measuring. */
export function plain(text: string): string {
  return text.replaceAll('*', '')
}

/**
 * Type that arrives on the beat: word by word or letter by letter, from below, blurred,
 * scaled — any mix — and leaves the same way. Times are shot-local milliseconds.
 *
 * Accented words (`*word*`) take the brand colour, and with `marker` a swipe of colour
 * sweeps in behind them just after they land.
 */
export function KineticText({
  text,
  at,
  by = 'word',
  stagger,
  duration = 520,
  from = { y: 60, blur: 12, opacity: 0 },
  easing = ease.outExpo,
  exitAt,
  exitDuration = 360,
  to = { y: -40, blur: 10, opacity: 0 },
  accentColor = BRAND,
  marker = false,
  className,
  style,
}: {
  text: string
  at: number
  by?: 'word' | 'char'
  stagger?: number
  duration?: number
  from?: Pose
  easing?: Easing
  exitAt?: number
  exitDuration?: number
  to?: Pose
  accentColor?: string
  marker?: boolean
  className?: string
  style?: CSSProperties
}) {
  const { local } = useShot()
  const words = parseAccents(text)
  const step = stagger ?? (by === 'word' ? 90 : 28)
  const start = { ...REST, ...from }
  const end = { ...REST, ...to }

  let unit = 0
  const leaving = exitAt === undefined ? 0 : progress(local, exitAt, exitDuration, ease.inCubic)

  return (
    <span className={className} style={{ display: 'inline', ...style }}>
      {words.map(({ word, accent }, wordIndex) => {
        const pieces = by === 'char' ? [...word] : [word]
        const wordStart = at + unit * step
        const content = pieces.map((piece, pieceIndex) => {
          const begin = at + unit * step
          unit++
          const enter = progress(local, begin, duration, easing)
          const arrived = pose(start, REST, enter)
          const shown = leaving > 0 ? pose(REST, end, leaving) : arrived
          return (
            <span
              key={pieceIndex}
              style={{
                display: 'inline-block',
                whiteSpace: 'pre',
                ...(leaving > 0 ? shown : arrived),
              }}
            >
              {piece}
            </span>
          )
        })
        const sweep =
          marker && accent ? progress(local, wordStart + duration * 0.6, 420, ease.outExpo) : 0

        return (
          <Fragment key={wordIndex}>
            {wordIndex > 0 ? ' ' : null}
            <span
              style={{
                display: 'inline-block',
                position: 'relative',
                whiteSpace: 'nowrap',
                color: accent ? (marker ? undefined : accentColor) : undefined,
              }}
            >
              {marker && accent ? (
                <span
                  aria-hidden
                  style={{
                    position: 'absolute',
                    left: '-0.12em',
                    right: '-0.12em',
                    top: '0.12em',
                    bottom: '0.06em',
                    background: accentColor,
                    borderRadius: '0.14em',
                    transformOrigin: 'left center',
                    transform: `scaleX(${sweep})`,
                    opacity: leaving > 0 ? 1 - leaving : 1,
                  }}
                />
              ) : null}
              <span style={{ position: 'relative' }}>{content}</span>
            </span>
          </Fragment>
        )
      })}
    </span>
  )
}

/** A number that counts to `to` from `at`, on a curve that slows into the final value. */
export function CountUp({
  from = 0,
  to,
  at,
  duration = 900,
  format = (value: number) => String(Math.round(value)),
  className,
  style,
}: {
  from?: number
  to: number
  at: number
  duration?: number
  format?: (value: number) => string
  className?: string
  style?: CSSProperties
}) {
  const { local } = useShot()
  const value = mix(from, to, progress(local, at, duration, ease.outExpo))
  return (
    <span className={className} style={{ fontVariantNumeric: 'tabular-nums', ...style }}>
      {format(value)}
    </span>
  )
}
