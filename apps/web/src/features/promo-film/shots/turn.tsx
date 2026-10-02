'use client'

import type { CSSProperties, ReactNode } from 'react'
import type { Cue } from '../audio/cues'
import type { FilmCopy } from '../copy'
import { Glow } from '../fx/backdrop'
import { LogoMark } from '../fx/brand'
import { Burst, Dust } from '../fx/effects'
import { Camera } from '../fx/space'
import { parseAccents } from '../fx/text'
import { BRAND, clamp, ease, HEIGHT, INK, mix, progress, randoms, useShot, WIDTH } from '../time'
import { Ember, pulseAt, Rays, shake } from './open-fx'

/**
 * Turn (10–14 s): the film flips from problem to promise. The problem's white bursts open
 * from the centre onto true dark, and the line slams in a word a beat — huge, stacked —
 * while a clock bezel round it rewinds a full turn: time given back. The accent word ignites
 * in the brand colour, throwing sparks, the brand signs under it, and the bezel ticks the
 * hold's beats like a stopwatch. Then the camera flies into the accent word — into the
 * counter of one of its letters — until the frame is the letter's orange, and the counter
 * opens like a window with a burning rim onto the dark the library arrives in.
 */

const CX = WIDTH / 2
const CY = HEIGHT / 2
const STACK_Y = 610
const FONT = 166
const LINE = 154
/** Measured: "Поверніть" is 809 px wide at 180 px in the film's Inter at 700 / −0.045em. */
const WIDTH_PER_LETTER = 809 / 9 / 180
const R = 472
const LAST_BEAT = 1000
const IGNITE = { at: LAST_BEAT + 140, duration: 520 } as const
/** The small brand line under the statement, as soon as the accent has ignited. */
const SIGN_AT = IGNITE.at + IGNITE.duration - 10
/** The hold's beats: the bezel ticks on each, like a stopwatch. */
const TICKS = [2000, 2500, 3000] as const
/** The way in: the problem's white opening from the centre onto the dark. */
const IRIS = { at: -280, duration: 340 } as const
/** The way out: the rush into the counter; at `deep` the frame is the letter's orange. */
const RUSH = { at: 3330, deep: 3640 } as const
/** Where the counter is steered to on screen: where the library's field flies in. */
const PORTAL = { x: CX, y: 650 } as const

export const cues: readonly Cue[] = [
  { at: 0, kind: 'impact', gain: 1 },
  { at: 500, kind: 'impact', gain: 0.8, pitch: 2 },
  { at: 1000, kind: 'impact', gain: 1, pitch: -2 },
  { at: 1000, kind: 'suck', gain: 0.4, duration: 650 },
  { at: 1060, kind: 'tick', gain: 0.3 },
  { at: 1380, kind: 'tick', gain: 0.25 },
  { at: IGNITE.at + 20, kind: 'sparkle', gain: 0.5, pan: 0.1 },
  { at: SIGN_AT, kind: 'pop', gain: 0.3 },
  // The stopwatch's beats; the last one sits under the riser and needs no sound of its own.
  { at: TICKS[0], kind: 'tick', gain: 0.24, pitch: 5 },
  { at: TICKS[1], kind: 'tick', gain: 0.22, pitch: 5 },
  { at: RUSH.at - 580, kind: 'riser', gain: 0.55, duration: 580 },
  { at: RUSH.at - 20, kind: 'whoosh', gain: 0.9, duration: 700 },
]

/**
 * Letters with a counter to fly through, measured in the film's Inter at 700 with the
 * statement's −0.045em tracking: the glyph's box width, and its counter's centre and size,
 * all in em from the box's top-left (line-height 1).
 */
type Counter = { box: number; x: number; y: number; w: number; h: number }
const BOWL_A: Counter = { box: 0.5077, x: 0.2673, y: 0.7033, w: 0.19, h: 0.1475 }
const ROUND_O: Counter = { box: 0.5356, x: 0.2891, y: 0.6059, w: 0.235, h: 0.305 }
const BOWL_P: Counter = { box: 0.5527, x: 0.3054, y: 0.6055, w: 0.2375, h: 0.3025 }
const BOWL_D: Counter = { box: 0.5527, x: 0.2896, y: 0.6054, w: 0.2375, h: 0.3025 }
const BOWL_G: Counter = { box: 0.5527, x: 0.2896, y: 0.6003, w: 0.2375, h: 0.2975 }
const CAP_O: Counter = { box: 0.7026, x: 0.3726, y: 0.5, w: 0.3825, h: 0.4825 }
const COUNTERS: Record<string, Counter> = {
  а: BOWL_A,
  a: BOWL_A,
  о: ROUND_O,
  o: ROUND_O,
  ö: ROUND_O,
  р: BOWL_P,
  p: BOWL_P,
  b: BOWL_P,
  d: BOWL_D,
  q: BOWL_D,
  g: BOWL_G,
  ğ: BOWL_G,
  б: { box: 0.5346, x: 0.2889, y: 0.6155, w: 0.235, h: 0.2925 },
  д: { box: 0.5956, x: 0.3227, y: 0.6119, w: 0.21, h: 0.2775 },
  ю: { box: 0.7856, x: 0.5391, y: 0.606, w: 0.235, h: 0.305 },
  O: CAP_O,
  Ö: CAP_O,
  D: { box: 0.6562, x: 0.3456, y: 0.4999, w: 0.315, h: 0.4775 },
}

/** A word's rough width in em at the statement's tracking: enough to keep a split word centred. */
function roughWidth(text: string): number {
  let em = 0
  for (const letter of text) {
    const counter = COUNTERS[letter]
    if (counter) em += counter.box
    else if (/[.,:;!'’iıіїjlI1]/.test(letter)) em += 0.21
    else if (/[trfг]/.test(letter)) em += 0.33
    else if (/[mwмжшщюыфMW]/.test(letter)) em += 0.78
    else if (letter !== letter.toLowerCase()) em += 0.64
    else em += 0.52
  }
  return em
}

type Split = { before: string; target: string; after: string; counter: Counter }

/** The accent word cut round the letter with a counter nearest its middle, if it has one. */
function splitAtCounter(word: string): Split | null {
  const letters = [...word]
  const middle = (letters.length - 1) / 2
  let best = -1
  letters.forEach((letter, index) => {
    if (COUNTERS[letter] && (best < 0 || Math.abs(index - middle) < Math.abs(best - middle))) {
      best = index
    }
  })
  const target = letters[best]
  const counter = target ? COUNTERS[target] : undefined
  if (!target || !counter) return null
  return {
    before: letters.slice(0, best).join(''),
    target,
    after: letters.slice(best + 1).join(''),
    counter,
  }
}

const lineY = (index: number, count: number) => STACK_Y + (index - (count - 1) / 2) * LINE

/** A word's type size: the statement size, smaller only if a long word would not fit. */
const sizeOf = (word: string) => Math.min(FONT, 840 / (WIDTH_PER_LETTER * [...word].length))

/**
 * The accent word's paint, across its row (1080 px wide, `height` tall, the word between
 * `left` and `right`): white, then an ember edge sweeping it into brand orange; later a sheen.
 */
function accentPaint(
  ignite: number,
  sheen: number,
  { left, right, height }: { left: number; right: number; height: number },
): string | undefined {
  if (ignite <= 0) return undefined
  const span = right - left
  // Positions along a 100° gradient line, for points on the row's middle.
  const line = WIDTH * 0.9848 + height * 0.1736
  const at = (x: number) => `${((x - WIDTH / 2) * 0.9848 + line / 2).toFixed(1)}px`
  if (ignite < 1) {
    const s = mix(left - 0.15 * span, right + 0.18 * span, ignite)
    return `linear-gradient(100deg, ${BRAND} 0px, ${BRAND} ${at(s - 0.16 * span)}, #ffb88f ${at(s - 0.06 * span)}, #fff3ea ${at(s)}, #ffffff ${at(s + 0.04 * span)}, #ffffff ${line.toFixed(1)}px)`
  }
  if (sheen > 0 && sheen < 1) {
    const h = mix(left - 0.2 * span, right + 0.2 * span, sheen)
    return `linear-gradient(100deg, ${BRAND} 0px, ${BRAND} ${at(h - 0.14 * span)}, #ffc6a3 ${at(h)}, ${BRAND} ${at(h + 0.14 * span)}, ${BRAND} ${line.toFixed(1)}px)`
  }
  return `linear-gradient(${BRAND}, ${BRAND})`
}

/** A camera that holds world point `point` at screen point `screen`, at `zoom`. */
function lensOn(
  point: { x: number; y: number },
  screen: { x: number; y: number },
  zoom: number,
): { zoom: number; x: number; y: number } {
  return {
    zoom,
    x: point.x - CX - (screen.x - CX) / zoom,
    y: point.y - CY - (screen.y - CY) / zoom,
  }
}

/** The rush's zoom: exponential, so it reads as constant acceleration; ×10 at `deep`. */
function rushZoom(local: number): number {
  const u = clamp((local - RUSH.at) / (RUSH.deep - RUSH.at), 0, 1.25)
  return Math.pow(10, u * u)
}

/** Blur in screen pixels, whatever the zoom inside it. */
function Lens({ blur, children }: { blur: number; children: ReactNode }) {
  return (
    <div
      className="absolute inset-0"
      style={{ filter: blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : undefined }}
    >
      {children}
    </div>
  )
}

/**
 * The bezel: a ring of 60 ticks; its orange arc rewinds a full turn, counter-clockwise. Then
 * it keeps the beat like a stopwatch: on each, the hand steps a tick back, the tick it lands
 * on flashes and the ring swells.
 */
function Dial({ at }: { at: number }) {
  const { local } = useShot()
  const appear = progress(local, at - 30, 380, ease.outCubic)
  if (appear <= 0) return null

  const steps = TICKS.reduce((sum, beat) => sum + ease.outBack(clamp((local - beat) / 150)), 0)
  const sweep = 360 * ease.outQuint(clamp((local - at) / 1000)) + 6 * steps
  const beat = Math.max(...TICKS.map((when) => pulseAt(local, when)))
  const headTick = local >= TICKS[0] ? Math.round(sweep / 6) % 60 : -1
  const settled = progress(local, at + 900, 700, ease.inOutCubic)
  const box = (R + 40) * 2
  const c = box / 2
  const circumference = 2 * Math.PI * R
  const drawn = (Math.min(sweep, 360) / 360) * circumference
  const tail = Math.min(drawn, (46 / 360) * circumference)
  const head = (sweep * Math.PI) / 180
  const tiltX = mix(12, 5, progress(local, at, 2600, ease.inOutCubic))
  const tiltY = mix(-9, 7, progress(local, at, 2800, ease.inOutCubic))

  return (
    <div
      style={{
        position: 'absolute',
        left: CX - c,
        top: STACK_Y - c,
        width: box,
        height: box,
        opacity: appear,
        transform: `perspective(1800px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale(${mix(0.9, 1, appear)})`,
      }}
    >
      <svg
        aria-hidden
        width={box}
        height={box}
        style={{ position: 'absolute', inset: 0, overflow: 'visible' }}
      >
        <circle
          cx={c}
          cy={c}
          r={R}
          fill="none"
          stroke="rgb(255 255 255 / 0.13)"
          strokeWidth={1.5}
        />
        {beat > 0.01 ? (
          <circle
            cx={c}
            cy={c}
            r={R}
            fill="none"
            stroke={BRAND}
            strokeWidth={18}
            opacity={0.2 * beat}
          />
        ) : null}
        {Array.from({ length: 60 }, (_, k) => {
          const a = 6 * k
          const major = k % 5 === 0
          const len = major ? 18 : 9
          const rad = (a * Math.PI) / 180
          const dx = -Math.sin(rad)
          const dy = -Math.cos(rad)
          const passed = sweep - a
          const swept = passed >= 0 ? (1 - clamp(passed / 130)) * (1 - settled) : 0
          const lit = k === headTick ? Math.max(swept, beat) : swept
          return (
            <line
              key={k}
              x1={c + dx * (R + 7)}
              y1={c + dy * (R + 7)}
              x2={c + dx * (R + 7 + len + 6 * (k === headTick ? beat : 0))}
              y2={c + dy * (R + 7 + len + 6 * (k === headTick ? beat : 0))}
              stroke={
                lit > 0.02
                  ? `rgb(255 ${Math.round(mix(255, 120, lit))} ${Math.round(mix(255, 40, lit))} / ${mix(0.3, 1, lit)})`
                  : 'rgb(255 255 255 / 0.3)'
              }
              strokeWidth={major ? 3 : 2}
              strokeLinecap="round"
            />
          )
        })}
        {drawn > 0.5 ? (
          <g transform={`translate(${c} ${c}) rotate(-90) scale(1 -1)`}>
            <circle
              r={R}
              fill="none"
              stroke={BRAND}
              strokeWidth={3 + 2 * beat}
              strokeDasharray={`${drawn} ${circumference}`}
              opacity={0.9 + 0.1 * beat}
            />
            {settled < 1 ? (
              <circle
                r={R}
                fill="none"
                stroke="#ffd0b2"
                strokeWidth={5}
                strokeLinecap="round"
                strokeDasharray={`${tail} ${circumference}`}
                strokeDashoffset={-(drawn - tail)}
                opacity={1 - settled}
              />
            ) : null}
          </g>
        ) : null}
      </svg>
      <Ember
        x={c - R * Math.sin(head)}
        y={c - R * Math.cos(head)}
        size={10 + 4 * beat}
        glow={110 + 60 * beat}
        heat={clamp(1 - settled * 0.85 + 0.85 * beat)}
      />
    </div>
  )
}

/**
 * Warp streaks pouring out of the point the camera is rushing into: a tunnel of light through
 * the counter, each streak longer the nearer it is, reaching out to `reach`.
 */
function Warp({ x, y, reach }: { x: number; y: number; reach: number }) {
  const { local } = useShot()
  const q = progress(local, RUSH.deep - 150, 600)
  if (q <= 0 || local > RUSH.deep + 330) return null
  const fade = 1 - progress(local, RUSH.deep + 190, 140, ease.inCubic)

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {Array.from({ length: 44 }, (_, index) => {
        const [r1, r2, r3, r4] = randoms(9100 + index, 4) as [number, number, number, number]
        const angle = (index / 44) * 360 + (r1 - 0.5) * 7
        const frac = (((r2 + (local - RUSH.deep) / mix(240, 420, r4)) % 1) + 1) % 1
        const distance = 12 + frac * frac * reach
        const length = 10 + 0.42 * distance
        const opacity = 0.9 * Math.sin(Math.PI * frac) * clamp(q * 5) * fade
        if (opacity <= 0.01) return null
        return (
          <span
            key={index}
            style={{
              position: 'absolute',
              left: x,
              top: y - 1.25,
              width: length,
              height: 2.5,
              borderRadius: 99,
              opacity,
              background: `linear-gradient(90deg, transparent, ${r3 < 0.3 ? '#ff8a4a' : r3 < 0.65 ? '#ffd2b5' : '#ffffff'})`,
              transform: `rotate(${angle}deg) translateX(${distance}px)`,
              transformOrigin: '0 50%',
            }}
          />
        )
      })}
    </div>
  )
}

/**
 * The way in. The problem's white is taken over on its last full frame (the turn's own ink
 * is under it, so nothing of the problem shows through) and opens from the centre as a crisp
 * iris onto true dark: a band of burning orange just inside its edge, peach on the edge,
 * white beyond — all of it gone as the first word lands.
 */
function Iris() {
  const { local } = useShot()
  const fade = 1 - progress(local, IRIS.at + IRIS.duration - 160, 200, ease.outCubic)
  if (local < -300 || fade <= 0.002) return null

  const hole = 1000 * progress(local, IRIS.at, IRIS.duration, ease.outCubic)
  const at = `${CX}px ${STACK_Y}px`
  const background =
    hole < 1
      ? `radial-gradient(circle at ${at}, #ffd9c2 0px, #fff3ea 40px, #fffaf6 170px)`
      : `radial-gradient(circle at ${at}, rgb(255 120 40 / 0) ${Math.max(0, hole - 46).toFixed(1)}px, rgb(255 120 40 / 0.88) ${(hole - 1).toFixed(1)}px, #ffd2b5 ${(hole + 8).toFixed(1)}px, #fffaf6 ${(hole + 36).toFixed(1)}px)`

  return <div aria-hidden className="absolute inset-0" style={{ opacity: fade, background }} />
}

/**
 * The way out, through the letter. The frame turns the letter's orange around the counter
 * the camera is flying into; the counter opens — a window with a burning rim — onto the dark
 * the library flies in through, its light spilling round the edge.
 */
function Portal({
  x,
  y,
  rx,
  ry,
  flood,
}: {
  x: number
  y: number
  rx: number
  ry: number
  /** How far out from the counter the orange has spread, px; it fades over 380 px beyond. */
  flood: number
}) {
  const { local } = useShot()
  if (flood <= 0) return null
  // Fully open once the window holds all four corners of the frame.
  const corners = [
    [0, 0],
    [WIDTH, 0],
    [0, HEIGHT],
    [WIDTH, HEIGHT],
  ].map(([cx = 0, cy = 0]) => ((cx - x) / rx) ** 2 + ((cy - y) / ry) ** 2)
  if (Math.max(...corners) < 1) return null

  const rim = progress(local, RUSH.deep - 20, 90, ease.outCubic)
  const bloom =
    progress(local, RUSH.deep - 30, 90, ease.outCubic) *
    (1 - progress(local, RUSH.deep + 90, 200, ease.inCubic))
  // Stops along the window's own ellipse: 100% is its edge.
  const pct = (radius: number) => `${((radius / rx) * 100).toFixed(2)}%`
  const at = `${x.toFixed(1)}px ${y.toFixed(1)}px`
  const spread =
    flood < 2000 ? `, black ${pct(rx + flood)}, transparent ${pct(rx + flood + 380)}` : ''
  const mask = `radial-gradient(${rx.toFixed(1)}px ${ry.toFixed(1)}px at ${at}, transparent calc(100% - 1.5px), black 100%${spread})`

  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: BRAND, maskImage: mask, WebkitMaskImage: mask }}
      />
      {rim > 0.01 ? (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            left: x - rx,
            top: y - ry,
            width: rx * 2,
            height: ry * 2,
            borderRadius: '50%',
            border: `${mix(1, 3, rim).toFixed(2)}px solid #fff1e6`,
            boxShadow:
              '0 0 22px 5px rgb(255 206 170 / 0.85), inset 0 0 14px 2px rgb(255 122 40 / 0.8)',
            opacity: rim,
          }}
        />
      ) : null}
      {bloom > 0.01 ? (
        // The light spilling out round the edge onto the orange, never into the window.
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            mixBlendMode: 'screen',
            opacity: 0.8 * bloom,
            background: `radial-gradient(${(rx * 1.7).toFixed(1)}px ${(ry * 1.7).toFixed(1)}px at ${at}, rgb(255 230 210 / 0) 58.2%, rgb(255 226 204 / 0.95) 58.9%, rgb(255 150 80 / 0.5) 72%, rgb(255 79 1 / 0) 100%)`,
          }}
        />
      ) : null}
    </>
  )
}

export function Shot({ copy }: { copy: FilmCopy }) {
  const { local, duration } = useShot()
  if (local < -300 || local > duration + 400 || local > RUSH.deep + 420) return null

  const words = parseAccents(copy.film.turn)
  const count = words.length
  const accentIndex = Math.max(
    0,
    words.findIndex((word) => word.accent),
  )
  const accentWord = words[accentIndex]?.word ?? ''
  const accentSize = sizeOf(accentWord)
  const slams = words.map((_, index) => index * 500 - 40)

  // The accent word is laid out round the letter the camera will fly into, so where that
  // letter's counter sits is known exactly. The grid centres that letter; the row is moved by
  // half the difference of what stands before and after it, so the word is centred instead.
  const split = splitAtCounter(accentWord)
  const beforeWidth = split ? roughWidth(split.before) * accentSize : 0
  const afterWidth = split ? roughWidth(split.after) * accentSize : 0
  const targetWidth = split ? split.counter.box * accentSize : 0
  const shift = split ? (beforeWidth - afterWidth) / 2 : 0
  const half = split ? targetWidth / 2 : (roughWidth(accentWord) * accentSize) / 2
  const extent = {
    left: CX - half - beforeWidth,
    right: CX + half + afterWidth,
    height: accentSize * 1.4,
  }
  const accentY = lineY(accentIndex, count)
  const target = split
    ? {
        x: CX + shift + (split.counter.x - split.counter.box / 2) * accentSize,
        y: accentY - accentSize / 2 + split.counter.y * accentSize,
      }
    : { x: CX, y: accentY + 0.1 * accentSize }
  const counterSize = {
    w: (split ? split.counter.w : 0.2) * accentSize,
    h: (split ? split.counter.h : 0.2) * accentSize,
  }

  // Camera: a slow push, a punch on every slam, a breath back, then the rush.
  const base = 1 + 0.03 * progress(local, 0, 3400, ease.inOutCubic)
  const punch = slams.reduce(
    (sum, at) => sum + (local >= at ? 0.045 * (1 - progress(local, at, 420, ease.outExpo)) : 0),
    0,
  )
  const jolt = slams.reduce(
    (sum, at, index) => {
      const j = shake(local, at + 40, 170, 5, 20 + index)
      return { x: sum.x + j.x, y: sum.y + j.y }
    },
    { x: 0, y: 0 },
  )
  const breath =
    progress(local, RUSH.at - 190, 190, ease.inOutCubic) *
    (1 - progress(local, RUSH.at, 150, ease.inOutCubic))
  // The stack climbs as it grows: each slam re-centres the lines that have landed, so every
  // word hits where the eye already is.
  const centreOf = (landed: number) =>
    words.slice(0, landed).reduce((sum, _, index) => sum + lineY(index, count), 0) / landed -
    STACK_Y
  const climb = slams.reduce(
    (offset, at, index) =>
      index === 0
        ? offset
        : offset + (centreOf(index + 1) - centreOf(index)) * progress(local, at, 420, ease.outExpo),
    centreOf(1),
  )

  // The rush: the camera swings the counter onto the portal and flies into it, faster and
  // faster; every layer zooms about that one point, the far ones less.
  const zoom = rushZoom(local)
  const pan = progress(local, RUSH.at - 200, 520, ease.inOutCubic)
  const textZoom = base * (1 + punch) * (1 - 0.03 * breath)
  const textRest = {
    x: CX + textZoom * (target.x - CX + jolt.x),
    y: CY + textZoom * (target.y - CY - climb + jolt.y),
  }
  const screen = {
    x: mix(textRest.x, PORTAL.x, pan),
    y: mix(textRest.y, PORTAL.y, pan),
  }
  const text = lensOn(target, screen, textZoom * zoom)
  const backZoom = 1 + (base - 1) * 0.4
  const back = lensOn(
    target,
    {
      x: mix(CX + backZoom * (target.x - CX + jolt.x * 0.3), PORTAL.x, pan * 0.35),
      y: mix(CY + backZoom * (target.y - CY), PORTAL.y, pan * 0.35),
    },
    backZoom * Math.pow(zoom, 0.35),
  )
  const dialZoom = (1 + (base - 1) * 0.6) * (1 - 0.02 * breath)
  const dial = lensOn(
    target,
    {
      x: mix(CX + dialZoom * (target.x - CX + jolt.x * 0.5), PORTAL.x, pan * 0.6),
      y: mix(CY + dialZoom * (target.y - CY + jolt.y * 0.5), PORTAL.y, pan * 0.6),
    },
    dialZoom * Math.pow(zoom, 0.62),
  )
  const textBlur = 6 * clamp((zoom - 1.4) / 3.6)
  const backOut = 1 - progress(local, RUSH.at + 150, RUSH.deep - RUSH.at - 150, ease.inCubic)
  const dialOut = 1 - progress(local, RUSH.at, 260, ease.inCubic)
  const othersOut = progress(local, RUSH.at, 180, ease.inCubic)
  const signOut = progress(local, RUSH.at - 200, 200, ease.inCubic)

  // The portal: the letter's orange floods out from the counter to the frame's edges, then
  // the counter opens.
  const flooding = progress(local, RUSH.deep - 90, 90)
  const flood = local < RUSH.deep - 90 ? 0 : mix(30, 2000, flooding * flooding)
  const deepZoom = base * rushZoom(RUSH.deep)
  const opening = Math.exp((7.2 * Math.max(0, local - RUSH.deep)) / 1000)
  const holeZoom = local < RUSH.deep ? text.zoom : deepZoom
  const holeRx = 0.47 * counterSize.w * holeZoom * opening
  const holeRy =
    holeRx / mix(counterSize.w / counterSize.h, 1, progress(local, RUSH.deep, 220, ease.inOutCubic))

  // The light the turn opens on, and the accent's ignition and sheen.
  const ink = 1 - progress(local, 200, 400, ease.inOutCubic)
  const irisFlare = 1 - progress(local, IRIS.at + 40, 700, ease.outCubic)
  const ignite = progress(local, IGNITE.at, IGNITE.duration, ease.inOutCubic)
  const sheen = progress(local, 2500, 620, ease.inOutCubic)
  const flare = slams.reduce(
    (sum, at) => sum + (local >= at ? 1 - progress(local, at, 500, ease.outCubic) : 0),
    0,
  )

  // The brand signs under the line right after it ignites: at rest by ~2.1 s.
  const rule = progress(local, SIGN_AT - 100, 450, ease.outExpo) * (1 - signOut)
  const sign = progress(local, SIGN_AT, 560, ease.outExpo) * (1 - signOut)
  const ruleY = lineY(count - 1, count) + FONT * 0.36 + 70
  const signY = ruleY + 56

  return (
    <>
      {ink > 0.001 ? (
        <div className="absolute inset-0" style={{ background: INK, opacity: ink }} />
      ) : null}

      {backOut > 0.001 ? (
        <div className="absolute inset-0" style={{ opacity: backOut }}>
          <Camera zoom={back.zoom} x={back.x} y={back.y}>
            <Rays
              x={CX}
              y={STACK_Y}
              size={2100}
              turn={-local * 0.012}
              opacity={
                clamp(0.1 + 0.16 * flare + 0.08 * ignite + 0.3 * irisFlare) *
                progress(local, IRIS.at + 20, 260)
              }
            />
            <Glow x={CX} y={STACK_Y} size={1050} opacity={0.15 + 0.12 * flare + 0.08 * ignite} />
          </Camera>
          {local > 0 ? <Dust count={22} seed={31} opacity={0.4 * progress(local, 0, 600)} /> : null}
        </div>
      ) : null}
      {dialOut > 0.001 ? (
        <div className="absolute inset-0" style={{ opacity: dialOut }}>
          <Lens blur={textBlur * 0.5}>
            <Camera zoom={dial.zoom} x={dial.x} y={dial.y}>
              <Dial at={LAST_BEAT} />
            </Camera>
          </Lens>
        </div>
      ) : null}

      <Iris />

      {local < RUSH.deep + 10 ? (
        <Lens blur={textBlur}>
          <Camera zoom={text.zoom} x={text.x} y={text.y}>
            {words.map(({ word, accent }, index) => {
              const at = slams[index]!
              if (local < at) return null
              const isAccent = index === accentIndex
              const leave = isAccent ? 0 : othersOut
              if (leave >= 1) return null
              const size = sizeOf(word)
              const land = progress(local, at, 360, ease.outExpo)
              const bloom = 1 - progress(local, at, 600, ease.outCubic)
              const parts = isAccent ? split : null
              const paint = isAccent ? accentPaint(ignite, sheen, extent) : undefined
              const glow = isAccent ? ignite * (0.55 + 0.12 * Math.sin(local / 230)) : 0
              const filters = [
                land < 0.99 ? `blur(${mix(16, 0, progress(local, at, 240, ease.outCubic))}px)` : '',
                bloom > 0.01
                  ? `drop-shadow(0 0 ${24 + 20 * bloom}px rgb(255 255 255 / ${0.55 * bloom}))`
                  : '',
                glow > 0.01 ? `drop-shadow(0 0 34px rgb(255 79 1 / ${glow}))` : '',
              ].filter(Boolean)
              const style: CSSProperties = {
                position: 'absolute',
                left: 0,
                width: WIDTH,
                top: lineY(index, count) - size * 0.7,
                height: size * 1.4,
                display: 'grid',
                alignItems: 'center',
                ...(parts
                  ? { gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)' }
                  : { justifyItems: 'center' }),
                fontSize: size,
                fontWeight: 700,
                letterSpacing: '-0.045em',
                lineHeight: 1,
                whiteSpace: 'nowrap',
                opacity: progress(local, at, 70) * (1 - leave),
                transform: `translateX(${parts ? shift : 0}px) scale(${mix(1.8, 1, land)})`,
                filter: filters.length ? filters.join(' ') : undefined,
                ...(paint
                  ? {
                      backgroundImage: paint,
                      WebkitBackgroundClip: 'text',
                      backgroundClip: 'text',
                      color: 'transparent',
                    }
                  : { color: accent && ignite >= 1 ? BRAND : 'white' }),
              }
              return (
                <div key={index} style={style}>
                  {parts ? (
                    <>
                      <span style={{ justifySelf: 'end' }}>{parts.before}</span>
                      <span>{parts.target}</span>
                      <span style={{ justifySelf: 'start' }}>{parts.after}</span>
                    </>
                  ) : (
                    <span>{word}</span>
                  )}
                </div>
              )
            })}
            {/* Sparks thrown off the ember edge as it crosses the accent word. */}
            {[0.18, 0.5, 0.82].map((fraction, index) => (
              <Burst
                key={index}
                at={IGNITE.at + ((fraction * 100 + 15) / 133) * IGNITE.duration}
                x={extent.left + shift + fraction * (extent.right - extent.left)}
                y={accentY - accentSize * 0.12}
                count={8}
                seed={60 + index}
                shape="spark"
                direction={-90}
                spread={150}
                speed={[220, 640]}
                size={[2, 3.6]}
                life={[380, 820]}
                gravity={420}
                colors={[BRAND, '#ffb58a', '#ffffff']}
              />
            ))}
            {rule > 0.001 ? (
              <span
                aria-hidden
                style={{
                  position: 'absolute',
                  left: CX - 36 * rule,
                  top: ruleY - 1,
                  width: 72 * rule,
                  height: 2,
                  borderRadius: 99,
                  background: BRAND,
                  boxShadow: '0 0 12px rgb(255 79 1 / 0.7)',
                  opacity: 1 - signOut,
                }}
              />
            ) : null}
            {sign > 0.001 ? (
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  width: WIDTH,
                  top: signY - 22,
                  height: 44,
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 14,
                  opacity: sign,
                  transform: `translateY(${(1 - progress(local, SIGN_AT, 560, ease.outExpo)) * 16}px)`,
                  filter: sign < 0.98 && signOut <= 0 ? `blur(${(1 - sign) * 6}px)` : undefined,
                }}
              >
                <LogoMark size={40} />
                <span
                  style={{
                    fontSize: 30,
                    fontWeight: 600,
                    letterSpacing: '-0.02em',
                    color: 'rgb(255 255 255 / 0.86)',
                  }}
                >
                  {copy.appName}
                </span>
              </div>
            ) : null}
          </Camera>
        </Lens>
      ) : null}

      <Warp x={screen.x} y={screen.y} reach={Math.max(180, holeRx * 1.15)} />
      <Portal x={screen.x} y={screen.y} rx={holeRx} ry={holeRy} flood={flood} />
    </>
  )
}
