'use client'

import { MicOffIcon, PhoneOffIcon, ScreenShareIcon, VideoIcon } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import type { Cue } from '../audio/cues'
import type { FilmCopy } from '../copy'
import { Burst } from '../fx/effects'
import { KineticText } from '../fx/text'
import {
  BEAT,
  BRAND,
  clamp,
  ease,
  frameOf,
  HEIGHT,
  interpolate,
  mix,
  progress,
  randoms,
  useShot,
} from '../time'
import {
  ChatCard,
  DesktopFile,
  PDF_RED,
  PdfBadge,
  PdfChip,
  SHEETS,
  Sticky,
  TabBrowser,
  Worksheet,
} from './problem-props'

/**
 * 02 — the problem. Sunday, 23:47, on a lock screen: the day drops onto the downbeat, the
 * time falls out of the lens and hits the glass, and a student's message lights up under
 * it — can you send the PDF again? Then the old way of teaching buries it all: the "final"
 * versions, a call stuck on screen sharing that shoves the message aside, a browser drowning
 * in tabs crashing onto the bar, and a flood of worksheets, piling up in 3D while the camera
 * pushes in, swings round the pile and tips. The line lands over the pile on a dark pool;
 * then everything spirals into one white-hot point, which pinches and blows out to white for
 * `turn`.
 *
 * Beats (shot-local ms, 120 BPM): day lands 0 · time SLAM 500 · the message 1000 · the
 * minute flips 1500 · the call 1875 · the browser crashes on the bar 2000 · the flood
 * 2560–3060 · the line's first word 3000 · pops 3500 / 4000 · inhale 4250 · implode 4500 ·
 * the line lets go 5060 · pinch 5390 · blast 5450 · white 5560 · `turn` 6000.
 */

/** The day falls this long onto the downbeat — starting once the opening lockup has lifted past. */
const DAY_FALL = 110
const DROP = 380
const SLAM = 500
/** Оля's message lights up the lock screen. */
const PING = 1000
const FLIP = 1500
/** The call window lands on the eighth before the bar; on its way in it shoves the message. */
const CALL = 1875
const SHOVE = 1755
const CRASH = 2000
const FLOOD = 2560
/** The line starts a little early so its first word hits the beat at 3000. */
const LINE = 2850
const HOLD = 3000
const INHALE = 4250
const IMPLODE = 4500
/** The line lets go and falls in; from here the core burns over everything. */
const RELEASE = 5060
const PINCH = 5390
const COLLAPSE = 5420
const BLAST = 5450
const WHITE = 5560

/** The same warm white `turn` opens on, so the hand-over has no seam. */
const FLASH_WHITE = '#fffaf6'

/** Perspective of the pile, and the point everything falls into. */
const DEPTH = 1400
const CORE = { x: 540, y: 660 }

export const cues: readonly Cue[] = [
  { at: 0, kind: 'thud', gain: 0.6 },
  { at: SLAM, kind: 'impact', gain: 1 },
  { at: PING, kind: 'ding', gain: 0.5 },
  { at: 1050, kind: 'whoosh', duration: 520, gain: 0.4, pan: -0.5 },
  { at: FLIP, kind: 'tick', gain: 0.85 },
  { at: CALL - 250, kind: 'whoosh', duration: 380, gain: 0.5, pan: 0.6 },
  { at: CRASH, kind: 'thud', gain: 0.8 },
  { at: CRASH, kind: 'glitch', gain: 0.6 },
  { at: FLOOD, kind: 'whoosh', duration: 560, gain: 0.65 },
  { at: HOLD, kind: 'impact', gain: 0.5, pitch: 4 },
  { at: 3500, kind: 'pop', gain: 0.32, pan: -0.3 },
  { at: 4000, kind: 'pop', gain: 0.32, pan: 0.3, pitch: 2 },
  { at: 4450, kind: 'riser', duration: 1000, gain: 0.7 },
  { at: 4950, kind: 'suck', duration: WHITE - 4950, gain: 0.85 },
]

/**
 * A spring let go with a push: it leaves fast, lands with a little weight (≈3% over) and
 * settles. Closed form, so any frame stands alone.
 */
function fling(elapsed: number, stiffness: number, damping: number, velocity: number): number {
  if (elapsed <= 0) return 0
  const t = elapsed / 1000
  const omega = Math.sqrt(stiffness)
  const zeta = damping / (2 * omega)
  const omegaD = omega * Math.sqrt(1 - zeta * zeta)
  return (
    1 -
    Math.exp(-zeta * omega * t) *
      (Math.cos(omegaD * t) + ((zeta * omega - velocity) / omegaD) * Math.sin(omegaD * t))
  )
}

/**
 * How a piece arrives: thrown (light / heavy springs), risen into place (the message),
 * dropped under gravity onto the desk, or popped in place.
 */
type Motion = 'light' | 'heavy' | 'rise' | 'fall' | 'pop'

/** From letting go to first touching the rest pose — so every landing sits on its cue. */
const LEAD: Record<Motion, number> = { light: 216, heavy: 253, rise: 0, fall: 240, pop: 0 }

function travel(elapsed: number, motion: Motion): number {
  if (elapsed <= 0) return 0
  switch (motion) {
    case 'light':
      return fling(elapsed, 170, 20, 8)
    case 'heavy':
      return fling(elapsed, 140, 18, 6)
    case 'rise':
      return ease.outExpo(clamp(elapsed / 560))
    case 'pop':
      return ease.outCubic(clamp(elapsed / 220))
    case 'fall': {
      // Gravity all the way down, then a short rebound off the desk.
      if (elapsed < LEAD.fall) return (elapsed / LEAD.fall) ** 2
      const after = elapsed - LEAD.fall
      return 1 - 0.02 * Math.sin(Math.PI * clamp(after / 160)) * Math.exp(-after / 200)
    }
  }
}

/** A hand-held jolt for `length` ms after `at`: new offsets every frame, fading out. */
function shake(t: number, at: number, length: number, amount: number) {
  if (t < at || t > at + length) return { x: 0, y: 0 }
  const fade = 1 - (t - at) / length
  const [a = 0, b = 0] = randoms(at * 31 + 7 + frameOf(t), 2)
  return { x: (a - 0.5) * 2 * amount * fade, y: (b - 0.5) * 2 * amount * fade }
}

/** Soft at both ends but already moving early: the push into the clock starts right off the hit. */
const easeInOutSine = (x: number) => 0.5 - 0.5 * Math.cos(Math.PI * x)

/**
 * The camera on the pile: still on the slam, then a slow push into the clock that goes on
 * into the pile; a creeping roll; a swing round the pile while the line holds (the layers
 * slide past each other) with a kick on every beat; a breath back, then the rush in.
 */
function camera(t: number) {
  const rush = ease.inCubic(clamp((t - IMPLODE) / (COLLAPSE - IMPLODE)))
  const breath = Math.sin(Math.PI * clamp((t - INHALE) / 520)) * (t < IMPLODE + 300 ? 1 : 0)
  const push = interpolate(
    t,
    [SLAM, FLIP + 100, HOLD, INHALE],
    [0, 90, 125, 185],
    [easeInOutSine, ease.inOutCubic, ease.inOutCubic],
  )
  const unease =
    interpolate(t, [700, 3600], [0, -3.6], ease.inOutCubic) +
    Math.sin(t / 640) * 0.5 * clamp((t - 900) / 1400)
  const tiltX = interpolate(t, [1800, HOLD, INHALE], [0, 4, 5.5], ease.inOutCubic)
  const tiltY = interpolate(t, [1800, HOLD, INHALE], [0, -8, 6], ease.inOutCubic)
  const land = shake(t, 0, 150, 3)
  const jolt = shake(t, SLAM, 260, 12)
  const crash = shake(t, CRASH, 230, 7)
  // While the line holds, the pile kicks toward the lens on every beat.
  const kick = t >= HOLD && t < IMPLODE ? Math.exp(-((t - HOLD) % BEAT) / 120) : 0
  return {
    x: Math.sin(t / 1300) * 10 + land.x + jolt.x + crash.x,
    y: Math.cos(t / 1700) * 8 + land.y + jolt.y + crash.y + kick * 2,
    z: push - breath * 40 + rush * 330 + kick * 26,
    roll: unease * (1 - rush) + rush * 38,
    tiltX: tiltX * (1 - rush),
    tiltY: tiltY * (1 - rush),
  }
}

/** The pile breathes out before it collapses: a radial scale on every offset. */
const inhale = (t: number) => 1 + 0.07 * ease.inOutCubic(clamp((t - INHALE) / 320))

/** Each piece's fall into the core: slow to start, then a rush; nearer pieces land first. */
function suck(t: number, seed: number, distance: number) {
  const [a = 0, b = 0, c = 0] = randoms(seed * 97 + 3, 3)
  const start = IMPLODE + a * 170
  const end = mix(5200, COLLAPSE - 20, clamp(distance / 760))
  const p = clamp((t - start) / (end - start))
  return { p, q: p ** 2.6, spin: (c < 0.5 ? -1 : 1) * mix(160, 420, b) }
}

type Pose = { sx: number; sy: number; z: number; rx?: number; ry?: number; rz?: number }
type From = { x?: number; y?: number; z?: number; rx?: number; ry?: number; rz?: number }

type Kind =
  | { kind: 'pdf'; name: string; meta: string; width?: number }
  | { kind: 'file'; name: string }
  | { kind: 'sheet'; sheet: number }
  | { kind: 'browser' }
  | { kind: 'call' }
  | { kind: 'chat' }
  | { kind: 'sticky'; text: string; tone?: 0 | 1 }
  | { kind: 'folder' }

/**
 * One prop of the pile. `sx`/`sy` is where it rests on screen before the camera pushes in,
 * `z` how deep; `land` is when it first touches that pose (its cue), `from` the offset it
 * arrives from.
 */
type Piece = Pose &
  Kind & {
    land: number
    from: From
    motion?: Motion
    /** Out of focus: pieces right in front of the lens. */
    soft?: number
    /** Drawn smaller or bigger than the prop's own size. */
    size?: number
    /** Knocked into a new pose later: the message, when the call window shoves it. */
    shove?: Pose & { at: number }
    /** A few frames of broken picture when it lands. */
    glitch?: boolean
  }

const VERSIONS = [
  { name: 'урок_12_ФІНАЛ.pdf', size: '2.1 MB' },
  { name: 'урок_12_ФІНАЛ(2).pdf', size: '2.1 MB' },
  { name: 'урок_12_ФІНАЛ_новий.pdf', size: '2.2 MB' },
  { name: 'урок_12_ФІНАЛ_точно.pdf', size: '2.3 MB' },
] as const
const VERSIONS_WIDTH = 470
const VERSION_ROW = 44
const VERSIONS_HEIGHT = 46 + 12 + VERSIONS.length * VERSION_ROW

const CALL_WIDTH = 520
const CALL_HEIGHT = 330

/**
 * The pile, in the order it lands. First the edges round the lock screen — the "final"
 * versions top left, files thrown in from the sides — then the call window shoves the
 * message aside, the browser crashes onto the bar, and the flood buries the clock. Late
 * arrivals keep coming while the line holds; two of them pop in right by it, on the beat.
 * Pieces that overlap on screen keep ≥ 70 px apart in depth, so none swaps places.
 */
const PIECES: readonly Piece[] = [
  // The message, under the clock like on a lock screen; shoved into the pile by the call.
  {
    kind: 'chat',
    sx: 540,
    sy: 900,
    z: 0,
    land: PING,
    motion: 'rise',
    from: { y: 170 },
    shove: { at: SHOVE, sx: 333, sy: 953, z: 0, ry: 10, rz: -3 },
  },

  // The edges, on eighths. The "final" folder lands early, so its joke gets read.
  {
    kind: 'pdf',
    name: 'урок_12_ФІНАЛ(3).pdf',
    meta: '2.2 MB',
    sx: 300,
    sy: 1080,
    z: -40,
    ry: 10,
    rz: -6,
    land: 1250,
    from: { x: -1100, y: 100, ry: 50, rz: -40 },
  },
  {
    kind: 'folder',
    sx: 316,
    sy: 272,
    z: 0,
    ry: 14,
    rz: -3,
    land: 1375,
    motion: 'heavy',
    from: { x: -900, y: -520, ry: 40, rz: -30 },
  },
  {
    kind: 'pdf',
    name: 'Present_Perfect_worksheet.pdf',
    meta: '1.4 MB',
    width: 388,
    sx: 790,
    sy: 226,
    z: -120,
    ry: -14,
    rz: 6,
    land: 1500,
    from: { x: 1100, y: -220, ry: -50, rz: 42 },
  },
  {
    kind: 'pdf',
    name: 'homework_B1_v7.pdf',
    meta: '860 KB',
    width: 344,
    sx: 850,
    sy: 330,
    z: -220,
    rz: -5,
    land: 1625,
    from: { x: 900, y: -300, rz: 34 },
  },
  {
    kind: 'pdf',
    name: 'B2_reading_answers.pdf',
    meta: '640 KB',
    sx: 640,
    sy: 160,
    z: -340,
    rz: 5,
    land: 1750,
    from: { y: -900, rz: 20 },
  },
  {
    kind: 'call',
    sx: 760,
    sy: 883,
    z: -60,
    ry: -16,
    rz: 2,
    size: 0.84,
    land: CALL,
    motion: 'heavy',
    from: { x: 1150, ry: -50, rz: 10 },
  },

  // The bar: the browser falls onto it, then sixteenths.
  {
    kind: 'browser',
    sx: 745,
    sy: 336,
    z: 40,
    rx: 8,
    rz: 2,
    size: 0.76,
    land: CRASH,
    motion: 'fall',
    glitch: true,
    from: { y: -900, rx: -40, rz: -10 },
  },
  {
    kind: 'file',
    name: 'speaking_cards_A2.pdf',
    sx: 112,
    sy: 452,
    z: -150,
    rz: -6,
    land: 2340,
    from: { x: -520, z: -1500 },
  },
  {
    kind: 'sticky',
    text: 'p. 47\n→ print ×6',
    tone: 1,
    sx: 470,
    sy: 1195,
    z: 60,
    rz: -7,
    land: 2420,
    from: { y: 700, rz: -60 },
  },
  {
    kind: 'pdf',
    name: 'vocab_unit5_print.pdf',
    meta: '3.1 MB',
    sx: 560,
    sy: 1250,
    z: -100,
    rz: 3,
    land: 2500,
    from: { y: 950, rz: -18 },
  },

  // The flood, 40–60 ms apart: the middle fills up and the clock goes under. The far-off
  // files come in now too, behind it, so none of them crosses behind the figures.
  {
    kind: 'sheet',
    sheet: 0,
    sx: 352,
    sy: 620,
    z: 130,
    rx: 6,
    ry: 12,
    rz: -11,
    land: 2813,
    motion: 'heavy',
    from: { z: 950, y: 120, rx: 30, rz: -30 },
  },
  {
    kind: 'pdf',
    name: 'reading_B2_old.pdf',
    meta: '1.9 MB',
    sx: 95,
    sy: 640,
    z: -900,
    rz: -4,
    land: 2820,
    from: { z: -2400 },
  },
  {
    kind: 'sheet',
    sheet: 1,
    sx: 742,
    sy: 500,
    z: 50,
    ry: -10,
    rz: 9,
    land: 2853,
    motion: 'heavy',
    from: { x: 900, y: -900, rz: 50 },
  },
  {
    kind: 'pdf',
    name: 'grammar_review_FINAL_v2.pdf',
    meta: '1.1 MB',
    width: 384,
    sx: 280,
    sy: 762,
    z: 230,
    rz: -5,
    land: 2856,
    from: { x: -1100, rz: -26 },
  },
  {
    kind: 'pdf',
    name: 'listening_A2.pdf',
    meta: '780 KB',
    sx: 560,
    sy: 1150,
    z: -1000,
    rz: 6,
    land: 2880,
    from: { z: -2600 },
  },
  {
    kind: 'file',
    name: 'Unit_12_test.pdf',
    sx: 1030,
    sy: 470,
    z: 520,
    rz: 12,
    soft: 4,
    land: 2896,
    from: { x: 300, z: 600, rz: 40 },
  },
  {
    kind: 'sticky',
    text: 'B1 — Unit 12\n???',
    sx: 650,
    sy: 372,
    z: 270,
    rz: 8,
    land: 2936,
    from: { z: 900, rz: 60 },
  },
  {
    kind: 'pdf',
    name: 'vocab_quiz_A2.pdf',
    meta: '410 KB',
    sx: 990,
    sy: 590,
    z: -950,
    rz: -5,
    land: 2950,
    from: { z: -2400 },
  },
  {
    kind: 'pdf',
    name: 'урок_13_чернетка.pdf',
    meta: '2.0 MB',
    sx: 392,
    sy: 470,
    z: 180,
    rz: 5,
    land: 2976,
    from: { x: -1100, rz: -30 },
  },
  {
    kind: 'sticky',
    text: 'ex. 3, 5, 7 !!',
    sx: 880,
    sy: 598,
    z: 210,
    rz: -8,
    land: 3016,
    from: { x: 900, y: -200, rz: -60 },
  },
  {
    kind: 'pdf',
    name: 'урок_12_ФІНАЛ(5).pdf',
    meta: '2.4 MB',
    sx: 30,
    sy: 760,
    z: 480,
    rz: -10,
    soft: 3.5,
    land: 3056,
    from: { x: -400, z: 500, rz: -30 },
  },
  {
    kind: 'sheet',
    sheet: 2,
    sx: 588,
    sy: 540,
    z: 0,
    rz: 3,
    land: 3133,
    motion: 'heavy',
    from: { y: -1100, rz: -24 },
  },
  {
    kind: 'pdf',
    name: 'speaking_cards_A2 (2).pdf',
    meta: '1.2 MB',
    sx: 270,
    sy: 606,
    z: 320,
    rz: -6,
    land: 3176,
    from: { x: -1000, y: 200, rz: -24 },
  },
  {
    kind: 'pdf',
    name: 'Present_Perfect_answers.pdf',
    meta: '380 KB',
    sx: 640,
    sy: 690,
    z: 360,
    rz: 4,
    land: 3216,
    from: { x: 700, y: 800, rz: 28 },
  },
  {
    kind: 'file',
    name: 'scan_0047.pdf',
    sx: 520,
    sy: 300,
    z: 300,
    rz: -5,
    land: 3276,
    from: { y: -900, z: 300 },
  },

  // Still coming while the line holds: at the edges, and two pops right by the line.
  {
    kind: 'pdf',
    name: 'listening_tapescript.pdf',
    meta: '540 KB',
    sx: 120,
    sy: 690,
    z: -200,
    rz: -9,
    land: 3466,
    from: { x: -900 },
  },
  {
    kind: 'sticky',
    text: 'print ×12\n!!!',
    sx: 20,
    sy: 640,
    z: 400,
    rz: -14,
    soft: 2.5,
    land: 3591,
    from: { x: -700, z: 400, rz: -50 },
  },
  {
    kind: 'pdf',
    name: 'irregular_verbs_list.pdf',
    meta: '320 KB',
    sx: 420,
    sy: 480,
    z: 260,
    rz: -4,
    land: 3500,
    motion: 'pop',
    from: { z: 140 },
  },
  {
    kind: 'file',
    name: 'grammar_test_B2.pdf',
    sx: 1010,
    sy: 380,
    z: 300,
    rz: 8,
    soft: 2,
    land: 3841,
    from: { x: 700, z: 500, rz: 30 },
  },
  {
    kind: 'file',
    name: 'Olya_essay_check.pdf',
    sx: 470,
    sy: 1215,
    z: -60,
    rz: -4,
    land: 3966,
    from: { y: 800 },
  },
  {
    kind: 'pdf',
    name: 'homework_A2_v3.pdf',
    meta: '900 KB',
    sx: 772,
    sy: 446,
    z: 350,
    rz: 5,
    land: 4000,
    motion: 'pop',
    from: { z: 140 },
  },
  {
    kind: 'pdf',
    name: 'урок_14_чернетка(2).pdf',
    meta: '1.7 MB',
    sx: 330,
    sy: 250,
    z: 120,
    rz: -6,
    land: 4341,
    from: { y: -800, z: 300, rz: -20 },
  },
]

function sizeOf(piece: Piece): { width: number; height: number } {
  switch (piece.kind) {
    case 'pdf':
      return { width: piece.width ?? 360, height: 86 }
    case 'file':
      return { width: 150, height: 134 }
    case 'sheet':
      return { width: 300, height: 414 }
    case 'browser':
      return { width: 660, height: 440 }
    case 'call':
      return { width: CALL_WIDTH, height: CALL_HEIGHT }
    case 'chat':
      return { width: 470, height: 184 }
    case 'sticky':
      return { width: 178, height: 178 }
    case 'folder':
      return { width: VERSIONS_WIDTH, height: VERSIONS_HEIGHT }
  }
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

/** "Неділя, 23:47" → the day, and the time as digits we can flip. */
function splitTime(text: string): { day: string; hours: string; minutes: string } | null {
  const match = /^(.*?)[\s,]*(\d{1,2}):(\d{2})\s*$/.exec(text)
  if (!match) return null
  return { day: (match[1] ?? '').trim(), hours: match[2] ?? '', minutes: match[3] ?? '' }
}

const INK_TEXT = '#1c1917'
const MUTED = '#78716c'
const HAIRLINE = '#e7e2dd'
const LIGHT_COLORS = ['#ff5f57', '#febc2e', '#28c840'] as const
/** One soft deep shadow and a hairline, the same lift as the other props. */
const LIFT =
  '0 30px 54px -18px rgb(0 0 0 / 0.66), 0 10px 20px -12px rgb(0 0 0 / 0.45), 0 0 0 1px rgb(0 0 0 / 0.05)'

function Lights() {
  return (
    <div style={{ display: 'flex', gap: 6, flex: 'none' }}>
      {LIGHT_COLORS.map((color) => (
        <span key={color} style={{ width: 10, height: 10, borderRadius: 99, background: color }} />
      ))}
    </div>
  )
}

/** The folder where "final" keeps getting a new name — set big enough to read in a beat. */
function Versions({ path }: { path: string }) {
  return (
    <div
      style={{
        width: VERSIONS_WIDTH,
        height: VERSIONS_HEIGHT,
        borderRadius: 16,
        overflow: 'hidden',
        background: 'linear-gradient(165deg, #ffffff 0%, #fbf8f6 60%, #f3efeb 100%)',
        color: INK_TEXT,
        boxShadow: LIFT,
      }}
    >
      <div
        style={{
          height: 46,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '0 16px',
          background: '#f5f3f1',
          borderBottom: `1px solid ${HAIRLINE}`,
        }}
      >
        <Lights />
        <span style={{ fontSize: 15, color: '#57534e', fontWeight: 560, whiteSpace: 'nowrap' }}>
          {path}
        </span>
      </div>
      <div style={{ padding: '6px 8px' }}>
        {VERSIONS.map((file, index) => (
          <div
            key={file.name}
            style={{
              height: VERSION_ROW,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '0 12px',
              borderRadius: 10,
              background: index === VERSIONS.length - 1 ? '#fde8e6' : undefined,
            }}
          >
            <span
              style={{
                width: 18,
                height: 23,
                borderRadius: 3,
                flex: 'none',
                background: '#fff',
                border: '1.5px solid #d6d0ca',
                borderBottom: `6px solid ${PDF_RED}`,
              }}
            />
            <span
              style={{
                flex: 1,
                fontSize: 20,
                fontWeight: 580,
                letterSpacing: '-0.012em',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {file.name}
            </span>
            <span style={{ fontSize: 14, color: MUTED, fontVariantNumeric: 'tabular-nums' }}>
              {file.size}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

type Person = { initials: string; name: string; color: string }

/** The call everybody knows, stuck on screen sharing — its banner set big enough to read. */
function ShareCall({ label, people }: { label: string; people: readonly Person[] }) {
  return (
    <div
      style={{
        position: 'relative',
        width: CALL_WIDTH,
        height: CALL_HEIGHT,
        borderRadius: 18,
        overflow: 'hidden',
        background: '#17161a',
        boxShadow: `${LIFT}, inset 0 0 0 1px rgb(255 255 255 / 0.08)`,
      }}
    >
      <div
        style={{
          height: 30,
          display: 'flex',
          alignItems: 'center',
          padding: '0 13px',
          background: '#222125',
        }}
      >
        <Lights />
      </div>
      {/* The shared screen, framed in green the way sharing apps frame it. */}
      <div
        style={{
          position: 'absolute',
          left: 12,
          top: 42,
          width: 356,
          height: 226,
          borderRadius: 10,
          border: '3px solid #22c55e',
          background: '#3b3a3f',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 94,
            top: 66,
            width: 168,
            height: 190,
            padding: '14px 14px 0',
            background: '#fff',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 720, color: INK_TEXT }}>Present Perfect</div>
          {[92, 100, 80, 0, 96, 88, 100].map((size, index) =>
            size === 0 ? (
              <div key={index} style={{ height: 8 }} />
            ) : (
              <div
                key={index}
                style={{
                  marginTop: 7,
                  height: 4,
                  width: `${size}%`,
                  borderRadius: 2,
                  background: '#e5e1dd',
                }}
              />
            ),
          )}
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          right: 12,
          top: 42,
          display: 'flex',
          flexDirection: 'column',
          gap: 7,
        }}
      >
        {people.map((person) => (
          <div
            key={person.initials}
            style={{
              position: 'relative',
              width: 128,
              height: 70,
              borderRadius: 10,
              display: 'grid',
              placeItems: 'center',
              background: '#29282d',
            }}
          >
            <span
              style={{
                width: 34,
                height: 34,
                borderRadius: 99,
                display: 'grid',
                placeItems: 'center',
                background: person.color,
                color: '#fff',
                fontSize: 13,
                fontWeight: 650,
              }}
            >
              {person.initials}
            </span>
            <span
              style={{
                position: 'absolute',
                left: 8,
                bottom: 5,
                fontSize: 11,
                color: 'rgb(255 255 255 / 0.75)',
              }}
            >
              {person.name}
            </span>
          </div>
        ))}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 52,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          color: '#e7e5e4',
        }}
      >
        {[MicOffIcon, VideoIcon, ScreenShareIcon].map((Icon, index) => (
          <span
            key={index}
            style={{
              width: 34,
              height: 34,
              borderRadius: 99,
              display: 'grid',
              placeItems: 'center',
              background: index === 2 ? '#16a34a' : '#2f2e33',
            }}
          >
            <Icon style={{ width: 16, height: 16 }} strokeWidth={2} />
          </span>
        ))}
        <span
          style={{
            width: 54,
            height: 34,
            borderRadius: 99,
            display: 'grid',
            placeItems: 'center',
            background: '#ef4444',
          }}
        >
          <PhoneOffIcon style={{ width: 16, height: 16 }} strokeWidth={2} />
        </span>
      </div>
      {/* "Screen sharing" + stop: the floating bar every sharing app puts on top. */}
      <div
        data-probe="call-pill"
        style={{
          position: 'absolute',
          left: 22,
          top: 54,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          whiteSpace: 'nowrap',
        }}
      >
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            height: 44,
            padding: '0 18px 0 14px',
            borderRadius: 99,
            background: '#16a34a',
            color: '#fff',
            fontSize: 21,
            fontWeight: 620,
            letterSpacing: '-0.01em',
            boxShadow: '0 8px 18px rgb(0 0 0 / 0.4)',
          }}
        >
          <ScreenShareIcon style={{ width: 21, height: 21, flex: 'none' }} strokeWidth={2.2} />
          {label}
        </span>
        <span
          style={{
            display: 'grid',
            placeItems: 'center',
            width: 54,
            height: 44,
            borderRadius: 99,
            background: '#ef4444',
            boxShadow: '0 8px 18px rgb(0 0 0 / 0.4)',
          }}
        >
          <span style={{ width: 14, height: 14, borderRadius: 3, background: '#fff' }} />
        </span>
      </div>
    </div>
  )
}

function Content({ piece, copy }: { piece: Piece; copy: FilmCopy }) {
  switch (piece.kind) {
    case 'pdf':
      return <PdfChip name={piece.name} meta={piece.meta} width={piece.width} />
    case 'file':
      return <DesktopFile name={piece.name} />
    case 'sheet':
      return <Worksheet sheet={SHEETS[piece.sheet] ?? SHEETS[0]!} />
    case 'browser':
      return (
        <TabBrowser title="урок_12_ФІНАЛ(3).pdf" url="file:///D:/Уроки/B1/урок_12_ФІНАЛ(3).pdf" />
      )
    case 'call': {
      const people: Person[] = [
        { initials: initials(copy.people.olya), name: copy.people.olyaShort, color: '#0ea5e9' },
        { initials: initials(copy.people.maksym), name: copy.people.maksymShort, color: '#a855f7' },
        {
          initials: initials(copy.people.iryna),
          name: copy.people.iryna.split(' ')[0] ?? '',
          color: '#78716c',
        },
      ]
      return <ShareCall label={copy.film.problem.shareScreen} people={people} />
    }
    case 'chat':
      return (
        <ChatCard
          name={copy.people.olya}
          initials={initials(copy.people.olya)}
          message={copy.film.problem.chat}
          time="23:47"
          unread={3}
        />
      )
    case 'sticky':
      return <Sticky text={piece.text} tone={piece.tone} />
    case 'folder':
      return <Versions path="D:\Уроки\B1" />
  }
}

/**
 * A torn picture for a few frames: slices of the prop thrown sideways, and bright scan
 * lines. New tears every frame, from a seed, so any frame stands alone.
 */
function Tears({ t, height, children }: { t: number; height: number; children: ReactNode }) {
  const frame = frameOf(t)
  return (
    <>
      {[0, 1, 2].map((band) => {
        const [a = 0, b = 0, c = 0, d = 0] = randoms(frame * 131 + band * 17 + 5, 4)
        const top = Math.round(a * (height - 70))
        const tall = Math.round(mix(12, 64, b))
        const shift = (d < 0.5 ? -1 : 1) * mix(16, 42, c)
        return (
          <div
            key={band}
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              clipPath: `inset(${top}px 0 ${Math.max(0, height - top - tall)}px 0)`,
              transform: `translateX(${shift.toFixed(1)}px)`,
              filter: band === 1 ? 'hue-rotate(160deg) saturate(2.4)' : undefined,
            }}
          >
            {children}
          </div>
        )
      })}
      {[0, 1].map((line) => {
        const [a = 0, b = 0] = randoms(frame * 71 + line * 13 + 9, 2)
        return (
          <span
            key={`line${line}`}
            aria-hidden
            style={{
              position: 'absolute',
              left: -30,
              right: -30,
              top: Math.round(a * height),
              height: b > 0.5 ? 3 : 2,
              background: 'rgb(255 255 255 / 0.85)',
              mixBlendMode: 'screen',
            }}
          />
        )
      })}
    </>
  )
}

const fullPose = (pose: Pose): Required<Pose> => ({
  sx: pose.sx,
  sy: pose.sy,
  z: pose.z,
  rx: pose.rx ?? 0,
  ry: pose.ry ?? 0,
  rz: pose.rz ?? 0,
})

/** One prop of the pile: arrives, lands with weight, drifts, then falls into the core. */
function PileItem({
  piece,
  index,
  t,
  copy,
}: {
  piece: Piece
  index: number
  t: number
  copy: FilmCopy
}) {
  const motion = piece.motion ?? 'light'
  const start = piece.land - LEAD[motion]
  if (t < start) return null
  const { width, height } = sizeOf(piece)
  const from = piece.from
  const elapsed = t - start
  const k = travel(elapsed, motion)
  const left = 1 - k
  // Depth never overshoots: a piece that springs past its plane would swap places with its
  // neighbours for a frame.
  const deep = 1 - Math.min(k, 1)
  const distance = Math.hypot(from.x ?? 0, from.y ?? 0, (from.z ?? 0) * 0.6)
  let speed = Math.abs(k - travel(elapsed - 33, motion)) * distance

  // Its pose: its own, or on the way to the one it gets shoved into.
  let pose = fullPose(piece)
  if (piece.shove && t > piece.shove.at) {
    const target = fullPose(piece.shove)
    const s = fling(t - piece.shove.at, 170, 20, 8)
    const sd = Math.min(s, 1)
    pose = {
      sx: mix(pose.sx, target.sx, s),
      sy: mix(pose.sy, target.sy, s),
      z: mix(pose.z, target.z, sd),
      rx: mix(pose.rx, target.rx, s),
      ry: mix(pose.ry, target.ry, s),
      rz: mix(pose.rz, target.rz, s),
    }
    const moved = Math.hypot(target.sx - piece.sx, target.sy - piece.sy)
    speed = Math.max(speed, Math.abs(s - fling(t - piece.shove.at - 33, 170, 20, 8)) * moved)
  }

  // The rest pose, in world px: placed so it lands where it was composed on screen.
  const depthScale = (DEPTH - pose.z) / DEPTH
  const restX = CORE.x + (pose.sx - CORE.x) * depthScale
  const restY = CORE.y + (pose.sy - CORE.y) * depthScale

  const [r1 = 0, r2 = 0, r3 = 0, r4 = 0, r5 = 0, r6 = 0, r7 = 0] = randoms(500 + index * 13, 7)
  const s = t / 1000
  const driftX = Math.sin(s * mix(0.5, 0.9, r1) + r2 * 6) * 8
  const driftY = Math.cos(s * mix(0.4, 0.8, r3) + r4 * 6) * 7
  const driftR = Math.sin(s * mix(0.3, 0.7, r5) + r6 * 6) * 1.2
  // A little float in depth too — small, so neighbours never swap places.
  const driftZ = Math.sin(s * mix(0.6, 1.1, r7) + r1 * 6) * 9

  let z = pose.z + (from.z ?? 0) * deep + driftZ
  const rx = pose.rx + (from.rx ?? 0) * left
  const ry = pose.ry + (from.ry ?? 0) * left
  let rz = pose.rz + (from.rz ?? 0) * left + driftR
  let scale = piece.size ?? 1
  let blur = Math.max(piece.soft ?? 0, clamp(speed * 0.045 - 0.4, 0, 12))
  let opacity = 1
  let flash = 0

  if (motion === 'rise') {
    // The message comes up into place the way a notification does: out of a soft blur.
    scale *= mix(0.92, 1, k)
    opacity = clamp(k * 2.4)
    blur = Math.max(blur, (1 - k) * 10)
  } else if (motion === 'pop') {
    // Pops in place: overshoots a touch, with a flash of light.
    scale *=
      elapsed < 0
        ? 0
        : interpolate(elapsed, [0, 150, 330], [0.45, 1.1, 1], [ease.outCubic, ease.inOutCubic])
    opacity = clamp(elapsed / 60)
    flash = 1 - progress(elapsed, 40, 280, ease.outCubic)
  }

  // Breathe out, then fall into the core on a spiral.
  const grow = inhale(t)
  let dx = (restX + (from.x ?? 0) * left + driftX - CORE.x) * grow
  let dy = (restY + (from.y ?? 0) * left + driftY - CORE.y) * grow
  const fall = suck(t, index + 1, Math.hypot(dx, dy))
  if (fall.p >= 1) return null
  if (fall.p > 0) {
    const turn = 1.5 * fall.q ** 1.4
    const cos = Math.cos(turn)
    const sin = Math.sin(turn)
    const shrink = 1 - fall.q
    ;[dx, dy] = [(dx * cos - dy * sin) * shrink, (dx * sin + dy * cos) * shrink]
    z = mix(z, -150, fall.q)
    rz += fall.spin * fall.q ** 2
    scale *= mix(1, 0.03, fall.q ** 0.85)
    blur = Math.max(blur, fall.p > 0.08 ? 1 + 13 * fall.q : 0)
    opacity *= 1 - clamp((fall.q - 0.82) / 0.18)
  }

  const glitching = piece.glitch === true && t >= piece.land && t < piece.land + 100

  // Depth fog: the far end of the pile sinks into the dark.
  const fog = clamp((-pose.z - 60) / 1100, 0, 0.55)
  const filters = [
    blur > 0.25 ? `blur(${blur.toFixed(2)}px)` : '',
    fog > 0.01 ? `brightness(${(1 - fog).toFixed(3)})` : '',
    flash > 0.01 ? `brightness(${(1 + 0.45 * flash).toFixed(3)})` : '',
    glitching
      ? 'drop-shadow(-9px 0 0 rgb(0 225 255 / 0.6)) drop-shadow(9px 0 0 rgb(255 30 90 / 0.6))'
      : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      data-probe={`${index}:${piece.kind}${'name' in piece ? `:${piece.name}` : 'text' in piece ? `:${piece.text.split('\n')[0]}` : ''}`}
      data-z={z.toFixed(0)}
      style={{
        position: 'absolute',
        left: CORE.x + dx - width / 2,
        top: CORE.y + dy - height / 2,
        width,
        height,
        opacity,
        transform: `translate3d(0px, 0px, ${z.toFixed(2)}px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) rotateZ(${rz.toFixed(2)}deg) scale(${scale.toFixed(4)})`,
        filter: filters || undefined,
        backfaceVisibility: 'hidden',
      }}
    >
      <Content piece={piece} copy={copy} />
      {glitching ? (
        <Tears t={t} height={height}>
          <Content piece={piece} copy={copy} />
        </Tears>
      ) : null}
    </div>
  )
}

/**
 * One digit of the clock that can roll to the next one, odometer-style: `roll` runs 0 → 1
 * (a little past 1 while it lands), `done` once it has settled.
 */
function Digit({
  from,
  to,
  roll,
  done,
}: {
  from: string
  to: string
  roll: number
  done: boolean
}) {
  const box: CSSProperties = {
    display: 'inline-block',
    height: '1em',
    lineHeight: 1,
    verticalAlign: 'top',
  }
  if (from === to || roll <= 0.0005) return <span style={box}>{from}</span>
  if (done) return <span style={box}>{to}</span>
  const blur = Math.sin(Math.PI * clamp(roll)) * 7
  // The column is two digits tall, so half its height is one digit. The window is clipped
  // to the figures' own height, so nothing pokes above or below the line while it rolls.
  return (
    <span style={{ ...box, position: 'relative', clipPath: 'inset(0.09em -0.1em 0.075em -0.1em)' }}>
      <span
        style={{
          display: 'block',
          transform: `translateY(${(-roll * 50).toFixed(3)}%)`,
          filter: blur > 0.2 ? `blur(${blur.toFixed(2)}px)` : undefined,
        }}
      >
        <span style={{ display: 'block', height: '1em' }}>{from}</span>
        <span style={{ display: 'block', height: '1em' }}>{to}</span>
      </span>
    </span>
  )
}

const CLOCK_TOP = 392
const CLOCK_WIDTH = 1040

/**
 * "Неділя" over a giant 23:47 — a lock screen late on a Sunday. The day falls onto the
 * downbeat and lands with a little give and a bloom; the time falls out of the camera onto
 * the glass and hits on the next beat. Lives in the pile's world, so the pile can bury it;
 * once buried it fades, so it never shows through the collapse.
 */
function Clock({ text, t }: { text: string; t: number }) {
  if (t < -DAY_FALL) return null
  const buried = progress(t, 2950, 380, ease.inOutCubic)
  if (buried >= 1) return null
  const parts = splitTime(text)

  // The day: accelerating down onto the beat, then a short give, a squash and a bloom.
  const fall = clamp((t + DAY_FALL) / DAY_FALL)
  const dayY =
    t < 0
      ? -64 * (1 - fall * fall)
      : interpolate(t, [0, 70, 260], [0, 4, 0], [ease.outCubic, ease.inOutCubic])
  const give = t < 0 ? 0 : interpolate(t, [0, 50, 240], [0, 1, 0], [ease.outCubic, ease.inOutCubic])
  const bloom = t < 0 ? 0 : 1 - progress(t, 0, 620, ease.outCubic)
  const dayBlur = t < 0 ? 9 * (1 - fall) : 0

  // The time drops along z, accelerating, sharp only at the hit; a little squash after.
  const drop = clamp((t - DROP) / (SLAM - DROP))
  const dropZ = 860 * (1 - drop * drop)
  const dropBlur = t < SLAM ? 16 * (1 - drop ** 3) : 0
  const squash = Math.sin(Math.PI * clamp((t - SLAM) / 200)) * 0.03
  const flare = progress(t, SLAM - 20, 680, ease.outCubic)
  const hit = t < SLAM ? 0 : 1 - progress(t, SLAM, 560, ease.outCubic)

  const flip = fling(t - FLIP, 260, 24, 10)
  const flipped = t > FLIP + 420
  const blink =
    t < FLIP
      ? 1
      : interpolate(
          (((t - FLIP) % 1000) + 1000) % 1000,
          [0, 440, 520, 920, 1000],
          [1, 1, 0.42, 0.42, 1],
        )
  const hours = parts?.hours ?? ''
  const minutes = parts?.minutes ?? ''
  const nextMinute = String((Number(minutes) + 1) % 60).padStart(2, '0')

  return (
    <div
      style={{
        position: 'absolute',
        left: CORE.x - CLOCK_WIDTH / 2,
        top: CLOCK_TOP,
        width: CLOCK_WIDTH,
        height: 420,
        transformStyle: 'preserve-3d',
        opacity: 1 - buried,
        filter: buried > 0.02 ? `blur(${(buried * 8).toFixed(2)}px)` : undefined,
        textAlign: 'center',
        color: 'white',
      }}
    >
      <div
        data-probe="clock-day"
        style={{
          fontSize: 96,
          fontWeight: 600,
          letterSpacing: '-0.025em',
          lineHeight: 1.1,
          color: `rgb(255 255 255 / ${mix(0.86, 1, bloom).toFixed(3)})`,
          opacity: clamp(fall * 1.7),
          transform: `translateY(${dayY.toFixed(2)}px) scale(${(1 + 0.012 * give).toFixed(4)}, ${(1 - 0.03 * give).toFixed(4)})`,
          transformOrigin: '50% 100%',
          filter: dayBlur > 0.2 ? `blur(${dayBlur.toFixed(2)}px)` : undefined,
          textShadow:
            bloom > 0.01
              ? `0 0 ${(20 + 52 * bloom).toFixed(1)}px rgb(255 196 160 / ${(0.12 + 0.68 * bloom).toFixed(3)})`
              : '0 0 20px rgb(255 196 160 / 0.12)',
        }}
      >
        {parts?.day ?? text}
      </div>
      {parts && t >= DROP ? (
        <div
          data-probe="clock-time"
          style={{
            position: 'relative',
            marginTop: -12,
            fontSize: 300,
            fontWeight: 640,
            letterSpacing: '-0.05em',
            lineHeight: 1,
            fontFeatureSettings: '"tnum" 1, "case" 1',
            whiteSpace: 'nowrap',
            opacity: clamp((t - DROP) / 70),
            transform: `translate3d(0px, 0px, ${dropZ.toFixed(2)}px) scale(${(1 - squash).toFixed(4)})`,
            filter: dropBlur > 0.2 ? `blur(${dropBlur.toFixed(2)}px)` : undefined,
            textShadow: `0 0 ${mix(90, 60, flare).toFixed(1)}px rgb(255 120 40 / ${mix(0.55, 0.2, flare).toFixed(3)})`,
          }}
        >
          {/* The light of the hit, behind the figures. */}
          {hit > 0.01 ? (
            <span
              aria-hidden
              style={{
                position: 'absolute',
                zIndex: -1,
                left: CLOCK_WIDTH / 2 - 520,
                top: '50%',
                width: 1040,
                height: 440,
                marginTop: -220,
                borderRadius: '50%',
                background:
                  'radial-gradient(closest-side, rgb(255 178 130 / 0.62), rgb(255 79 1 / 0.22) 55%, rgb(255 79 1 / 0) 100%)',
                opacity: hit,
                transform: `scale(${mix(1.2, 0.75, hit).toFixed(4)})`,
              }}
            />
          ) : null}
          {[...hours].map((digit, index) => (
            <Digit key={`h${index}`} from={digit} to={digit} roll={0} done />
          ))}
          <span
            style={{
              display: 'inline-block',
              height: '1em',
              lineHeight: 1,
              verticalAlign: 'top',
              opacity: blink,
              margin: '0 0.05em 0 0.01em',
            }}
          >
            :
          </span>
          {[...minutes].map((digit, index) => (
            <Digit
              key={`m${index}`}
              from={digit}
              to={nextMinute[index] ?? digit}
              roll={flip}
              done={flipped}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

/** The pile's world: one perspective, one camera, everything at its depth. */
function World({ t, copy, children }: { t: number; copy: FilmCopy; children?: ReactNode }) {
  const cam = camera(t)
  // Depth of field on the pile, all in before the line's first word lands.
  const focus = interpolate(t, [2600, HOLD, 4420, 4700], [0, 1.8, 1.8, 0], ease.inOutCubic)

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        filter: focus > 0.05 ? `blur(${focus.toFixed(2)}px)` : undefined,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          perspective: DEPTH,
          perspectiveOrigin: `${CORE.x}px ${CORE.y}px`,
          transformStyle: 'preserve-3d',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            transformStyle: 'preserve-3d',
            transformOrigin: `${CORE.x}px ${CORE.y}px`,
            transform: `translate3d(${cam.x.toFixed(2)}px, ${cam.y.toFixed(2)}px, ${cam.z.toFixed(2)}px) rotateZ(${cam.roll.toFixed(3)}deg) rotateX(${cam.tiltX.toFixed(3)}deg) rotateY(${cam.tiltY.toFixed(3)}deg)`,
          }}
        >
          {children}
          {PIECES.map((piece, index) => (
            <PileItem key={index} piece={piece} index={index} t={t} copy={copy} />
          ))}
        </div>
      </div>
    </div>
  )
}

const COUNT_AT = [1250, 2000, 2600, 3200, 4300] as const
const COUNT_TO = [1, 6, 15, 29, 37] as const

/** When the running count passed `value` (the moment a digit changed). */
function countedAt(value: number): number {
  for (let index = 0; index < COUNT_TO.length - 1; index++) {
    const low = COUNT_TO[index]!
    const high = COUNT_TO[index + 1]!
    if (value >= low && value <= high)
      return mix(COUNT_AT[index]!, COUNT_AT[index + 1]!, (value - low) / (high - low))
  }
  return COUNT_AT[0]
}

/** Where the counter sits: the bottom-right corner, which the HUD leaves empty in this shot. */
const COUNTER = { x: 660, y: 1076, width: 330, height: 112 }

/** "PDF × 37": the count of the evening, like a tab counter. */
function Counter({ t }: { t: number }) {
  const at = COUNT_AT[0]
  if (t < at) return null
  const fall = progress(t, 4820, 560, ease.inCubic)
  if (fall >= 1) return null

  const pop = fling(t - at, 260, 22, 7)
  const count = Math.round(interpolate(t, COUNT_AT, COUNT_TO))
  const bump = count > 1 ? 0.08 * (1 - clamp((t - countedAt(count - 0.5)) / 160)) : 0

  const tx = (CORE.x - (COUNTER.x + COUNTER.width / 2)) * fall
  const ty = (CORE.y - (COUNTER.y + COUNTER.height / 2)) * fall
  const scale = mix(0.7, 1, Math.min(pop, 1.04)) * mix(1, 0.04, fall)

  return (
    <div
      data-probe="counter"
      style={{
        position: 'absolute',
        left: COUNTER.x,
        top: COUNTER.y,
        width: COUNTER.width,
        height: COUNTER.height,
        display: 'flex',
        alignItems: 'center',
        gap: 18,
        padding: '0 26px 0 22px',
        borderRadius: 30,
        background: 'rgb(17 14 13 / 0.86)',
        boxShadow: '0 24px 50px -16px rgb(0 0 0 / 0.7), inset 0 0 0 1px rgb(255 255 255 / 0.09)',
        opacity: clamp(pop * 3) * (1 - clamp((fall - 0.8) / 0.2)),
        transform: `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px) rotate(${(fall * 160).toFixed(2)}deg) scale(${scale.toFixed(4)})`,
        transformOrigin: 'center',
        filter: fall > 0.05 ? `blur(${(fall * 10).toFixed(2)}px)` : undefined,
      }}
    >
      <PdfBadge height={58} />
      <span
        style={{ fontSize: 46, fontWeight: 500, color: 'rgb(255 255 255 / 0.55)', lineHeight: 1 }}
      >
        ×
      </span>
      <span
        style={{
          display: 'inline-block',
          minWidth: 104,
          fontSize: 92,
          fontWeight: 660,
          letterSpacing: '-0.045em',
          lineHeight: 1,
          color: 'white',
          fontVariantNumeric: 'tabular-nums',
          transform: `scale(${(1 + bump).toFixed(4)})`,
          transformOrigin: 'left center',
        }}
      >
        {count}
      </span>
    </div>
  )
}

/** The line, over the pile: word by word, "знову" swept in brand colour, then sucked in. */
function Line({ text, t }: { text: string; t: number }) {
  if (t < LINE - 50) return null
  const fall = progress(t, RELEASE, COLLAPSE - RELEASE, (x) => x ** 2.2)
  if (fall >= 1) return null

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        transformOrigin: `${CORE.x}px ${CORE.y}px`,
        transform:
          fall > 0
            ? `rotate(${(-46 * fall).toFixed(2)}deg) scale(${mix(1, 0.02, fall).toFixed(4)})`
            : undefined,
        filter: fall > 0.04 ? `blur(${(fall * 12).toFixed(2)}px)` : undefined,
        opacity: 1 - clamp((fall - 0.8) / 0.2),
      }}
    >
      <div
        data-probe="line"
        style={{
          position: 'absolute',
          left: 90,
          width: 900,
          top: CORE.y - 20,
          transform: 'translateY(-50%)',
          textAlign: 'center',
          fontSize: 104,
          fontWeight: 680,
          letterSpacing: '-0.042em',
          lineHeight: 1.04,
          color: 'white',
          textWrap: 'balance',
          textShadow: '0 6px 40px rgb(0 0 0 / 0.55)',
        }}
      >
        <KineticText
          text={text}
          at={LINE}
          stagger={110}
          duration={560}
          from={{ y: 70, blur: 14, opacity: 0, scale: 1.04 }}
          marker
        />
      </div>
    </div>
  )
}

/** Light streaks pulled into the core while the pile collapses — behind the line. */
function Streaks({ t }: { t: number }) {
  if (t < IMPLODE || t > COLLAPSE + 60) return null
  return (
    <>
      {Array.from({ length: 34 }, (_, index) => {
        const [a = 0, r = 0, l = 0, s = 0, d = 0, w = 0] = randoms(9100 + index * 7, 6)
        const start = IMPLODE + 80 + s * 700
        const life = mix(240, 420, d)
        const p = (t - start) / life
        if (p <= 0 || p >= 1) return null
        const radius = mix(860, 30, ease.inCubic(p)) * mix(0.7, 1.15, r)
        const length = mix(70, 280, l) * (0.35 + p)
        return (
          <span
            key={index}
            aria-hidden
            style={{
              position: 'absolute',
              left: CORE.x,
              top: CORE.y,
              width: length,
              height: w > 0.7 ? 3 : 2,
              borderRadius: 2,
              transformOrigin: '0 50%',
              transform: `rotate(${(a * 360).toFixed(2)}deg) translateX(${radius.toFixed(2)}px)`,
              background: 'linear-gradient(90deg, rgb(255 240 228 / 0.95), rgb(255 120 40 / 0))',
              opacity: Math.sin(Math.PI * p),
            }}
          />
        )
      })}
    </>
  )
}

/** The core's first glow: an ember of brand light behind the words while they still hold. */
function Ember({ t }: { t: number }) {
  if (t < IMPLODE + 40 || t >= BLAST) return null
  const swell = interpolate(
    t,
    [IMPLODE + 40, 5000, PINCH],
    [0, 62, 140],
    [ease.outCubic, ease.inOutCubic],
  )
  const flicker = 1 + 0.08 * Math.sin(t * 0.11) * Math.sin(t * 0.037)
  const halo = swell * flicker * interpolate(t, [PINCH, BLAST], [1, 0.7])
  const heat = interpolate(t, [IMPLODE, RELEASE, PINCH], [0.45, 0.8, 1])
  if (halo < 1) return null
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        left: CORE.x - halo * 3,
        top: CORE.y - halo * 3,
        width: halo * 6,
        height: halo * 6,
        borderRadius: '50%',
        background: `radial-gradient(circle, rgb(255 132 60 / ${(0.55 * heat).toFixed(3)}) 0%, rgb(255 79 1 / ${(0.24 * heat).toFixed(3)}) 30%, rgb(255 79 1 / 0) 70%)`,
      }}
    />
  )
}

/**
 * The white-hot point everything falls into, over everything once the line has let go: it
 * swells as the pile pours in and pinches to a needle of light.
 */
function Core({ t }: { t: number }) {
  if (t < RELEASE || t >= WHITE) return null

  const appear = progress(t, RELEASE, 160, ease.outCubic)
  const swell = interpolate(t, [RELEASE, PINCH], [40, 140], ease.inOutCubic)
  const pinch = interpolate(t, [PINCH, BLAST], [1, 0.3], ease.inCubic)
  const flicker = 1 + 0.08 * Math.sin(t * 0.11) * Math.sin(t * 0.037)
  const r = swell * pinch * flicker * mix(0.6, 1, appear)
  const hot = interpolate(t, [RELEASE, 5200, PINCH], [0.7, 0.9, 1]) * appear
  const glint = interpolate(t, [RELEASE, PINCH, BLAST], [0, 0.55, 1], ease.inCubic)

  return (
    <>
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: CORE.x - r,
          top: CORE.y - r,
          width: r * 2,
          height: r * 2,
          borderRadius: '50%',
          background: `radial-gradient(circle, #ffffff 0%, #ffffff 18%, ${FLASH_WHITE} 26%, rgb(255 196 150 / 0.8) 40%, rgb(255 120 40 / 0) 70%)`,
          opacity: hot,
        }}
      />
      {/* A needle of light through the core: the lens catching it. */}
      {glint > 0.01 ? (
        <>
          <div
            aria-hidden
            style={{
              position: 'absolute',
              left: CORE.x - mix(120, 760, glint),
              top: CORE.y - 2,
              width: mix(240, 1520, glint),
              height: 4,
              borderRadius: 4,
              background:
                'linear-gradient(90deg, rgb(255 120 40 / 0), rgb(255 200 160 / 0.9) 35%, #ffffff 50%, rgb(255 200 160 / 0.9) 65%, rgb(255 120 40 / 0))',
              opacity: glint,
            }}
          />
          <div
            aria-hidden
            style={{
              position: 'absolute',
              left: CORE.x - 1.5,
              top: CORE.y - mix(60, 300, glint),
              width: 3,
              height: mix(120, 600, glint),
              borderRadius: 3,
              background:
                'linear-gradient(180deg, rgb(255 200 160 / 0), #ffffff 50%, rgb(255 200 160 / 0))',
              opacity: glint * 0.6,
            }}
          />
        </>
      ) : null}
    </>
  )
}

/**
 * The blow-out: white from the centre behind a hot rim and an orange bloom, with short rays
 * thrown ahead of it.
 */
function Blast({ t }: { t: number }) {
  if (t < BLAST || t >= WHITE + 40) return null
  const p = progress(t, BLAST, WHITE - BLAST, (x) => 1 - (1 - x) ** 2)
  const R = mix(40, 1500, p)
  const reach = ease.outExpo(clamp((t - BLAST) / 150))
  const fade = 1 - progress(t, BLAST + 50, 110, ease.inCubic)
  const px = (value: number) => `${value.toFixed(1)}px`

  return (
    <>
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(circle at ${CORE.x}px ${CORE.y}px, ${FLASH_WHITE} 0px, ${FLASH_WHITE} ${px(R * 0.7)}, rgb(255 236 220) ${px(R * 0.86)}, rgb(255 140 60 / 0.6) ${px(R * 0.96)}, rgb(255 79 1 / 0.28) ${px(R * 1.08)}, rgb(255 79 1 / 0) ${px(R * 1.25)})`,
        }}
      />
      {fade > 0.01
        ? Array.from({ length: 9 }, (_, index) => {
            const [a = 0, b = 0, c = 0] = randoms(7300 + index * 11, 3)
            const angle = (index / 9) * 360 + (a - 0.5) * 24
            const length = mix(220, 1100, reach) * mix(0.75, 1.15, b)
            return (
              <span
                key={index}
                aria-hidden
                style={{
                  position: 'absolute',
                  left: CORE.x,
                  top: CORE.y - 3,
                  width: length,
                  height: c > 0.5 ? 6 : 4,
                  borderRadius: 6,
                  transformOrigin: '0 50%',
                  transform: `rotate(${angle.toFixed(2)}deg) translateX(${(R * 0.35).toFixed(1)}px)`,
                  background:
                    'linear-gradient(90deg, #ffffff, rgb(255 214 186 / 0.85) 45%, rgb(255 120 40 / 0))',
                  opacity: fade,
                }}
              />
            )
          })
        : null}
    </>
  )
}

/**
 * Sunday night: the shot dims the film's glow while it lasts, and gives it back under the
 * white, so `turn` opens on the usual backdrop.
 */
function Night({ t }: { t: number }) {
  const amount = interpolate(
    t,
    [-300, 250, IMPLODE, 5300, BLAST, WHITE + 20],
    [0, 0.42, 0.42, 0.6, 0.6, 0],
    ease.inOutCubic,
  )
  if (amount <= 0.001) return null
  const glow = 0.13 + Math.sin(t / 900) * 0.03
  return (
    <>
      <div
        aria-hidden
        style={{ position: 'absolute', inset: 0, background: '#040303', opacity: amount }}
      />
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: CORE.x - 620,
          top: 600 - 620,
          width: 1240,
          height: 1240,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${BRAND} 0%, transparent 66%)`,
          opacity: glow * clamp(amount / 0.42),
        }}
      />
    </>
  )
}

/** Where the time's figures sit on screen when they hit. */
const DIGITS = { x: 548, y: 640, width: 760, height: 222 }
const DUST_COLORS = ['#ffffff', '#ffe3d1', '#ffb58a']

/**
 * The hit of the time on the glass: a thin elliptical shockwave the shape of the figures,
 * and fine dust thrown off all round them.
 */
function Shockwave({ t }: { t: number }) {
  if (t < SLAM || t > SLAM + 1000) return null
  const p = progress(t, SLAM, 620, ease.outCubic)
  const width = mix(DIGITS.width + 40, 1760, p)
  const height = mix(DIGITS.height + 40, 820, p)
  const sides = [
    { x: DIGITS.x - DIGITS.width / 2, y: DIGITS.y, direction: 180, spread: 70 },
    { x: DIGITS.x + DIGITS.width / 2, y: DIGITS.y, direction: 0, spread: 70 },
    { x: DIGITS.x, y: DIGITS.y - DIGITS.height / 2, direction: -90, spread: 130 },
    { x: DIGITS.x, y: DIGITS.y + DIGITS.height / 2, direction: 90, spread: 130 },
  ]
  return (
    <>
      {p < 1 ? (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            left: DIGITS.x - width / 2,
            top: DIGITS.y - height / 2,
            width,
            height,
            borderRadius: '50%',
            border: `${mix(3, 1, p).toFixed(2)}px solid rgb(255 228 208 / ${(0.6 * (1 - p)).toFixed(3)})`,
          }}
        />
      ) : null}
      {sides.map((side, index) => (
        <Burst
          key={index}
          at={SLAM}
          x={side.x}
          y={side.y}
          count={8}
          seed={31 + index}
          direction={side.direction}
          spread={side.spread}
          speed={[420, 1250]}
          size={[1.5, 3.5]}
          life={[450, 950]}
          gravity={80}
          colors={DUST_COLORS}
        />
      ))}
    </>
  )
}

/** Darkness pooled right behind the line, so it reads over the pile — in before it lands. */
function Scrim({ t }: { t: number }) {
  const amount = interpolate(t, [2600, HOLD, 4950, 5350], [0, 1, 1, 0], ease.inOutCubic)
  if (amount <= 0.001) return null
  const y = (((CORE.y - 20) / HEIGHT) * 100).toFixed(2)
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        opacity: amount,
        background: [
          `radial-gradient(66% 21% at 50% ${y}%, rgb(8 6 5 / 0.9), rgb(8 6 5 / 0.84) 45%, rgb(8 6 5 / 0.5) 72%, rgb(8 6 5 / 0) 100%)`,
          'rgb(8 6 5 / 0.22)',
        ].join(', '),
      }}
    />
  )
}

/** Held white from the blast, then let `turn` come out of it. */
function WhiteOut({ t }: { t: number }) {
  const amount = interpolate(t, [WHITE, 5720, 6250], [1, 1, 0], [ease.linear, ease.outCubic])
  if (t < WHITE || amount <= 0.001) return null
  return (
    <div
      aria-hidden
      style={{ position: 'absolute', inset: 0, background: FLASH_WHITE, opacity: amount }}
    />
  )
}

export function Shot({ copy }: { copy: FilmCopy }) {
  const { local: t } = useShot()
  if (t < -300 || t >= 6300) return null

  return (
    <div className="absolute inset-0 overflow-hidden">
      <Night t={t} />
      {t < COLLAPSE + 60 ? (
        <World t={t} copy={copy}>
          <Clock text={copy.film.problem.time} t={t} />
        </World>
      ) : null}
      <Shockwave t={t} />
      <Scrim t={t} />
      <Ember t={t} />
      <Streaks t={t} />
      <Line text={copy.film.problem.line} t={t} />
      <Counter t={t} />
      <Core t={t} />
      <Blast t={t} />
      <WhiteOut t={t} />
    </div>
  )
}
