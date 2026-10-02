'use client'

import { GraduationCapIcon, UsersIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Cue } from '../audio/cues'
import type { FilmCopy } from '../copy'
import { Glow } from '../fx/backdrop'
import { Burst, Dust, Ring } from '../fx/effects'
import { Layer, Space } from '../fx/space'
import { UiCard } from '../fx/surface'
import { KineticText, parseAccents } from '../fx/text'
import { Replica } from '../replica'
import {
  BRAND,
  clamp,
  ease,
  type Easing,
  interpolate,
  mix,
  progress,
  randoms,
  spring,
  useShot,
} from '../time'

/**
 * Chapter 04 — the live lesson, the product's differentiator.
 *
 * One board rises into frame and, on the downbeat, splits in two: the teacher's screen and a
 * student's, turned toward each other like an open book, with the live room between them —
 * a pill with everyone in it — at the top of an arc of light. Nothing here is a picture of a
 * screen: the answers travel. Максим's word drops out of the room onto both screens at once;
 * Оля's leaves her screen, passes through the room and lands on the teacher's. The teacher's
 * press flies up into the room, the room turns into a tick and strikes both screens, and they
 * turn green — and grow with the verdict — together.
 */

const EMERALD = '#10b981'
const MINT = '#34d399'
const OLYA = '#0ea5e9'
const MAKSYM = '#a855f7'
const LIVE_RED = '#ef4444'
const WARM = '#ffb58a'

/** The beats the shot hits, shot-local ms. */
const AT = {
  /** The stacked board whips up from below, to an apex big in the frame. */
  rise: -350,
  /** On the downbeat it splits into two screens. */
  split: 0,
  /** "Урок" — and "наживо." on the next half-beat, with the room. */
  lead: 250,
  /** The live room pops between the screens; the light draws out to both. */
  pill: 500,
  /** "Без демонстрації екрана." */
  accent: 1000,
  /** Максим's word comes out of the room… */
  haveOut: 1100,
  /** …and lands on both screens at once. */
  have: 1500,
  /** Оля's word leaves her screen… */
  cardOut: 1540,
  /** …and lands on the teacher's. */
  card: 2000,
  /** The teacher presses "Перевірити". */
  press: 2500,
  /** The press reaches the room, and the room becomes a tick. */
  relay: 2750,
  /** Both boards turn green together. */
  marks: 3000,
  /** Whip left. */
  exit: 3600,
} as const

/** Максим's word hovers over the room until it parts for both screens. */
const HAVE_SPLIT = 1260
/** Оля's word lifts off her screen until here, then flies. */
const CARD_FLY = 1640
/** The verdict runs down both halves of the light to the screens' top edges… */
const BEAM = { at: 2760, duration: 160 }
/** …and sweeps down each screen, its bright edge reaching the verdict on the beat. */
const WASH = { at: 2920, duration: 380 }
/** The light drawing out from the room to both screens. */
const DRAW = 260

/** The whip out, accelerating to the cut. */
const WHIP = 500
const whipOf = (local: number) => progress(local, AT.exit, WHIP, ease.inCubic)

/** The lesson on the board is English, as the scene has it: data, not copy. */
const WORDS = { have: 'have', card: 'card' }

export const cues: readonly Cue[] = [
  { at: AT.rise, kind: 'whoosh', duration: 420, gain: 0.7 },
  { at: AT.split, kind: 'whoosh', duration: 380, gain: 0.55 },
  { at: AT.lead, kind: 'impact', gain: 0.7 },
  { at: AT.pill, kind: 'pop', gain: 0.5, pitch: 2 },
  { at: AT.accent, kind: 'impact', gain: 0.62, pitch: 2 },
  { at: AT.have, kind: 'pop', gain: 0.6 },
  { at: CARD_FLY, kind: 'whoosh', duration: AT.card - CARD_FLY, gain: 0.3, pan: 0.25 },
  { at: AT.card, kind: 'pop', gain: 0.6, pitch: 3, pan: -0.3 },
  { at: AT.press, kind: 'click', gain: 0.85, pan: -0.35 },
  { at: AT.press, kind: 'riser', duration: AT.marks - AT.press, gain: 0.4 },
  { at: AT.marks, kind: 'chime', gain: 0.95 },
  { at: AT.exit, kind: 'whoosh', duration: WHIP, gain: 0.8, pan: -0.6 },
]

/** A scene clock for a shot-local time, bent so the scene's moments land on the beats. */
type Clock = { local: readonly number[]; scene: readonly number[] }

/**
 * The teacher's board: the pointers fly in under the headline, Максим's word lands with the
 * room's, Оля's when it reaches this screen, then the press and the marks on the beat.
 */
const TEACHER_CLOCK: Clock = {
  local: [-400, AT.have, AT.card, AT.card + 60, AT.press, AT.marks, 4400],
  scene: [1050, 2950, 3120, 3500, 4300, 4750, 6150],
}

/** Оля's own board runs a moment ahead: her word is on it before it reaches the teacher. */
const STUDENT_CLOCK: Clock = {
  local: [-400, AT.have, AT.cardOut, AT.card + 60, AT.press, AT.marks, 4400],
  scene: [1050, 2950, 3120, 3500, 4300, 4750, 6150],
}

/**
 * The board, without the room's status row above it (that sentence is the host's own). The
 * window ends under the footer, and grows with it when the verdict pushes it down.
 */
const CROP = { x: 22, y: 82, width: 476 }
const CARD_W = CROP.width
const CARD_H = { before: 380, after: 456 }
const RADIUS = 24

/** The card's height now: it grows as the verdict arrives, on the product's own curve. */
const heightAt = (local: number) =>
  mix(CARD_H.before, CARD_H.after, progress(local, AT.marks, 300, ease.house))

/** Where a point of the scene's 520×720 stage lands on a card. */
const onCard = (x: number, y: number) => ({ x: x - CROP.x, y: y - CROP.y })

/** Measured on the stage: the two gaps, the check button, the verdict's tick. */
const SPOT = {
  have: onCard(143.5, 289),
  card: onCard(344.5, 327),
  check: onCard(341, 416),
  tick: onCard(64, 414),
}

/** The set: perspective, the cards' top edge, the room above them, the book's angle. */
const DEPTH = 1500
const ORIGIN = { x: 540, y: 780 }
const CARD_TOP = 680
/** The rig turns about the middle of the screens. */
const PIVOT_Y = CARD_TOP + CARD_H.after / 2
const PILL_Y = 575
const ANGLE = 26
const SPREAD = 216
/** The stacked board peaks big and high, then settles into the pair. */
const BIG = { scale: 1.28, y: -230 }
/** The connection floats this far in front of the screens, so the tags clear their edges. */
const LIFT_Z = 70
/** The motes float this far in front, out of focus. */
const MOTE_Z = 260
/** The room: a pill of everyone in it, which becomes a tick. */
const PILL = { width: 236, height: 64 }
const MEDAL = 116

type Point = { x: number; y: number }
type Vec = { x: number; y: number; z: number }

/** A screen's pose this frame. */
type Pose = {
  x: number
  y: number
  z: number
  turn: number
  lean: number
  blur: number
  height: number
  scale: number
}

/** The camera on the rig this frame. */
type Camera = { tilt: number; orbit: number; scale: number }

/** A gentler outBack: lands with weight, overshooting about 7%. */
const outBackSoft: Easing = (x) => {
  const c1 = 1.4
  const c3 = c1 + 1
  return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2
}
const inOutSine: Easing = (x) => -(Math.cos(Math.PI * x) - 1) / 2

/** Up to 1 over `rise`, then falling away with `decay`: a hit. */
function pulseAt(local: number, at: number, rise: number, decay: number): number {
  if (local < at) return 0
  return (
    progress(local, at, rise, ease.outCubic) *
    (local < at + rise ? 1 : Math.exp(-(local - at - rise) / decay))
  )
}

/**
 * How the pair moves: whipped up as one to an apex, then — on the downbeat — split apart, the
 * student's screen sliding out from behind the teacher's and only coming forward once they
 * are clear of each other, both settling down and turning toward each other.
 */
function posesAt(local: number): { teacher: Pose; student: Pose; split: number } {
  const riseAt = (t: number) => (1 - progress(t, AT.rise, -AT.rise, ease.outCubic)) * 1250
  const rise = riseAt(local)
  const blur = clamp(Math.abs(rise - riseAt(local - 33)) / 10, 0, 30)
  const split = spring(local - AT.split, { stiffness: 140, damping: 17 })
  const settle = progress(local, AT.split, 600, ease.inOutCubic)
  const turn = spring(local - AT.split - 140, { stiffness: 130, damping: 17 })
  const lean = (1 - progress(local, AT.rise, 420, ease.outCubic)) * 26
  const bob = (phase: number) => Math.sin((local / 1000) * 1.7 * Math.PI + phase) * 4
  const height = heightAt(local)
  const scale = mix(BIG.scale, 1, settle) * (1 + 0.04 * pulseAt(local, AT.marks, 60, 260))
  const y = rise + mix(BIG.y, 0, settle)

  return {
    split,
    teacher: {
      x: 540 - SPREAD * split,
      y: y + bob(0),
      z: 0,
      turn: ANGLE * turn,
      lean,
      blur,
      height,
      scale,
    },
    student: {
      x: 540 + SPREAD * split,
      y: y + bob(1.9),
      z: mix(-140, 0, clamp((split - 0.72) / 0.3)),
      turn: -ANGLE * turn,
      lean,
      blur,
      height,
      scale,
    },
  }
}

/**
 * The camera: a sweep around the pair as the room works (ending nearly square-on for the
 * verdict, so the punch keeps both screens in frame), a slow push in, a tilt settling.
 */
function cameraAt(local: number): Camera {
  const sweep = progress(local, 300, 2800, ease.inOutCubic)
  const after = clamp((local - 3100) / 1000)
  return {
    orbit: mix(-12, 6, sweep) + 1.5 * after + 18 * whipOf(local),
    tilt: interpolate(local, [-350, 700, 3600], [14, 5, 3], [ease.outCubic, ease.linear]),
    scale: mix(1, 1.04, clamp((local + 350) / 3950)),
  }
}

// ——— A little 3D: where a point in the rig lands on screen. ———

const rad = (deg: number) => (deg * Math.PI) / 180
const rotX = (p: Vec, deg: number): Vec => {
  const c = Math.cos(rad(deg))
  const s = Math.sin(rad(deg))
  return { x: p.x, y: p.y * c - p.z * s, z: p.y * s + p.z * c }
}
const rotY = (p: Vec, deg: number): Vec => {
  const c = Math.cos(rad(deg))
  const s = Math.sin(rad(deg))
  return { x: p.x * c + p.z * s, y: p.y, z: -p.x * s + p.z * c }
}

/** A point in the rig's space, through the camera and the perspective, onto the frame. */
function toScreen(p: Vec, camera: Camera): Point {
  const scaled = { x: (p.x - 540) * camera.scale, y: (p.y - PIVOT_Y) * camera.scale, z: p.z }
  const turned = rotX(rotY(scaled, camera.orbit), camera.tilt)
  const world = { x: turned.x + 540, y: turned.y + PIVOT_Y, z: turned.z }
  const k = DEPTH / (DEPTH - world.z)
  return { x: ORIGIN.x + (world.x - ORIGIN.x) * k, y: ORIGIN.y + (world.y - ORIGIN.y) * k }
}

/** A point on a screen (px from its top-left), through its pose and the camera, onto the frame. */
function cardPoint(pose: Pose, spot: Point, camera: Camera): Point {
  const local: Vec = {
    x: (spot.x - CARD_W / 2) * pose.scale,
    y: (spot.y - pose.height / 2) * pose.scale,
    z: 0,
  }
  const turned = rotX(rotY(local, pose.turn), pose.lean)
  return toScreen(
    {
      x: pose.x + turned.x,
      y: CARD_TOP + pose.height / 2 + pose.y + turned.y,
      z: pose.z + turned.z,
    },
    camera,
  )
}

/** Where to put something on a plane `z` in front, so it appears at (x, y) of a z 0 plane. */
function atDepth(x: number, y: number, z: number): Point {
  const scale = (DEPTH - z) / DEPTH
  return { x: ORIGIN.x + (x - ORIGIN.x) * scale, y: ORIGIN.y + (y - ORIGIN.y) * scale }
}

/** A role's tag rides its screen's top edge, on the connection's plane. */
const tagOf = (pose: Pose): Point =>
  atDepth(pose.x, CARD_TOP + pose.y + (pose.height / 2) * (1 - pose.scale), LIFT_Z)

function cubicAt(p0: Point, p1: Point, p2: Point, p3: Point, u: number): Point {
  const v = 1 - u
  const a = v * v * v
  const b = 3 * v * v * u
  const c = 3 * v * u * u
  const d = u * u * u
  return {
    x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
  }
}

/** The light from the teacher's tag up through the room and down to the student's. */
function arcOf(from: Point, to: Point) {
  const lift = Math.max(0, ((from.y + to.y) / 2 - PILL_Y) / 0.75)
  const p0 = from
  const p1 = { x: from.x + 60 * clamp((to.x - from.x) / 400), y: from.y - lift }
  const p2 = { x: to.x - 60 * clamp((to.x - from.x) / 400), y: to.y - lift }
  const p3 = to
  const half = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
  const a1 = half(p0, p1)
  const b1 = half(p1, p2)
  const c1 = half(p2, p3)
  const a2 = half(a1, b1)
  const b2 = half(b1, c1)
  const mid = half(a2, b2)
  const pt = (p: Point) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`
  return {
    at: (u: number) => cubicAt(p0, p1, p2, p3, u),
    /** Each half, drawn from the room outward. */
    halves: [
      `M ${pt(mid)} C ${pt(a2)} ${pt(a1)} ${pt(p0)}`,
      `M ${pt(mid)} C ${pt(b2)} ${pt(c1)} ${pt(p3)}`,
    ],
  }
}

type Arc = ReturnType<typeof arcOf>

/** A pulse crossing the arc: u 0 is the teacher, 0.5 the room, 1 the student. */
type Trip = {
  at: number
  from: number
  to: number
  duration: number
  color: string
  size: number
  easing?: Easing
}

const TRIPS: readonly Trip[] = [
  // The light drawing out from the room, a head on each side.
  { at: AT.pill, from: 0.5, to: 0, duration: DRAW, color: WARM, size: 18, easing: ease.outCubic },
  { at: AT.pill, from: 0.5, to: 1, duration: DRAW, color: WARM, size: 18, easing: ease.outCubic },
  // A heartbeat across, teacher to student, landing on the beat.
  { at: 700, from: 0, to: 1, duration: 300, color: WARM, size: 18 },
  // The verdict, from the room down both halves.
  { at: BEAM.at, from: 0.5, to: 0, duration: BEAM.duration, color: MINT, size: 26 },
  { at: BEAM.at, from: 0.5, to: 1, duration: BEAM.duration, color: MINT, size: 26 },
]

/** Moments of light on the room or a tag, in the colour of what passed. */
type Spark = { at: number; color: string }
const AT_PILL: readonly Spark[] = [
  { at: AT.pill, color: BRAND },
  { at: AT.haveOut, color: MAKSYM },
  { at: (CARD_FLY + AT.card) / 2, color: OLYA },
  { at: AT.relay, color: MINT },
]
const AT_TEACHER: readonly Spark[] = [
  { at: AT.pill + DRAW, color: WARM },
  { at: AT.have, color: MAKSYM },
  { at: AT.card, color: OLYA },
  { at: AT.press + 80, color: BRAND },
  { at: WASH.at, color: MINT },
]
const AT_STUDENT: readonly Spark[] = [
  { at: AT.pill + DRAW, color: WARM },
  { at: 1000, color: WARM },
  { at: AT.have, color: MAKSYM },
  { at: AT.cardOut + 40, color: OLYA },
  { at: WASH.at, color: MINT },
]

/** How bright the latest of `sparks` still is, and its colour. */
function flare(
  local: number,
  sparks: readonly Spark[],
  decay = 220,
): { glow: number; color: string } {
  let glow = 0
  let color: string = BRAND
  for (const spark of sparks) {
    if (local < spark.at) continue
    const amount = Math.exp(-(local - spark.at) / decay)
    if (amount > glow) {
      glow = amount
      color = spark.color
    }
  }
  return { glow, color }
}

/** 1 on each beat, falling away until the next. */
function beatPulse(local: number, decay = 160): number {
  const since = ((local % 500) + 500) % 500
  return Math.exp(-since / decay)
}

/** The emerald moment: up fast on the marks, down slowly. */
function greenAt(local: number, hold = 900): number {
  if (local < AT.marks) return 0
  return interpolate(
    local,
    [AT.marks, AT.marks + 70, AT.marks + hold],
    [0, 1, 0],
    [ease.outCubic, ease.inOutCubic],
  )
}

/** `#rrggbb` with an alpha, for glows in a pulse's colour. */
function alpha(hex: string, amount: number): string {
  const value = Number.parseInt(hex.slice(1), 16)
  return `rgb(${(value >> 16) & 255} ${(value >> 8) & 255} ${value & 255} / ${clamp(amount).toFixed(3)})`
}

/**
 * On the student's screen the board is the student's: no "Перевірити" (only the host may
 * mark a step) and no host's own arrow.
 */
const STUDENT_VIEW =
  '[data-live-student] [data-anchor="check"]{visibility:hidden}' +
  '[data-live-student] [data-promo-scene]>[aria-hidden]:not(:has(span)){display:none}'

export function Shot({ copy }: { copy: FilmCopy }) {
  const { local } = useShot()
  if (local < -400 || local >= AT.exit + WHIP + 20) return null

  const teacherMs = interpolate(local, TEACHER_CLOCK.local, TEACHER_CLOCK.scene)
  const studentMs = interpolate(local, STUDENT_CLOCK.local, STUDENT_CLOCK.scene)
  const { teacher, student, split } = posesAt(local)
  const camera = cameraAt(local)

  // The frame answers every hit: a kick on each slam and landing, a punch on the green.
  const kick = (at: number, amount: number, decay = 160) => amount * pulseAt(local, at, 50, decay)
  const punch =
    kick(AT.lead, 0.014) +
    kick(AT.pill, 0.01) +
    kick(AT.accent, 0.016) +
    kick(AT.have, 0.008) +
    kick(AT.card, 0.008) +
    kick(AT.press, 0.006) +
    kick(AT.marks, 0.065, 220)

  // Out: a whip to the left, smeared sideways, the set turning away as it goes.
  const whipAt = (t: number) => -1500 * whipOf(t)
  const shift = whipAt(local)
  const smear = clamp(Math.abs(shift - whipAt(local - 33)) / 12, 0, 28)

  const tags = { teacher: tagOf(teacher), student: tagOf(student) }
  const arc = arcOf(tags.teacher, tags.student)
  const pill = toScreen({ x: 540, y: PILL_Y, z: LIFT_Z }, camera)
  const spine = toScreen({ x: 540, y: CARD_TOP + CARD_H.before / 2 + teacher.y, z: 0 }, camera)

  return (
    <div className="absolute inset-0">
      <style>{STUDENT_VIEW}</style>
      <Filters rise={[teacher.blur, student.blur]} smear={smear} />
      <div
        className="absolute inset-0"
        style={{
          transform: `translateX(${shift}px) scale(${1 + punch})`,
          transformOrigin: `540px ${pill.y.toFixed(1)}px`,
          filter: smear > 0.4 ? 'url(#live-smear)' : undefined,
        }}
      >
        <Atmosphere pill={pill} spine={spine} />
        <Space depth={DEPTH} originX={ORIGIN.x} originY={ORIGIN.y}>
          <div
            className="absolute inset-0"
            style={{
              transformStyle: 'preserve-3d',
              transformOrigin: `540px ${PIVOT_Y}px`,
              transform: `rotateX(${camera.tilt}deg) rotateY(${camera.orbit}deg) scale(${camera.scale})`,
            }}
          >
            <Screen pose={student} index={1} ms={studentMs} copy={copy} />
            <Screen pose={teacher} index={0} ms={teacherMs} copy={copy} />
            <Layer cx={540} cy={675} width={1080} height={1350} pose={{ z: LIFT_Z }} flat>
              <Connection copy={copy} arc={arc} tags={tags} split={split} />
            </Layer>
            <Motes />
          </div>
        </Space>
        <HaveChips teacher={teacher} student={student} camera={camera} pill={pill} />
        <CardChip teacher={teacher} student={student} camera={camera} pill={pill} />
        <PressPacket teacher={teacher} camera={camera} pill={pill} />
        <MintFlash />
        <Headline text={copy.film.headlines.live} />
      </div>
    </div>
  )
}

/** Directional blurs: vertical for the rise, horizontal for the whip out. */
function Filters({ rise, smear }: { rise: readonly number[]; smear: number }) {
  return (
    <svg aria-hidden width={0} height={0} style={{ position: 'absolute' }}>
      <defs>
        {rise.map((amount, index) => (
          <filter
            key={index}
            id={`live-rise-${index}`}
            x="-10%"
            y="-40%"
            width="120%"
            height="180%"
          >
            <feGaussianBlur stdDeviation={`0 ${amount.toFixed(2)}`} />
          </filter>
        ))}
        <filter id="live-smear" x="-30%" y="-5%" width="160%" height="110%">
          <feGaussianBlur stdDeviation={`${smear.toFixed(2)} 0`} />
        </filter>
      </defs>
    </svg>
  )
}

/** Light around the set: a warm glow behind the room, each side's colour, a floor, waves. */
function Atmosphere({ pill, spine }: { pill: Point; spine: Point }) {
  const { local } = useShot()
  const on = progress(local, -300, 500, ease.outCubic)
  if (on <= 0.001) return null
  const breathe = beatPulse(local, 220)
  const green = greenAt(local, 1100)

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0" style={{ opacity: on }}>
      <Glow x={540} y={PILL_Y + 60} size={1000} opacity={0.2 + 0.07 * breathe} />
      <Glow x={250} y={PIVOT_Y} size={800} opacity={0.13} />
      <Glow x={830} y={PIVOT_Y} size={800} color={OLYA} opacity={0.1} />
      {green > 0.001 ? (
        <Glow x={540} y={PIVOT_Y - 60} size={1250} color={EMERALD} opacity={0.42 * green} />
      ) : null}
      <div
        style={{
          position: 'absolute',
          left: 40,
          top: CARD_TOP + CARD_H.after - 50,
          width: 1000,
          height: 230,
          borderRadius: '50%',
          background: 'radial-gradient(50% 50% at 50% 50%, rgb(255 79 1 / 0.24), transparent 72%)',
        }}
      />
      <Dust count={20} seed={44} opacity={0.32} />
      <SplitLight at={spine} />
      <Wave
        at={AT.pill}
        x={pill.x}
        y={pill.y}
        to={420}
        color="rgb(255 110 40 / 0.42)"
        duration={800}
      />
      <Wave
        at={AT.relay}
        x={pill.x}
        y={pill.y}
        to={380}
        color="rgb(52 211 153 / 0.6)"
        duration={600}
      />
      <Wave
        at={AT.marks}
        x={pill.x}
        y={pill.y}
        to={420}
        color="rgb(16 185 129 / 0.5)"
        duration={700}
      />
    </div>
  )
}

/**
 * On the downbeat the one board comes apart in a burst of light from behind it: it rims the
 * board and pours out around the two screens as they part, with sparks flung past them.
 */
function SplitLight({ at }: { at: Point }) {
  const { local } = useShot()
  if (local < AT.split - 40 || local > AT.split + 900) return null
  const p = progress(local, AT.split, 620, ease.outCubic)
  const light = interpolate(
    local,
    [AT.split - 40, AT.split + 40, AT.split + 620],
    [0, 1, 0],
    [ease.outCubic, ease.inOutCubic],
  )
  const width = mix(1150, 1750, p)
  const height = mix(1050, 1450, p)

  return (
    <>
      {light > 0.01 ? (
        <span
          style={{
            position: 'absolute',
            left: at.x - width / 2,
            top: at.y - height / 2,
            width,
            height,
            borderRadius: '50%',
            background:
              'radial-gradient(50% 50% at 50% 50%, rgb(255 240 228 / 0.95), rgb(255 150 70 / 0.7) 32%, rgb(255 90 20 / 0.32) 52%, transparent 74%)',
            opacity: light,
          }}
        />
      ) : null}
      <Burst
        at={AT.split}
        x={at.x}
        y={at.y}
        count={22}
        seed={77}
        colors={[BRAND, WARM, '#ffffff']}
        speed={[700, 1500]}
        size={[3, 7]}
        life={[480, 880]}
        gravity={240}
        spread={360}
        direction={0}
        shape="spark"
      />
    </>
  )
}

/** A soft shockwave: a blurred band of light widening from a point. */
function Wave({
  at,
  x,
  y,
  to,
  color,
  duration,
}: {
  at: number
  x: number
  y: number
  to: number
  color: string
  duration: number
}) {
  const { local } = useShot()
  const p = progress(local, at, duration, ease.outCubic)
  if (local < at || p >= 1) return null
  const r = mix(50, to, p)

  return (
    <span
      aria-hidden
      style={{
        position: 'absolute',
        left: x - r,
        top: y - r,
        width: r * 2,
        height: r * 2,
        borderRadius: '50%',
        background: `radial-gradient(circle, transparent 56%, ${color} 68%, transparent 75%)`,
        opacity: interpolate(p, [0, 0.12, 1], [0, 1, 0]),
      }}
    />
  )
}

/** Soft out-of-focus motes in front of the screens, for depth as the camera turns. */
function Motes() {
  const { local } = useShot()
  const on = progress(local, 0, 600, ease.outCubic)
  const t = local / 1000

  return (
    <Layer cx={540} cy={675} width={1080} height={1350} pose={{ z: MOTE_Z }} flat opacity={on}>
      {[
        { x: 46, y: 860, size: 120 },
        { x: 1040, y: 780, size: 96 },
        { x: 985, y: 470, size: 56 },
        { x: 80, y: 560, size: 60 },
        { x: 470, y: 1235, size: 64 },
        { x: 650, y: 1205, size: 40 },
      ].map((mote, index) => {
        const [r1, r2] = randoms(900 + index, 2) as [number, number]
        const at = atDepth(mote.x, mote.y, MOTE_Z)
        const size = mote.size * ((DEPTH - MOTE_Z) / DEPTH)
        return (
          <span
            key={index}
            aria-hidden
            style={{
              position: 'absolute',
              left: at.x - size / 2 + Math.sin(t * 0.9 + index) * 8,
              top: at.y - size / 2 - t * mix(8, 20, r1),
              width: size,
              height: size,
              borderRadius: 999,
              background: `radial-gradient(circle, rgb(255 ${Math.round(mix(150, 205, r2))} 140 / 0.3), rgb(255 120 60 / 0.1) 55%, transparent 72%)`,
            }}
          />
        )
      })}
    </Layer>
  )
}

/** One screen: the real board, filmed. Its top edge stays put while it grows. */
function Screen({
  pose,
  index,
  ms,
  copy,
}: {
  pose: Pose
  index: number
  ms: number
  copy: FilmCopy
}) {
  const student = index === 1

  return (
    <Layer
      cx={pose.x}
      cy={CARD_TOP + pose.height / 2}
      width={CARD_W}
      height={pose.height}
      flat
      pose={{ y: pose.y, z: pose.z, rotateY: pose.turn, rotateX: pose.lean, scale: pose.scale }}
      style={{ filter: pose.blur > 0.4 ? `url(#live-rise-${index})` : undefined }}
    >
      <UiCard width={CARD_W} height={pose.height} radius={RADIUS} style={{ position: 'relative' }}>
        <div data-live-student={student ? '' : undefined}>
          <Replica scene="live" ms={ms} copy={copy.promo} crop={{ ...CROP, height: pose.height }} />
        </div>
        <GreenWash height={pose.height} />
      </UiCard>
      <ScreenHits teacher={!student} seed={index + 1} />
    </Layer>
  )
}

/** The verdict entering the screen from its top edge: a band of green light sweeping down. */
function GreenWash({ height }: { height: number }) {
  const { local } = useShot()
  const p = progress(local, WASH.at, WASH.duration, ease.outCubic)
  if (local < WASH.at || p >= 1) return null
  const band = 200
  const top = mix(-band, height, p)

  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top,
        height: band,
        background:
          'linear-gradient(180deg, transparent, rgb(16 185 129 / 0.16) 55%, rgb(52 211 153 / 0.5) 92%, transparent)',
        opacity: 1 - p * 0.6,
      }}
    />
  )
}

/** What lights up on a screen: each answer arriving, the teacher's press, the green. */
function ScreenHits({ teacher, seed }: { teacher: boolean; seed: number }) {
  const { local } = useShot()
  const rim = greenAt(local)

  return (
    <>
      <GapFlash at={AT.have} spot={SPOT.have} color={MAKSYM} word={WORDS.have} />
      {teacher ? (
        <GapFlash at={AT.card} spot={SPOT.card} color={OLYA} word={WORDS.card} />
      ) : (
        <GapFlash at={AT.cardOut} spot={SPOT.card} color={OLYA} small />
      )}
      {teacher ? <Press /> : null}
      {rim > 0.001 ? (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: -3,
            borderRadius: RADIUS + 3,
            border: `3px solid ${MINT}`,
            boxShadow: '0 0 80px 14px rgb(16 185 129 / 0.5), inset 0 0 50px rgb(52 211 153 / 0.25)',
            opacity: rim,
          }}
        />
      ) : null}
      <Ring
        at={AT.marks}
        x={SPOT.tick.x}
        y={SPOT.tick.y}
        from={12}
        to={110}
        color={MINT}
        width={4}
        duration={620}
      />
      <Burst
        at={AT.marks}
        x={SPOT.tick.x}
        y={SPOT.tick.y}
        count={20}
        seed={40 + seed}
        colors={[EMERALD, MINT, '#ffffff']}
        speed={[240, 760]}
        size={[4, 10]}
        life={[600, 1100]}
        gravity={420}
        spread={200}
        direction={-60}
      />
    </>
  )
}

/**
 * An answer arriving in its gap: a ring in the writer's colour, a soft bloom, and the word
 * itself popping in that colour before it settles into the board's own ink.
 */
function GapFlash({
  at,
  spot,
  color,
  word,
  small = false,
}: {
  at: number
  spot: Point
  color: string
  word?: string
  small?: boolean
}) {
  const { local } = useShot()
  if (local < at || local > at + 700) return null
  const bloom = interpolate(local, [at, at + 50, at + 520], [0, 1, 0])
  const pop = progress(local, at, 260, ease.outCubic)
  const settle = 1 - progress(local, at + 180, 320, ease.inOutCubic)

  return (
    <>
      <Ring
        at={at}
        x={spot.x}
        y={spot.y}
        from={small ? 16 : 22}
        to={small ? 70 : 118}
        color={color}
        width={small ? 3 : 4}
        duration={small ? 420 : 600}
      />
      {bloom > 0.01 ? (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            left: spot.x - 55,
            top: spot.y - 32,
            width: 110,
            height: 64,
            borderRadius: 16,
            background: color,
            opacity: (small ? 0.25 : 0.42) * bloom,
            filter: 'blur(10px)',
          }}
        />
      ) : null}
      {word && settle > 0.01 ? (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            left: spot.x,
            top: spot.y,
            transform: `translate(-50%, -50%) scale(${mix(1.5, 1, pop)})`,
            color,
            fontSize: 15,
            fontWeight: 600,
            lineHeight: 1,
            whiteSpace: 'nowrap',
            opacity: settle,
            textShadow: `0 0 12px ${alpha(color, 0.6)}`,
          }}
        >
          {word}
        </span>
      ) : null}
    </>
  )
}

/**
 * The teacher's press: the button gathers light as the pointer settles on it, then a glint
 * and a bloom on it and a ring hugging it, on the card.
 */
function Press() {
  const { local } = useShot()
  if (local < AT.press - 320 || local > AT.press + 520) return null
  const { x, y } = SPOT.check
  const charge = local < AT.press ? progress(local, AT.press - 320, 320, ease.inCubic) : 0
  const glint =
    local < AT.press ? 0 : interpolate(local, [AT.press, AT.press + 40, AT.press + 180], [0, 1, 0])
  const bloom =
    local < AT.press ? 0 : interpolate(local, [AT.press, AT.press + 60, AT.press + 460], [0, 1, 0])
  const ring = progress(local, AT.press, 440, ease.outCubic)
  const width = mix(98, 156, ring)
  const height = mix(34, 70, ring)

  return (
    <>
      {charge > 0.01 ? (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            left: x - 66,
            top: y - 24,
            width: 132,
            height: 48,
            borderRadius: 24,
            background: BRAND,
            opacity: 0.55 * charge,
            transform: `scale(${mix(0.7, 1.12, charge)})`,
            filter: 'blur(10px)',
          }}
        />
      ) : null}
      {bloom > 0.01 ? (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            left: x - 75,
            top: y - 28,
            width: 150,
            height: 56,
            borderRadius: 28,
            background: BRAND,
            opacity: 0.5 * bloom,
            filter: 'blur(12px)',
          }}
        />
      ) : null}
      {glint > 0.01 ? (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            left: x - 52,
            top: y - 20,
            width: 104,
            height: 40,
            borderRadius: 20,
            background:
              'radial-gradient(closest-side, rgb(255 255 255 / 0.95), rgb(255 255 255 / 0))',
            opacity: glint,
          }}
        />
      ) : null}
      {local >= AT.press && ring < 1 ? (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            left: x - width / 2,
            top: y - height / 2,
            width,
            height,
            borderRadius: 999,
            border: `3px solid ${BRAND}`,
            boxShadow: `0 0 12px ${alpha(BRAND, 0.6)}`,
            opacity: interpolate(ring, [0, 0.12, 1], [0, 1, 0]),
          }}
        />
      ) : null}
    </>
  )
}

/** A stroke with a soft halo, built from wide faint strokes rather than a blur filter. */
function GlowPath({
  d,
  color,
  core,
  width,
  reveal,
}: {
  d: string
  color: string
  core: string
  width: number
  reveal: number
}) {
  const dash = { pathLength: 1, strokeDasharray: '1 1', strokeDashoffset: 1 - reveal }

  return (
    <>
      {[
        { w: width * 7, a: 0.08 },
        { w: width * 4, a: 0.16 },
        { w: width * 2.2, a: 0.32 },
      ].map(({ w, a }) => (
        <path
          key={w}
          d={d}
          fill="none"
          stroke={color}
          strokeOpacity={a}
          strokeWidth={w}
          strokeLinecap="round"
          {...dash}
        />
      ))}
      <path d={d} fill="none" stroke={core} strokeWidth={width} strokeLinecap="round" {...dash} />
    </>
  )
}

/** The connection above the screens: the arc, its pulses, the two role tags, the room. */
function Connection({
  copy,
  arc,
  tags,
  split,
}: {
  copy: FilmCopy
  arc: Arc
  tags: { teacher: Point; student: Point }
  split: number
}) {
  const { local } = useShot()
  const draw = progress(local, AT.pill, DRAW, ease.outCubic)
  const green = progress(local, BEAM.at, BEAM.duration, ease.inOutCubic)
  const greenFade = 1 - progress(local, AT.marks + 300, 700, ease.inOutCubic)
  const flow = local / 1400
  const tagsIn = clamp((split - 0.6) / 0.35)

  return (
    <>
      {draw > 0 ? (
        <svg
          aria-hidden
          width={1080}
          height={1350}
          style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}
        >
          {arc.halves.map((d, index) => (
            <g key={index}>
              <GlowPath
                d={d}
                color="#ff6e28"
                core="rgb(255 226 210 / 0.85)"
                width={3}
                reveal={draw}
              />
              {draw >= 1 ? (
                <path
                  d={d}
                  pathLength={1}
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth={4}
                  strokeLinecap="round"
                  strokeDasharray="0.008 0.045"
                  strokeDashoffset={-flow}
                  opacity={0.5}
                />
              ) : null}
              {green > 0 && greenFade > 0 ? (
                <g opacity={greenFade}>
                  <GlowPath d={d} color={EMERALD} core={MINT} width={5} reveal={green} />
                </g>
              ) : null}
            </g>
          ))}
        </svg>
      ) : null}

      {TRIPS.map((trip, index) => (
        <Comet key={index} trip={trip} arc={arc} />
      ))}

      {/* The green's sparks leave each tag's top edge, behind the tag. */}
      {tagsIn > 0
        ? [tags.teacher, tags.student].map((tag, index) => (
            <Burst
              key={index}
              at={AT.marks}
              x={tag.x}
              y={tag.y - 30}
              count={14}
              seed={60 + index}
              colors={[MINT, '#ffffff', EMERALD]}
              speed={[260, 620]}
              size={[4, 8]}
              life={[500, 900]}
              gravity={700}
              spread={150}
              direction={-90}
              shape="spark"
            />
          ))
        : null}

      <RoleTag
        at={tags.teacher}
        shown={tagsIn}
        label={copy.roles.teacher}
        light={flare(local, AT_TEACHER)}
        disc={
          <span
            style={{
              display: 'grid',
              placeItems: 'center',
              width: 38,
              height: 38,
              borderRadius: 999,
              background: `linear-gradient(145deg, #ff7a33, ${BRAND} 45%, #e22f00)`,
            }}
          >
            <GraduationCapIcon color="white" strokeWidth={2.2} style={{ width: 22, height: 22 }} />
          </span>
        }
      />
      <RoleTag
        at={tags.student}
        shown={tagsIn}
        label={copy.roles.student}
        light={flare(local, AT_STUDENT)}
        disc={
          <span
            style={{
              display: 'grid',
              placeItems: 'center',
              width: 38,
              height: 38,
              borderRadius: 999,
              background: OLYA,
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: '0.02em',
            }}
          >
            {copy.promo.scenes.live.olyaInitials}
          </span>
        }
      />
      <Ring
        at={AT.marks}
        x={540}
        y={PILL_Y}
        from={62}
        to={140}
        color={MINT}
        width={4}
        duration={560}
      />
      <Room copy={copy} />
    </>
  )
}

/** A comet on the arc: a hot head and a tail that stretches with its speed. */
function Comet({ trip, arc }: { trip: Trip; arc: Arc }) {
  const { local } = useShot()
  const elapsed = local - trip.at
  if (elapsed < 0 || elapsed > trip.duration + 120) return null

  const fade = 1 - clamp((elapsed - trip.duration) / 120)
  const easing = trip.easing ?? ease.inOutCubic
  const uAt = (t: number) => mix(trip.from, trip.to, easing(clamp(t / trip.duration)))
  const spacing = trip.duration < 300 ? 9 : 15

  return (
    <>
      {Array.from({ length: 9 }, (_, k) => {
        const p = arc.at(uAt(elapsed - k * spacing))
        const s = trip.size * (1 - k / 11)
        return (
          <span
            key={k}
            aria-hidden
            style={{
              position: 'absolute',
              left: p.x - s / 2,
              top: p.y - s / 2,
              width: s,
              height: s,
              borderRadius: 999,
              background: k === 0 ? '#ffffff' : trip.color,
              opacity: fade * (1 - k / 9.5),
              boxShadow:
                k === 0 ? `0 0 ${trip.size * 2}px ${trip.size * 0.6}px ${trip.color}` : undefined,
            }}
          />
        )
      })}
    </>
  )
}

/** A role's tag on its screen's top edge: who is on this side. */
function RoleTag({
  at,
  shown,
  label,
  light,
  disc,
}: {
  at: Point
  shown: number
  label: string
  light: { glow: number; color: string }
  disc: ReactNode
}) {
  const { local } = useShot()
  if (shown <= 0) return null
  const green = greenAt(local)
  const { glow, color } = light

  return (
    <div
      style={{
        position: 'absolute',
        left: at.x,
        top: at.y,
        opacity: clamp(shown * 2),
        transform: `translate(-50%, -50%) scale(${mix(0.55, 1, ease.outBack(shown)) * (1 + 0.06 * glow)})`,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          height: 56,
          padding: '0 24px 0 9px',
          borderRadius: 999,
          background: 'rgb(24 19 17 / 0.96)',
          border: `1px solid rgb(255 255 255 / ${0.14 + 0.3 * glow})`,
          boxShadow: [
            `0 0 0 ${2 * glow}px ${alpha(color, glow)}`,
            `0 0 ${22 + 40 * glow}px ${alpha(color, 0.2 + 0.55 * glow)}`,
            `0 0 0 ${2 * green}px rgb(52 211 153 / ${green})`,
            `0 0 46px rgb(16 185 129 / ${0.6 * green})`,
            '0 16px 34px -10px rgb(0 0 0 / 0.7)',
          ].join(', '),
          whiteSpace: 'nowrap',
          fontSize: 28,
          fontWeight: 600,
          letterSpacing: '-0.01em',
          color: 'white',
        }}
      >
        {disc}
        {label}
      </div>
    </div>
  )
}

/** Someone in the room, as the room's participant stack draws them. */
function Disc({
  color,
  lift = 0,
  first = false,
  children,
}: {
  color: string
  lift?: number
  first?: boolean
  children: ReactNode
}) {
  return (
    <span
      style={{
        position: 'relative',
        display: 'grid',
        placeItems: 'center',
        width: 34,
        height: 34,
        marginLeft: first ? 0 : -9,
        borderRadius: 999,
        background: color,
        boxShadow: `0 0 0 3px #24150f, 0 0 ${20 * lift}px ${5 * lift}px ${alpha(color.startsWith('#') ? color : BRAND, 0.9 * lift)}`,
        transform: `scale(${1 + 0.32 * lift})`,
        zIndex: lift > 0.05 ? 2 : 1,
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: '0.02em',
        color: 'white',
      }}
    >
      {children}
    </span>
  )
}

/**
 * The room itself: the live dot, everyone in it, how many. Answers pass through it in their
 * writer's colour; the teacher's press turns it into a tick that marks both screens.
 */
function Room({ copy }: { copy: FilmCopy }) {
  const { local } = useShot()
  const shown = progress(local, AT.pill, 120)
  if (shown <= 0) return null

  const live = copy.promo.scenes.live
  const pop = progress(local, AT.pill, 460, outBackSoft)
  const { glow, color } = flare(local, AT_PILL, 220)
  // The press arrives: a white hit, and under it the pill becomes an emerald medal.
  const morph = progress(local, AT.relay, 260, outBackSoft)
  const solid = progress(local, AT.relay, 100, ease.outCubic)
  const hit =
    local < AT.relay - 10
      ? 0
      : interpolate(local, [AT.relay - 10, AT.relay + 30, AT.relay + 190], [0, 0.92, 0])
  const content = 1 - progress(local, AT.relay, 60, ease.outCubic)
  const tick = progress(local, AT.relay + 70, 220, ease.outCubic)
  const thump = pulseAt(local, AT.marks, 50, 240)
  const ping = (((local % 500) + 500) % 500) / 500
  const maksym = flare(local, [{ at: AT.haveOut - 40, color: MAKSYM }], 280).glow
  const olya = flare(
    local,
    AT_PILL.filter((spark) => spark.color === OLYA),
    280,
  ).glow

  return (
    <div
      style={{
        position: 'absolute',
        left: 540,
        top: PILL_Y,
        opacity: shown,
        transform: `translate(-50%, -50%) scale(${mix(0.4, 1, pop) * (1 + 0.06 * glow) * (1 + 0.14 * thump)})`,
      }}
    >
      <div
        style={{
          position: 'relative',
          width: mix(PILL.width, MEDAL, morph),
          height: mix(PILL.height, MEDAL, morph),
          borderRadius: 999,
          overflow: local >= AT.relay ? 'hidden' : undefined,
          background: 'linear-gradient(180deg, rgb(44 24 17 / 0.97), rgb(20 12 10 / 0.97))',
          border: `1px solid rgb(255 130 70 / ${((0.45 + 0.3 * glow) * (1 - solid)).toFixed(3)})`,
          boxShadow: [
            `0 0 0 ${2 * glow}px ${alpha(color, glow)}`,
            `0 0 ${38 + 40 * glow}px ${alpha(color, 0.4 + 0.4 * glow)}`,
            `0 0 ${50 + 50 * thump}px ${14 * solid}px rgb(16 185 129 / ${(0.55 * solid).toFixed(3)})`,
            '0 0 38px rgb(255 79 1 / 0.4)',
            'inset 0 1px 0 rgb(255 255 255 / 0.14)',
            '0 18px 40px -12px rgb(0 0 0 / 0.7)',
          ].join(', '),
        }}
      >
        {solid > 0 ? (
          <span
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 999,
              background: `radial-gradient(circle at 34% 28%, #6ee7b7, ${EMERALD} 55%, #047857)`,
              boxShadow: 'inset 0 0 0 2px rgb(255 255 255 / 0.35)',
              opacity: solid,
            }}
          />
        ) : null}
        {content > 0 ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 13,
              opacity: content,
              whiteSpace: 'nowrap',
              fontSize: 28,
              fontWeight: 650,
              color: 'white',
            }}
          >
            <span style={{ position: 'relative', width: 16, height: 16, flexShrink: 0 }}>
              <span
                style={{
                  position: 'absolute',
                  inset: -ping * 12,
                  borderRadius: 999,
                  border: `2px solid ${LIVE_RED}`,
                  opacity: (1 - ping) * 0.85,
                }}
              />
              <span
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: 999,
                  background: LIVE_RED,
                  boxShadow: `0 0 ${10 + 10 * (1 - ping)}px ${LIVE_RED}`,
                }}
              />
            </span>
            <span style={{ display: 'flex', alignItems: 'center' }}>
              <Disc color={`linear-gradient(145deg, #ff7a33, ${BRAND} 45%, #e22f00)`} first>
                <GraduationCapIcon
                  color="white"
                  strokeWidth={2.4}
                  style={{ width: 18, height: 18 }}
                />
              </Disc>
              <Disc color={MAKSYM} lift={maksym}>
                {live.maksymInitials}
              </Disc>
              <Disc color={OLYA} lift={olya}>
                {live.olyaInitials}
              </Disc>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <UsersIcon color="white" strokeWidth={2.2} style={{ width: 24, height: 24 }} />
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>3</span>
            </span>
          </div>
        ) : null}
        {hit > 0.01 ? (
          <span
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 999,
              background:
                'radial-gradient(circle at 50% 45%, #ffffff, rgb(209 250 229 / 0.9) 60%, rgb(52 211 153 / 0.6))',
              opacity: hit,
            }}
          />
        ) : null}
        {tick > 0 ? (
          <svg
            aria-hidden
            viewBox="0 0 100 100"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              overflow: 'visible',
            }}
          >
            <path
              d="M 29 52 L 44 66 L 72 36"
              fill="none"
              stroke="#ffffff"
              strokeWidth={9}
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={1}
              strokeDasharray="1 1"
              strokeDashoffset={1 - tick}
            />
          </svg>
        ) : null}
      </div>
    </div>
  )
}

// ——— What travels, drawn flat over the set at where the 3D puts it. ———

/** A trip through the frame: when it leaves and lands, and where it is along the way. */
type Flight = { from: number; to: number; easing: Easing; path: (u: number) => Point }

const flightAt = (flight: Flight, t: number) =>
  flight.path(flight.easing(clamp((t - flight.from) / (flight.to - flight.from))))

/** Where the flight was a moment ago, newest first: the streak behind it. */
function trailOf(flight: Flight, t: number, step = 14, count = 8): Point[] {
  const points: Point[] = []
  for (let k = 0; k < count; k++) {
    const at = t - k * step
    if (at < flight.from) break
    points.push(flightAt(flight, Math.min(at, flight.to)))
  }
  return points
}

/** A light streak through recent positions: thick and bright at the head, thinning behind. */
function Streak({
  points,
  color,
  width,
}: {
  points: readonly Point[]
  color: string
  width: number
}) {
  if (points.length < 2) return null
  const n = points.length - 1

  return (
    <svg
      aria-hidden
      width={1080}
      height={1350}
      style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' }}
    >
      {points.slice(0, -1).map((p, k) => {
        const q = points[k + 1]!
        const fade = 1 - k / n
        return (
          <g key={k}>
            <line
              x1={p.x}
              y1={p.y}
              x2={q.x}
              y2={q.y}
              stroke={color}
              strokeOpacity={0.3 * fade}
              strokeWidth={width * 2.4 * fade + 2}
              strokeLinecap="round"
            />
            <line
              x1={p.x}
              y1={p.y}
              x2={q.x}
              y2={q.y}
              stroke="#ffffff"
              strokeOpacity={0.85 * fade}
              strokeWidth={width * 0.6 * fade + 1}
              strokeLinecap="round"
            />
          </g>
        )
      })}
    </svg>
  )
}

/** An answer in flight: the word on a pill of its writer's colour. */
function Chip({
  at,
  scale,
  opacity,
  color,
  word,
}: {
  at: Point
  scale: number
  opacity: number
  color: string
  word: string
}) {
  if (opacity <= 0.01) return null

  return (
    <div
      style={{
        position: 'absolute',
        left: at.x,
        top: at.y,
        opacity,
        transform: `translate(-50%, -50%) scale(${scale})`,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          height: 58,
          padding: '0 24px',
          borderRadius: 999,
          background: color,
          color: 'white',
          fontSize: 36,
          fontWeight: 650,
          letterSpacing: '-0.01em',
          lineHeight: 1,
          whiteSpace: 'nowrap',
          boxShadow: [
            '0 0 0 2px rgb(255 255 255 / 0.55)',
            `0 0 36px 8px ${alpha(color, 0.6)}`,
            '0 16px 30px -12px rgb(0 0 0 / 0.6)',
          ].join(', '),
        }}
      >
        {word}
      </div>
    </div>
  )
}

/** The size a chip shrinks to as it lands, to match the board's own 15px word. */
const LANDED = 0.42

/** Where a chip is as it lands: full size until the last stretch, then shrinking into the gap. */
function landing(local: number, flight: Flight): { scale: number; opacity: number } {
  const p = clamp((local - flight.from) / (flight.to - flight.from))
  return {
    scale: mix(1, LANDED, ease.inOutCubic(clamp((p - 0.6) / 0.4))),
    opacity: 1 - clamp((local - flight.to) / 60),
  }
}

/** Максим's word comes out of the room, then parts and drops onto both screens at once. */
function HaveChips({
  teacher,
  student,
  camera,
  pill,
}: {
  teacher: Pose
  student: Pose
  camera: Camera
  pill: Point
}) {
  const { local } = useShot()
  if (local < AT.haveOut || local > AT.have + 60) return null
  const hover = { x: pill.x, y: pill.y - 56 }

  if (local < HAVE_SPLIT) {
    const p = progress(local, AT.haveOut, HAVE_SPLIT - AT.haveOut)
    return (
      <Chip
        at={{ x: pill.x, y: mix(pill.y, hover.y, ease.outCubic(p)) }}
        scale={mix(0.3, 1, outBackSoft(p))}
        opacity={clamp(p * 3)}
        color={MAKSYM}
        word={WORDS.have}
      />
    )
  }

  return (
    <>
      {[cardPoint(teacher, SPOT.have, camera), cardPoint(student, SPOT.have, camera)].map(
        (gap, index) => {
          const out = gap.x < hover.x ? -1 : 1
          const flight: Flight = {
            from: HAVE_SPLIT,
            to: AT.have,
            easing: ease.inOutCubic,
            path: (u) =>
              cubicAt(
                hover,
                { x: hover.x + out * 170, y: hover.y - 30 },
                { x: gap.x, y: gap.y - 230 },
                gap,
                u,
              ),
          }
          const { scale, opacity } = landing(local, flight)
          return (
            <div key={index} className="absolute inset-0" style={{ opacity }}>
              <Streak points={trailOf(flight, local)} color={MAKSYM} width={10} />
              <Chip
                at={flightAt(flight, local)}
                scale={scale}
                opacity={1}
                color={MAKSYM}
                word={WORDS.have}
              />
            </div>
          )
        },
      )}
    </>
  )
}

/** Оля's word lifts off her screen, swoops through the room and lands on the teacher's. */
function CardChip({
  teacher,
  student,
  camera,
  pill,
}: {
  teacher: Pose
  student: Pose
  camera: Camera
  pill: Point
}) {
  const { local } = useShot()
  if (local < AT.cardOut || local > AT.card + 60) return null
  const from = cardPoint(student, SPOT.card, camera)
  const to = cardPoint(teacher, SPOT.card, camera)
  const lifted = { x: from.x, y: from.y - 46 }

  if (local < CARD_FLY) {
    const p = progress(local, AT.cardOut, CARD_FLY - AT.cardOut)
    return (
      <Chip
        at={{ x: from.x, y: mix(from.y, lifted.y, ease.outCubic(p)) }}
        scale={mix(LANDED, 1, outBackSoft(p))}
        opacity={clamp(p * 4)}
        color={OLYA}
        word={WORDS.card}
      />
    )
  }

  const flight: Flight = {
    from: CARD_FLY,
    to: AT.card,
    easing: inOutSine,
    path: (u) =>
      u < 0.5
        ? cubicAt(
            lifted,
            { x: lifted.x, y: lifted.y - 200 },
            { x: pill.x + 160, y: pill.y },
            pill,
            u * 2,
          )
        : cubicAt(pill, { x: pill.x - 160, y: pill.y }, { x: to.x, y: to.y - 230 }, to, u * 2 - 1),
  }
  const { scale, opacity } = landing(local, flight)

  return (
    <div className="absolute inset-0" style={{ opacity }}>
      <Streak points={trailOf(flight, local)} color={OLYA} width={10} />
      <Chip at={flightAt(flight, local)} scale={scale} opacity={1} color={OLYA} word={WORDS.card} />
    </div>
  )
}

/** The teacher's press, as light: from the button up into the room. */
function PressPacket({ teacher, camera, pill }: { teacher: Pose; camera: Camera; pill: Point }) {
  const { local } = useShot()
  if (local < AT.press + 20 || local > AT.relay + 60) return null
  const button = cardPoint(teacher, SPOT.check, camera)
  const flight: Flight = {
    from: AT.press + 20,
    to: AT.relay,
    easing: inOutSine,
    // Up the inside of the teacher's screen, clear of the tag, and into the room from below.
    path: (u) =>
      cubicAt(
        button,
        { x: button.x + 120, y: button.y - 200 },
        { x: pill.x - 60, y: pill.y + 140 },
        pill,
        u,
      ),
  }
  const head = flightAt(flight, local)
  const fade = 1 - clamp((local - AT.relay) / 60)
  // It gathers itself off the button rather than sitting on it.
  const born = progress(local, flight.from, 90, ease.outCubic)
  const size = 24 * mix(0.35, 1, born)

  return (
    <div className="absolute inset-0" style={{ opacity: fade }}>
      <Streak points={trailOf(flight, local, 16, 9)} color={BRAND} width={12} />
      <span
        aria-hidden
        style={{
          position: 'absolute',
          left: head.x - size / 2,
          top: head.y - size / 2,
          width: size,
          height: size,
          borderRadius: 999,
          background: '#ffffff',
          opacity: born,
          boxShadow: `0 0 26px 10px ${alpha(BRAND, 0.85)}, 0 0 60px 18px ${alpha(WARM, 0.4)}`,
        }}
      />
    </div>
  )
}

/** Two frames of mint over everything as both boards turn green. */
function MintFlash() {
  const { local } = useShot()
  if (local < AT.marks - 10 || local > AT.marks + 110) return null
  const amount = interpolate(
    local,
    [AT.marks - 10, AT.marks, AT.marks + 40, AT.marks + 110],
    [0, 1, 0.8, 0],
  )
  if (amount <= 0.001) return null
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{ background: MINT, opacity: 0.25 * amount }}
    />
  )
}

/**
 * The headline in two blocks: the plain words, then the accented ones in the brand colour,
 * each slamming in on its own beat. It drifts a hair against the turning set.
 */
function Headline({ text }: { text: string }) {
  const { local } = useShot()
  const words = parseAccents(text)
  const split = words.findIndex((word) => word.accent)
  const lead = split > 0 ? words.slice(0, split) : words
  const accent = split > 0 ? words.slice(split) : []
  const join = (list: typeof words) =>
    list.map(({ word, accent: on }) => (on ? `*${word}*` : word)).join(' ')
  const bloom =
    local < AT.accent + 250
      ? 0
      : interpolate(local, [AT.accent + 250, AT.accent + 450, AT.accent + 1300], [0, 1, 0.35])
  const slam = { scale: 1.5, blur: 16, opacity: 0, y: 0 }
  const drift = clamp((local - AT.lead) / 3350)

  return (
    <div
      style={{
        position: 'absolute',
        left: 90,
        top: 156,
        width: 900,
        textAlign: 'center',
        fontSize: 94,
        lineHeight: 1,
        fontWeight: 650,
        letterSpacing: '-0.04em',
        textShadow: '0 10px 40px rgb(0 0 0 / 0.45)',
        transform: `translateY(${-8 * drift}px) scale(${1 + 0.015 * drift})`,
      }}
    >
      <div>
        <KineticText
          text={join(lead)}
          at={AT.lead}
          stagger={AT.pill - AT.lead}
          duration={480}
          from={slam}
        />
      </div>
      {accent.length ? (
        <div
          style={{
            marginTop: 6,
            textShadow: `0 0 ${20 + 26 * bloom}px rgb(255 79 1 / ${0.55 * bloom})`,
          }}
        >
          <KineticText text={join(accent)} at={AT.accent} stagger={80} duration={480} from={slam} />
        </div>
      ) : null}
    </div>
  )
}
