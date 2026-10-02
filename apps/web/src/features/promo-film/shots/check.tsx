'use client'

import { Fragment, type CSSProperties, type ReactNode } from 'react'
import type { Cue } from '../audio/cues'
import type { FilmCopy } from '../copy'
import { Glow } from '../fx/backdrop'
import { Burst, Dust, Flash, Ring, whip } from '../fx/effects'
import { Camera, Layer, Space, type Transform3D } from '../fx/space'
import { UiCard } from '../fx/surface'
import { KineticText, parseAccents, plain } from '../fx/text'
import { Replica } from '../replica'
import {
  BRAND,
  clamp,
  ease,
  HEIGHT,
  interpolate,
  mix,
  progress,
  randoms,
  spring,
  useShot,
  WIDTH,
} from '../time'

/**
 * Chapter 06 — exercises check themselves, and the assistant drafts the feedback on the
 * writing.
 *
 * Beat by beat (shot-local ms, 120 BPM):
 *  -340  handed-in answers rush in from the camera as the homework shot falls
 *        away, and land on a sheet on the downbeat; the score ring spins in   whoosh, thud
 *   -40  the headline lands, centred like every chapter's, its accent marked
 *   500  a scan runs down the sheet under the answers; each one it crosses
 *        turns green on the eighth notes (500, 750 … 1500) and feeds a fifth
 *        of the score ring, the camera leaning in after it                    5 rising chimes
 *  1500  the ring closes on the beat: a crown of sparks, a double shockwave,
 *        a mint flash, a camera punch, and a green wave down the answers      impact
 *  1660  the answers peel off to the left and the ring sinks away as the real
 *        review card flies in from the right; it lands on the beat at 2000   whoosh, thud
 *  2500  the draft is written into the field behind a warm edge, a light
 *        sweeps the card and the assistant's star flares, and the camera
 *        dollies in on the words until the cut                               sparkle
 *  3600  whip left                                                            whoosh
 */

const EMERALD = '#10b981'
const MINT = '#34d399'
const EMERALD_INK = '#047857'
const PEACH = '#ffb58a'

/** The shot's moments, in shot-local ms. */
const T = {
  /** The answers rush in while the homework shot falls away, and land on the downbeat. */
  rowsIn: -340,
  headline: -40,
  gaugeIn: -220,
  /** One answer turns green on each eighth note; the fifth lands on the beat at 1500. */
  checks: [500, 750, 1000, 1250, 1500],
  full: 1500,
  /** The answers peel off to the left and the ring sinks, pushed out by the review card. */
  peel: 1660,
  sink: 1700,
  handover: 1720,
  /** The card lands on the beat. */
  land: 2000,
  /** The camera starts in on the field just before the draft lands in it (scene time 2300). */
  dolly: 2450,
  draft: 2500,
  exit: 3600,
} as const

/** The handed-in answers: English lesson content, so data rather than copy. */
const ROWS = [
  ['Could I ', 'have', ' the bill, please?'],
  ['Would you like to pay by ', 'card', '?'],
  ['A table ', 'for', ' two, please.'],
  ["I'd ", 'like', ' the soup, please.'],
  ['Is service ', 'included', '?'],
] as const

const DEPTH = 1600

/** The answers: a sheet on the left, leaning back, its ticks turned toward us. */
const BOARD = { cx: 384, cy: 818, width: 600, row: 92, pitch: 112 } as const
const BOARD_HEIGHT = BOARD.row * ROWS.length + (BOARD.pitch - BOARD.row) * (ROWS.length - 1)
/** The status circle's centre, relative to the board's centre. */
const STATUS_X = BOARD.width / 2 - 24 - 22
const rowY = (index: number) => index * BOARD.pitch + BOARD.row / 2 - BOARD_HEIGHT / 2

/** The score ring, beside the sheet and turned toward it. */
const GAUGE = { cx: 862, cy: 812, size: 250 } as const
const GAUGE_R = 96
const GAUGE_C = 2 * Math.PI * GAUGE_R

/**
 * The review card's crop of the feedback scene: the assistant and the feedback field, with
 * the card's own padding round them. The exercises box is left out — the first half shows it.
 */
const CROP = { x: 41, y: 157, width: 438, height: 299 } as const
const CARD = { cx: 540, cy: 790, scale: 1.95 } as const
/** In crop px: the field, the lines the draft fills, and the assistant's icon. */
const FIELD = { x: 9.5, y: 163, width: 419, height: 126.7 } as const
const TEXT = { top: 170, bottom: 243 } as const
const ICON = { x: 34.2, y: 34.4 } as const
/** Where the middle of the draft sits on screen with the card at rest, before the camera. */
const DRAFT_Y = CARD.cy + ((TEXT.top + TEXT.bottom) / 2 - CROP.height / 2) * CARD.scale
/** How long the draft takes to be written in: about 150 ms a line. */
const WRITE = 600

/** The assistant's own mark: a four-pointed star with curved sides. */
const STAR =
  'M12 0C12.6 6.6 17.4 11.4 24 12C17.4 12.6 12.6 17.4 12 24C11.4 17.4 6.6 12.6 0 12C6.6 11.4 11.4 6.6 12 0Z'
/** The same star drawn as a glint of light: long, thin rays. */
const GLINT =
  'M12 0C12.25 8.6 15.2 11.75 24 12C15.2 12.25 12.25 15.2 12 24C11.75 15.2 8.8 12.25 0 12C8.8 11.75 11.75 8.8 12 0Z'

export const cues: readonly Cue[] = [
  { at: -330, kind: 'whoosh', duration: 420, gain: 0.4 },
  { at: 0, kind: 'thud', gain: 0.45 },
  { at: 500, kind: 'chime', gain: 0.42, pitch: 0 },
  { at: 750, kind: 'chime', gain: 0.48, pitch: 2 },
  { at: 1000, kind: 'chime', gain: 0.54, pitch: 4 },
  { at: 1250, kind: 'chime', gain: 0.6, pitch: 7 },
  { at: 1500, kind: 'chime', gain: 0.72, pitch: 12 },
  { at: 1500, kind: 'impact', gain: 0.62 },
  { at: 1700, kind: 'whoosh', duration: 460, gain: 0.55, pan: 0.45 },
  { at: 2000, kind: 'thud', gain: 0.4 },
  { at: 2480, kind: 'sparkle', gain: 0.85 },
  { at: 3600, kind: 'whoosh', duration: 380, gain: 0.65, pan: -0.5 },
]

/** Up fast, then away: a camera punch or a flare, `elapsed` ms after the hit. */
function punch(elapsed: number, rise = 70, fall = 220): number {
  if (elapsed <= 0) return 0
  if (elapsed < rise) return ease.outCubic(elapsed / rise)
  return Math.exp(-(elapsed - rise) / fall)
}

function rgb(color: string): [number, number, number] {
  const value = parseInt(color.slice(1), 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

function mixColor(from: string, to: string, amount: number, alpha = 1): string {
  const a = rgb(from)
  const b = rgb(to)
  const channel = (index: number) => Math.round(mix(a[index]!, b[index]!, clamp(amount)))
  return `rgb(${channel(0)} ${channel(1)} ${channel(2)} / ${alpha})`
}

/**
 * Where a point of a posed layer lands on screen: the layer's own transform (scale, then
 * rotateZ, rotateY, rotateX, then translate, as CSS applies them) and the Space's
 * perspective. Bursts and rings are drawn flat, so they need this to sit on the board.
 */
function project(pose: Transform3D, cx: number, cy: number, px: number, py: number) {
  const scale = pose.scale ?? 1
  let x = px * scale
  let y = py * scale
  let z = 0
  const rz = ((pose.rotateZ ?? 0) * Math.PI) / 180
  ;[x, y] = [x * Math.cos(rz) - y * Math.sin(rz), x * Math.sin(rz) + y * Math.cos(rz)]
  const ry = ((pose.rotateY ?? 0) * Math.PI) / 180
  ;[x, z] = [x * Math.cos(ry) + z * Math.sin(ry), -x * Math.sin(ry) + z * Math.cos(ry)]
  const rx = ((pose.rotateX ?? 0) * Math.PI) / 180
  ;[y, z] = [y * Math.cos(rx) - z * Math.sin(rx), y * Math.sin(rx) + z * Math.cos(rx)]
  const k = DEPTH / (DEPTH - ((pose.z ?? 0) + z))
  return {
    x: WIDTH / 2 + (cx + (pose.x ?? 0) + x - WIDTH / 2) * k,
    y: HEIGHT / 2 + (cy + (pose.y ?? 0) + y - HEIGHT / 2) * k,
  }
}

/** The sheet leans back like paper on a desk, its right edge (the ticks) toward us. */
function boardPose(local: number): Transform3D {
  return {
    y: -10 * clamp(local / 2000),
    rotateX: 20,
    rotateY: mix(-15, -9, clamp((local + 300) / 2200)),
  }
}

/** The ring spins in beside the sheet, swells when it closes, and sinks away for the card. */
function gaugePose(local: number): Transform3D {
  const enter = spring(local - T.gaugeIn, { stiffness: 190, damping: 21 })
  const flare = punch(local - T.full, 80, 300)
  const sink = progress(local, T.sink, 520, ease.inOutCubic)
  return {
    x: (1 - enter) * 150 - 120 * sink,
    y: Math.sin(local / 520) * 4,
    z: -900 * sink,
    rotateY: mix(14, 8, clamp((local + 220) / 1700)) - 40 * sink,
    rotateX: 6,
    rotateZ: (1 - enter) * -70,
    scale: (0.55 + 0.45 * enter) * (1 + 0.06 * flare),
  }
}

/** The card flies in from the right, lands on the beat, and turns to face the camera as it pushes in. */
function cardPose(local: number): Transform3D {
  const enter = progress(local, T.handover, 560, ease.outExpo)
  const land = spring(local - T.handover, { stiffness: 240, damping: 22 })
  const dolly = progress(local, T.dolly, 850, ease.inOutCubic)
  return {
    x: mix(880, 0, enter),
    y: mix(-50, 0, land) + Math.sin(local / 640) * 3,
    z: mix(-320, 0, enter),
    rotateY: mix(-50, -8, land) + 8 * dolly,
    rotateX: mix(10, 3, land) - 2 * dolly,
    rotateZ: mix(5, -0.6, land) + 0.6 * dolly,
    scale: CARD.scale,
  }
}

/**
 * The camera leans in and follows the scan down the sheet, comes back for the card, then
 * dollies in on the field so the draft is written big — and keeps creeping until the cut.
 */
function cameraAt(local: number) {
  const base = interpolate(
    local,
    [-400, 400, 1500, 2000, 2450, 3300, 3960],
    [1, 1.008, 1.045, 1, 1.006, 1.1, 1.115],
    [ease.linear, ease.inOutCubic, ease.inOutCubic, ease.inOutCubic, ease.inOutCubic, ease.linear],
  )
  // Until the card is in, the camera tracks the scan; from then on it keeps the draft's
  // middle where it wants it on screen — rising a little as it pushes in.
  const scanY = interpolate(
    local,
    [-400, 400, 1500, 2000],
    [0, 2, 28, 0],
    [ease.linear, ease.inOutCubic, ease.inOutCubic],
  )
  const aim = mix(DRAFT_Y, DRAFT_Y - 44, progress(local, T.dolly, 850, ease.inOutCubic))
  const draftY = DRAFT_Y - HEIGHT / 2 - (aim - HEIGHT / 2) / base

  return {
    zoom: base + 0.03 * punch(local - T.full, 70, 260) + 0.015 * punch(local - T.draft, 70, 260),
    // A slow sideways drift over the sheet; the card brings its own float.
    x: Math.sin(local / 1700) * 6 * (1 - progress(local, T.handover, 500, ease.inOutCubic)),
    y: local < T.land ? scanY : draftY,
    roll: interpolate(local, [-400, 4000], [-0.45, 0.35]),
  }
}

/**
 * A 3D group of its own. The kit's Camera keeps 3D for its children, so without this the
 * flat glows and the other groups would share one 3D world with the tilted card and slice
 * through it; flattened here, each group is sorted only against itself.
 */
function World({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-0" style={{ transformStyle: 'flat' }}>
      <Space depth={DEPTH}>{children}</Space>
    </div>
  )
}

/** How full the score is: a fifth more with every answer marked; the last fifth snaps shut on the beat. */
function scoreAt(local: number): number {
  return T.checks.reduce(
    (sum, at, index) =>
      sum + progress(local, at, index === T.checks.length - 1 ? 110 : 280, ease.outExpo) * 0.2,
    0,
  )
}

export function Shot({ copy }: { copy: FilmCopy }) {
  const { local } = useShot()
  const leaving = progress(local, T.exit, 360, ease.inCubic)
  if (leaving >= 1) return null

  return (
    <div className="absolute inset-0" style={leaving > 0 ? whip(-1500 * leaving) : undefined}>
      <Camera {...cameraAt(local)}>
        <Lights local={local} />
        <Board local={local} />
        <Gauge local={local} />
        <Sparks local={local} />
        <ReviewCard local={local} copy={copy} />
      </Camera>

      <Headline text={copy.film.headlines.check} local={local} />

      {local > T.rowsIn ? (
        <Dust count={16} seed={61} opacity={0.32 * progress(local, T.rowsIn, 500, ease.outCubic)} />
      ) : null}
      <Flash at={T.full} rise={50} fall={340} color="#d1fae5" peak={0.1} />
    </div>
  )
}

/** The plain words on one line, the accented run on the next: the same split in any language. */
function splitHeadline(text: string): [string, string] {
  const words = parseAccents(text)
  const first = words.findIndex((word) => word.accent)
  if (first <= 0) return [text, '']

  const head = words
    .slice(0, first)
    .map((word) => word.word)
    .join(' ')
  const tail = words.slice(first)
  const marked = tail
    .map((word, index) => {
      const opens = word.accent && !tail[index - 1]?.accent
      const closes = word.accent && !tail[index + 1]?.accent
      return `${opens ? '*' : ''}${word.word}${closes ? '*' : ''}`
    })
    .join(' ')
  return [head, marked]
}

/** Centred over the picture like every chapter's headline, the accent marked on its own line. */
function Headline({ text, local }: { text: string; local: number }) {
  const [first, second] = splitHeadline(text)
  // About half an em a letter at this weight and tracking: as big as the longer line fits.
  const longest = Math.max(plain(first).length, plain(second).length)
  const size = clamp(Math.round(860 / (longest * 0.52)), 84, 106)
  const from = { y: 70, blur: 14, opacity: 0 }

  return (
    <div
      className="absolute text-center"
      style={{
        left: 90,
        top: 160,
        width: 900,
        fontSize: size,
        fontWeight: 650,
        letterSpacing: '-0.035em',
        lineHeight: 1.08,
        whiteSpace: 'nowrap',
        textShadow: '0 6px 40px rgb(0 0 0 / 0.55)',
        transform: `translateY(${Math.sin(local / 1400) * 2.5}px)`,
      }}
    >
      <div>
        <KineticText text={first} at={T.headline} stagger={90} duration={560} from={from} />
      </div>
      {second ? (
        <div>
          <KineticText
            text={second}
            at={T.headline + 160}
            stagger={90}
            duration={560}
            marker
            from={from}
          />
        </div>
      ) : null}
    </div>
  )
}

/** Light for the stage: green grows with every answer marked, warm light takes over for the assistant. */
function Lights({ local }: { local: number }) {
  const marked = T.checks.filter((at) => local >= at).length
  const arrive = progress(local, T.rowsIn, 500, ease.outCubic)
  const handover = progress(local, T.handover, 700, ease.inOutCubic)
  const sunk = progress(local, T.sink, 420, ease.inOutCubic)
  const green =
    (0.06 + 0.035 * marked + 0.24 * punch(local - T.full, 90, 420)) * (1 - handover * 0.9) * arrive
  const halo =
    (0.08 + 0.34 * punch(local - T.full, 90, 380)) *
    progress(local, T.gaugeIn, 400, ease.outCubic) *
    (1 - sunk)
  const warm =
    handover * (0.24 + 0.04 * Math.sin(local / 300)) + 0.26 * punch(local - T.draft, 90, 480)

  return (
    <>
      {green > 0.002 ? (
        <Glow x={BOARD.cx + 80} y={BOARD.cy} size={1250} color={EMERALD} opacity={green} />
      ) : null}
      {halo > 0.002 ? (
        <Glow x={GAUGE.cx} y={GAUGE.cy} size={520} color={MINT} opacity={halo} />
      ) : null}
      {warm > 0.002 ? (
        <Glow x={CARD.cx} y={CARD.cy + 40} size={1200} color={BRAND} opacity={warm} />
      ) : null}
    </>
  )
}

function Board({ local }: { local: number }) {
  if (local > T.peel + 700) return null
  const pose = boardPose(local)

  return (
    <World>
      <Layer cx={BOARD.cx} cy={BOARD.cy} width={BOARD.width} height={BOARD_HEIGHT} pose={pose}>
        <Beam local={local} />
        {ROWS.map((row, index) => (
          <AnswerRow key={index} index={index} local={local} parts={row} />
        ))}
      </Layer>
    </World>
  )
}

/** One handed-in answer: white, then the product's own "correct" tone when its turn comes. */
function AnswerRow({
  index,
  local,
  parts,
}: {
  index: number
  local: number
  parts: readonly [string, string, string]
}) {
  // In from the camera's side, settling onto the sheet; out to the left and back.
  const enter = progress(local, T.rowsIn + index * 50, 600, ease.outExpo)
  const leave = progress(local, T.peel + index * 35, 440, ease.inOutCubic)
  const opacity = clamp(enter * 3) * (1 - ease.inCubic(leave))
  if (opacity <= 0.001) return null

  const since = local - T.checks[index]!
  const tone = progress(since, 0, 180, ease.outCubic)
  const flash =
    (since >= 0 ? Math.exp(-since / 380) : 0) +
    0.7 * punch(local - (T.full + 60 + index * 40), 60, 240)
  const pop = spring(since, { stiffness: 420, damping: 26 })
  const draw = progress(since, 50, 260, ease.outCubic)
  const lift = since >= 0 ? 32 * Math.min(1, since / 60) * Math.exp(-since / 240) : 0
  const blur = (1 - enter) * 14 + leave * 12

  const [before, answer, after] = parts

  return (
    <Layer
      cx={BOARD.width / 2}
      cy={index * BOARD.pitch + BOARD.row / 2}
      width={BOARD.width}
      height={BOARD.row}
      opacity={opacity}
      flat
      pose={{
        x: -leave * 620,
        y: (1 - enter) * 250,
        z: (1 - enter) * 430 + lift - leave * 380,
        rotateX: (1 - enter) * -26,
        rotateY: leave * 32,
      }}
      style={{ filter: blur > 0.3 ? `blur(${blur}px)` : undefined }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: 20,
          background: mixColor('#ffffff', '#e8f8f1', tone),
          border: `2px solid ${mixColor('#e9e6e3', '#6ee7b7', tone)}`,
          boxShadow: [
            '0 30px 60px -26px rgb(0 0 0 / 0.7)',
            `0 0 ${18 + 46 * flash}px ${2 + 6 * flash}px rgb(16 185 129 / ${0.16 * tone + 0.5 * Math.min(1, flash)})`,
          ].join(', '),
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '0 24px 0 30px',
          color: '#1c1917',
          fontSize: 34,
          letterSpacing: '-0.01em',
        }}
      >
        <span style={{ flex: 1, whiteSpace: 'pre' }}>
          {before}
          <span
            style={{
              display: 'inline-block',
              padding: '0 6px',
              lineHeight: 1.3,
              fontWeight: 600,
              color: mixColor('#1c1917', EMERALD_INK, tone),
              background: `rgb(16 185 129 / ${0.14 * tone})`,
              borderRadius: '6px 6px 0 0',
              borderBottom: `3px solid ${mixColor('#d6d3d1', EMERALD, tone)}`,
            }}
          >
            {answer}
          </span>
          {after}
        </span>
        <Status pop={pop} draw={draw} tone={tone} />
      </div>
    </Layer>
  )
}

/** Waiting: a dashed ring. Marked: an emerald disc pops in and the tick draws itself. */
function Status({ pop, draw, tone }: { pop: number; draw: number; tone: number }) {
  return (
    <svg width={44} height={44} viewBox="0 0 42 42" style={{ flexShrink: 0, overflow: 'visible' }}>
      <circle
        cx={21}
        cy={21}
        r={18}
        fill="none"
        stroke="#d6d3d1"
        strokeWidth={2.5}
        strokeDasharray="4 4.4"
        opacity={1 - tone}
      />
      {pop > 0.001 ? (
        <g transform={`translate(21 21) scale(${pop}) translate(-21 -21)`}>
          <circle cx={21} cy={21} r={20} fill={EMERALD} />
          <polyline
            points="12.5,21.5 18.2,27 29.5,15.5"
            fill="none"
            stroke="white"
            strokeWidth={3.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={1 - draw}
          />
        </g>
      ) : null}
    </svg>
  )
}

/**
 * The scan, like a copier's light: the bar runs under the sheet, so its bright core shows
 * only past the answers' ends and through the gaps between them — never across a sentence —
 * while a soft wash of its light passes over the answers it is reading.
 */
function Beam({ local }: { local: number }) {
  const opacity = interpolate(local, [330, 430, 1540, 1680], [0, 1, 1, 0])
  if (opacity <= 0.001) return null
  // Board-local y: through the middle of each answer exactly as it is marked.
  const y = BOARD.row / 2 + ((local - T.checks[0]!) / 250) * BOARD.pitch
  const reach = BOARD.width + 180

  return (
    <>
      <Layer
        cx={BOARD.width / 2}
        cy={y}
        width={reach}
        height={48}
        pose={{ z: -26 }}
        opacity={opacity}
        flat
      >
        {/* The glow is its own blurred bar, so it fades out with the core instead of round it. */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 13,
            height: 22,
            borderRadius: 22,
            background: `linear-gradient(to right, transparent, ${MINT} 18%, ${MINT} 82%, transparent)`,
            filter: 'blur(9px)',
            opacity: 0.9,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 22,
            height: 4,
            borderRadius: 4,
            background:
              'linear-gradient(to right, transparent, #34d399 12%, #ecfdf5 50%, #34d399 88%, transparent)',
          }}
        />
      </Layer>
      <Layer
        cx={BOARD.width / 2}
        cy={y - 34}
        width={BOARD.width + 40}
        height={96}
        pose={{ z: 64 }}
        opacity={opacity}
        flat
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(to bottom, rgb(52 211 153 / 0), rgb(52 211 153 / 0.2) 78%, rgb(52 211 153 / 0))',
            maskImage: 'linear-gradient(to right, transparent, black 12%, black 88%, transparent)',
          }}
        />
      </Layer>
    </>
  )
}

/** The score: a ring that takes a fifth with every answer marked and closes on the beat. */
function Gauge({ local }: { local: number }) {
  const since = local - T.gaugeIn
  if (since < 0) return null
  const sink = progress(local, T.sink, 520, ease.inOutCubic)
  if (sink >= 1) return null

  const enter = spring(since, { stiffness: 190, damping: 21 })
  const draw = progress(since, 0, 700, ease.outCubic)
  const score = scoreAt(local)
  const flare = punch(local - T.full, 80, 300)
  const head = (score * 360 - 90) * (Math.PI / 180)
  const full = local >= T.full
  const blur = sink * 10

  return (
    <World>
      <Layer
        cx={GAUGE.cx}
        cy={GAUGE.cy}
        width={GAUGE.size}
        height={GAUGE.size}
        opacity={clamp(enter * 1.6) * (1 - ease.inCubic(sink))}
        pose={gaugePose(local)}
        flat={blur > 0.3}
        style={{ filter: blur > 0.3 ? `blur(${blur}px)` : undefined }}
      >
        <svg
          width={GAUGE.size}
          height={GAUGE.size}
          viewBox="0 0 240 240"
          style={{ overflow: 'visible' }}
        >
          <defs>
            <linearGradient id="check-gauge-arc" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#6ee7b7" />
              <stop offset="1" stopColor={EMERALD} />
            </linearGradient>
            <radialGradient id="check-gauge-disc">
              <stop
                offset="0"
                stopColor={full ? 'rgb(16 185 129 / 0.3)' : 'rgb(255 255 255 / 0.06)'}
              />
              <stop offset="1" stopColor="rgb(255 255 255 / 0.015)" />
            </radialGradient>
          </defs>
          <circle
            cx={120}
            cy={120}
            r={110}
            fill="url(#check-gauge-disc)"
            stroke="rgb(255 255 255 / 0.09)"
          />
          {Array.from({ length: 40 }, (_, tick) => {
            const angle = (tick / 40) * Math.PI * 2 - Math.PI / 2
            const lit = tick / 40 < score - 0.001
            return (
              <line
                key={tick}
                x1={120 + Math.cos(angle) * 118}
                y1={120 + Math.sin(angle) * 118}
                x2={120 + Math.cos(angle) * 125}
                y2={120 + Math.sin(angle) * 125}
                stroke={lit ? mixColor('#34d399', '#ffffff', flare) : 'rgb(255 255 255 / 0.2)'}
                strokeWidth={2}
                strokeLinecap="round"
                opacity={draw}
              />
            )
          })}
          <circle
            cx={120}
            cy={120}
            r={GAUGE_R}
            fill="none"
            stroke="rgb(255 255 255 / 0.1)"
            strokeWidth={12}
            strokeDasharray={GAUGE_C}
            strokeDashoffset={GAUGE_C * (1 - draw)}
            transform="rotate(-90 120 120)"
          />
          {score > 0.001 ? (
            <circle
              cx={120}
              cy={120}
              r={GAUGE_R}
              fill="none"
              stroke={
                flare > 0.02 ? mixColor('#6ee7b7', '#ffffff', flare) : 'url(#check-gauge-arc)'
              }
              strokeWidth={12 + 4 * flare}
              strokeLinecap="round"
              strokeDasharray={GAUGE_C}
              strokeDashoffset={GAUGE_C * (1 - score)}
              transform="rotate(-90 120 120)"
              style={{ filter: `drop-shadow(0 0 ${8 + 14 * flare}px rgb(16 185 129 / 0.9))` }}
            />
          ) : null}
          {score > 0.001 && score < 0.999 ? (
            <circle
              cx={120 + Math.cos(head) * GAUGE_R}
              cy={120 + Math.sin(head) * GAUGE_R}
              r={5}
              fill="white"
              style={{ filter: 'drop-shadow(0 0 6px #6ee7b7)' }}
            />
          ) : null}
        </svg>
        {/* The figure and its % as one group, centred in the ring with room to spare. */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: draw,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              transform: `translateY(3px) scale(${1 + 0.04 * flare})`,
              fontVariantNumeric: 'tabular-nums',
              fontWeight: 650,
              letterSpacing: '-0.04em',
              color: 'white',
              textShadow: full ? `0 0 ${24 + 30 * flare}px rgb(52 211 153 / 0.8)` : undefined,
            }}
          >
            <span style={{ fontSize: 56, lineHeight: 1 }}>{Math.round(score * 100)}</span>
            <span
              style={{
                fontSize: 26,
                lineHeight: 1,
                marginLeft: 3,
                color: 'rgb(255 255 255 / 0.6)',
              }}
            >
              %
            </span>
          </div>
        </div>
      </Layer>
    </World>
  )
}

/** Flat light over the sheet: a ring and a spray for every tick, and the ring closing. */
function Sparks({ local }: { local: number }) {
  const centre = project(gaugePose(T.full), GAUGE.cx, GAUGE.cy, 0, 0)

  return (
    <>
      {T.checks.map((at, index) => {
        if (local < at || local > at + 900) return null
        const point = project(boardPose(at), BOARD.cx, BOARD.cy, STATUS_X, rowY(index))
        return (
          <Fragment key={at}>
            <Ring
              at={at}
              x={point.x}
              y={point.y}
              from={22}
              to={78}
              duration={480}
              color={MINT}
              width={3}
            />
            <Burst
              at={at}
              x={point.x}
              y={point.y}
              count={12}
              seed={40 + index}
              colors={[MINT, '#ffffff', EMERALD]}
              speed={[180, 560]}
              size={[3, 7]}
              life={[380, 700]}
              gravity={260}
            />
          </Fragment>
        )
      })}
      <Crown local={local} at={T.full} x={centre.x} y={centre.y} radius={132} />
      {/* Both shockwaves fade out before they can reach the headline. */}
      <Ring
        at={T.full}
        x={centre.x}
        y={centre.y}
        from={126}
        to={400}
        duration={900}
        color={MINT}
        width={3}
      />
      <Ring
        at={T.full + 90}
        x={centre.x}
        y={centre.y}
        from={126}
        to={320}
        duration={760}
        color="#ffffff"
        width={2}
      />
    </>
  )
}

/** Sparks thrown off the ring all the way round, the way a finished ring radiates. */
function Crown({
  local,
  at,
  x,
  y,
  radius,
}: {
  local: number
  at: number
  x: number
  y: number
  radius: number
}) {
  const since = local - at
  if (since < 0 || since > 900) return null
  const count = 44

  return (
    <>
      {Array.from({ length: count }, (_, index) => {
        const [r1, r2, r3] = randoms(4100 + index, 3) as [number, number, number]
        const life = mix(520, 880, r2)
        if (since > life) return null
        const p = since / life
        const angle = (index / count) * Math.PI * 2 + (r1 - 0.5) * 0.1
        const reach = radius + ease.outExpo(p) * mix(36, 136, r3)
        const length = mix(12, 34, r3) * (1 - 0.55 * p)
        const color = index % 4 === 0 ? '#ffffff' : index % 4 === 2 ? '#a7f3d0' : MINT
        return (
          <span
            key={index}
            style={{
              position: 'absolute',
              left: x + Math.cos(angle) * reach - length / 2,
              top: y + Math.sin(angle) * reach - 1.5,
              width: length,
              height: 3,
              borderRadius: 3,
              background: color,
              boxShadow: `0 0 8px ${MINT}`,
              opacity: 1 - ease.inCubic(p),
              transform: `rotate(${angle}rad)`,
            }}
          />
        )
      })}
    </>
  )
}

/** The real review card: the assistant drafting, then its draft written into the field. */
function ReviewCard({ local, copy }: { local: number; copy: FilmCopy }) {
  if (local <= T.handover) return null

  const enter = progress(local, T.handover, 560, ease.outExpo)
  const blur = (1 - enter) * 12
  // The scene's own clock: the draft lands at its 2300, on the beat at 2500; held before
  // its pointer would appear.
  const sceneMs = clamp(local - (T.draft - 2300), 700, 3000)

  return (
    <World>
      <Layer
        cx={CARD.cx}
        cy={CARD.cy}
        width={CROP.width}
        height={CROP.height}
        pose={cardPose(local)}
        opacity={clamp(enter * 3)}
        flat
        style={{ filter: blur > 0.3 ? `blur(${blur}px)` : undefined }}
      >
        <RimGlow local={local} />
        <UiCard
          width={CROP.width}
          height={CROP.height}
          radius={14}
          style={{ position: 'relative' }}
        >
          <Replica scene="feedback" ms={sceneMs} copy={copy.promo} crop={CROP} />
          <DraftWipe local={local} />
          <LightSweep local={local} />
        </UiCard>
        <Flare local={local} />
        <Ring
          at={T.draft}
          x={ICON.x}
          y={ICON.y}
          from={12}
          to={110}
          duration={700}
          color={BRAND}
          width={2}
        />
        <Ring
          at={T.draft + 110}
          x={ICON.x}
          y={ICON.y}
          from={12}
          to={70}
          duration={560}
          color={PEACH}
          width={1.5}
        />
        <StarBurst local={local} />
        <Twinkles local={local} />
      </Layer>
    </World>
  )
}

/** A warm halo round the card once it is down, gathering while the assistant works and flaring when the draft lands. */
function RimGlow({ local }: { local: number }) {
  const pulse = punch(local - T.draft, 100, 480)
  const gather =
    progress(local, T.draft - 350, 350, ease.inCubic) *
    (1 - progress(local, T.draft, 600, ease.outCubic))
  const amount = 0.14 * progress(local, T.land, 400, ease.outCubic) + 0.12 * gather + 0.42 * pulse
  if (amount <= 0.01) return null

  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: 14,
        boxShadow: `0 0 ${28 + 34 * pulse}px ${3 + 7 * pulse}px rgb(255 79 1 / ${amount})`,
      }}
    />
  )
}

/**
 * The draft is written in, not dropped: the field's white lifts line by line behind a warm
 * writing edge — a soft bloom with a bright core, and sparks that ride the edge itself, so
 * nothing is left behind on the words.
 */
function DraftWipe({ local }: { local: number }) {
  const since = local - T.draft
  if (since < 0 || since > WRITE + 100) return null
  const reveal = progress(since, 0, WRITE, (x) => 0.5 * x + 0.5 * ease.outCubic(x))
  // From just above the first line to just under the last; the empty field below is left alone.
  const edge = mix(TEXT.top - 6, TEXT.bottom + 8, reveal)
  // The edge is past the last line by about WRITE - 100: it fades from there.
  const glow = 1 - progress(since, WRITE - 100, 160, ease.outCubic)

  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0 }}>
      {reveal < 1 ? (
        <div
          style={{
            position: 'absolute',
            left: FIELD.x + 1,
            width: FIELD.width - 2,
            top: edge,
            height: TEXT.bottom + 12 - edge,
            background: 'white',
          }}
        />
      ) : null}
      {glow > 0.01 ? (
        <>
          {/* The bloom: the line just written still glowing warm above the edge. */}
          <div
            style={{
              position: 'absolute',
              left: FIELD.x - 6,
              width: FIELD.width + 12,
              top: edge - 26,
              height: 34,
              opacity: glow,
              background:
                'linear-gradient(to bottom, rgb(255 181 138 / 0), rgb(255 181 138 / 0.45) 55%, rgb(255 79 1 / 0.6) 86%, rgb(255 79 1 / 0))',
              filter: 'blur(3px)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: FIELD.x + 2,
              width: FIELD.width - 4,
              top: edge - 1.5,
              height: 3,
              borderRadius: 3,
              opacity: glow,
              background: `linear-gradient(to right, rgb(255 79 1 / 0), ${BRAND} 10%, ${PEACH} 50%, ${BRAND} 90%, rgb(255 79 1 / 0))`,
              boxShadow: '0 0 8px 1px rgb(255 79 1 / 0.55)',
            }}
          />
          {Array.from({ length: 8 }, (_, index) => {
            const [r1, r2, r3] = randoms(880 + index, 3) as [number, number, number]
            const x =
              FIELD.x +
              6 +
              ((r1 * (FIELD.width - 12) + since * mix(0.06, 0.18, r2)) % (FIELD.width - 12))
            const size = mix(3, 6, r3)
            return (
              <span
                key={index}
                style={{
                  position: 'absolute',
                  left: x - size / 2,
                  top: edge - size / 2 + Math.sin(since / 55 + index) * 1.5,
                  width: size,
                  height: size,
                  borderRadius: 9,
                  opacity: glow,
                  background: index % 2 ? PEACH : BRAND,
                  boxShadow: `0 0 6px ${BRAND}`,
                }}
              />
            )
          })}
        </>
      ) : null}
    </div>
  )
}

/** Warm light glancing across the card as the draft lands. */
function LightSweep({ local }: { local: number }) {
  const p = progress(local, T.draft - 20, 760, ease.inOutCubic)
  if (p <= 0 || p >= 1) return null

  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        top: -40,
        left: mix(-240, CROP.width + 60, p),
        width: 170,
        height: CROP.height + 80,
        transform: 'skewX(-20deg)',
        background:
          'linear-gradient(to right, rgb(255 181 138 / 0), rgb(255 181 138 / 0.34) 42%, rgb(255 120 40 / 0.2) 58%, rgb(255 181 138 / 0))',
      }}
    />
  )
}

/**
 * The moment the draft lands: the assistant's star glints off its icon — a soft bloom and
 * long thin rays that flash out and are gone in under half a second, so they never sit on
 * the words beside it.
 */
function Flare({ local }: { local: number }) {
  const since = local - (T.draft - 30)
  if (since < 0 || since > 400) return null
  const grow = punch(since, 80, 130)
  const bloom = punch(since, 70, 120)
  const size = 132
  const halo = 92

  return (
    <>
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: ICON.x - halo / 2,
          top: ICON.y - halo / 2,
          width: halo,
          height: halo,
          borderRadius: '50%',
          opacity: bloom * 0.9,
          transform: `scale(${0.5 + 0.7 * bloom})`,
          background:
            'radial-gradient(circle, rgb(255 236 224) 0%, rgb(255 181 138 / 0.75) 30%, rgb(255 79 1 / 0.25) 58%, rgb(255 79 1 / 0) 72%)',
        }}
      />
      <svg
        viewBox="0 0 24 24"
        style={{
          position: 'absolute',
          left: ICON.x - size / 2,
          top: ICON.y - size / 2,
          width: size,
          height: size,
          overflow: 'visible',
          transform: `scale(${0.15 + grow}) rotate(${12 + since * 0.05}deg)`,
          opacity: Math.min(1, grow * 1.8),
          filter: `drop-shadow(0 0 2px ${BRAND}) drop-shadow(0 0 10px ${PEACH})`,
        }}
      >
        <defs>
          {/* White-hot in the middle, the rays thinning out to nothing like light. */}
          <radialGradient id="check-glint">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="0.14" stopColor="#ffd2b8" />
            <stop offset="0.5" stopColor={BRAND} />
            <stop offset="1" stopColor={BRAND} stopOpacity={0.25} />
          </radialGradient>
        </defs>
        <path d={GLINT} fill="url(#check-glint)" />
      </svg>
    </>
  )
}

/**
 * Small stars thrown out of the icon as the draft lands: warm colours only, mostly up and to
 * the left — off the card, onto the dark — and never stopping, gone within half a second.
 */
function StarBurst({ local }: { local: number }) {
  const since = local - T.draft
  if (since < 0 || since > 460) return null

  return (
    <>
      {Array.from({ length: 10 }, (_, index) => {
        const [r1, r2, r3, r4] = randoms(930 + index, 4) as [number, number, number, number]
        const life = mix(330, 440, r4)
        if (since > life) return null
        const p = since / life
        const angle = (mix(150, 330, (index + r1) / 10) * Math.PI) / 180
        const reach = 14 + 46 * (1 - Math.exp(-since / 70)) + mix(160, 320, r2) * (since / 1000)
        const size = mix(8, 14, r3) * (1 - 0.5 * p)
        const color = index % 2 ? PEACH : BRAND
        return (
          <svg
            key={index}
            viewBox="0 0 24 24"
            style={{
              position: 'absolute',
              left: ICON.x + Math.cos(angle) * reach - size / 2,
              top: ICON.y + Math.sin(angle) * reach - size / 2,
              width: size,
              height: size,
              opacity: 1 - ease.inCubic(p),
              transform: `rotate(${p * 120}deg)`,
              filter: `drop-shadow(0 0 3px ${color})`,
            }}
          >
            <path d={STAR} fill={color} />
          </svg>
        )
      })}
    </>
  )
}

/** Where and when one sparkle lives, in crop px and shot-local ms. */
function twinkleAt(index: number): {
  at: number
  life: number
  x: number
  y: number
  size: number
  color: string
} {
  const [r1, r2, r3, r4] = randoms(500 + index, 4) as [number, number, number, number]

  // While the assistant works: a few on the icon's open side, by the card's edge.
  if (index < 4) {
    const angle = (mix(120, 240, r1) * Math.PI) / 180
    const distance = mix(20, 36, r2)
    return {
      at: 2060 + index * 110 + r3 * 40,
      life: mix(420, 600, r4),
      x: ICON.x + Math.cos(angle) * distance,
      y: ICON.y + Math.sin(angle) * distance,
      size: mix(7, 12, r3),
      color: index % 2 ? PEACH : BRAND,
    }
  }

  // Then a slow twinkle round the card's rim — always outside it, on the dark.
  const side = index % 3
  return {
    at: 2950 + (index - 4) * 120 + r3 * 60,
    life: mix(520, 760, r4),
    x:
      side === 0
        ? mix(-24, -10, r1)
        : side === 1
          ? CROP.width + mix(10, 24, r1)
          : mix(30, CROP.width - 30, r1),
    y: side === 2 ? CROP.height + mix(10, 22, r2) : mix(40, CROP.height - 30, r2),
    size: mix(6, 12, r3),
    color: index % 3 === 0 ? '#ffffff' : index % 3 === 1 ? PEACH : BRAND,
  }
}

/** Sparkles round the card: the assistant at work, then the finished card glinting at its edges. */
function Twinkles({ local }: { local: number }) {
  return (
    <>
      {Array.from({ length: 13 }, (_, index) => {
        const { at, life, x, y, size, color } = twinkleAt(index)
        const since = local - at
        if (since < 0 || since > life) return null

        const grow =
          since < life * 0.35
            ? ease.outBack(since / (life * 0.35))
            : 1 - ease.inCubic((since - life * 0.35) / (life * 0.65))
        const style: CSSProperties = {
          position: 'absolute',
          left: x - size / 2,
          top: y - size / 2,
          width: size,
          height: size,
          transform: `scale(${Math.max(0, grow)}) rotate(${(since / life) * 70}deg)`,
          filter: `drop-shadow(0 0 4px ${color})`,
        }
        return (
          <svg key={index} viewBox="0 0 24 24" style={style}>
            <path d={STAR} fill={color} />
          </svg>
        )
      })}
    </>
  )
}
