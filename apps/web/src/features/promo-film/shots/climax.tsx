'use client'

import type { CSSProperties } from 'react'
import type { Cue } from '../audio/cues'
import type { FilmCopy } from '../copy'
import { Burst, Ring } from '../fx/effects'
import { Camera } from '../fx/space'
import { parseAccents } from '../fx/text'
import {
  BRAND,
  clamp,
  ease,
  HEIGHT,
  INK,
  interpolate,
  mix,
  progress,
  randoms,
  spring,
  useShot,
  WIDTH,
} from '../time'
import { PIECES, TOKENS, type Piece, type Token } from './climax-pieces'

/**
 * The climax (42–45 s): everything the film has shown comes back at once and orbits the
 * line "Усе в одному місці." — then falls into it.
 *
 * Shot-local ms, on the 120 BPM grid:
 *   −400  the pieces are pulled into orbit: nine product cards and twelve tokens swirl in
 *         from outside the frame and from behind the camera, streaking light, while the
 *         schedule's pieces spin away on their own ring and the dark closes over them
 *      0  every piece lands in its slot and the orbit locks (a pulse of light runs round
 *         the rails)
 *    500  the line slams into the empty nucleus (camera punch, shockwave); 800 a gloss
 *         crosses the accent word
 *   1000  the check passes the front and pops · 1500 the bell rings
 *   1150  the orbit spins up; the trails stretch into streaks of light, the camera rolls in
 *   2230  the collapse: every piece spirals into the nucleus and burns off into its own
 *         light; the line is sucked in with them, and the camera steers the point to where
 *         the `end` shot's mark is born
 *   2450  a single white-hot point remains; 2600 a last ring of light is drawn into it,
 *         it squeezes…
 *   2800  …and flashes — the `end` shot is born from it
 *
 * The 3D is solved here rather than left to the browser: every piece is projected from its
 * orbit by hand, so depth decides its size, blur, shade and stacking, and its light trail is
 * simply where it was a moment ago.
 */

/* ── timing ─────────────────────────────────────────────────────────────────────────── */

const T = {
  enter: -400,
  lock: 0,
  slam: 500,
  gloss: 800,
  glossMs: 340,
  beats: [0, 500, 1000, 1500, 2000],
  rampFrom: 1150,
  rampTo: 2650,
  collapse: 2230,
  collapseMs: 390,
  suck: 2250,
  suckMs: 280,
  point: 2450,
  inhale: 2600,
  squeeze: 2640,
  flash: 2800,
  end: 3300,
} as const

/** The tokens that pop on the beats, and when. */
const HIT_AT = { check: 1000, bell: 1500 } as const

/* ── the orbit, in 3D ───────────────────────────────────────────────────────────────── */

const RAD = Math.PI / 180

/** The camera's focal length, px: smaller is more dramatic. */
const FOCAL = 1300

/** Where the line sits and where everything falls. */
const NUCLEUS = { x: 540, y: 660 }

/**
 * Where the `end` shot's mark is born on screen (its entrance starts it 46px low of its rest
 * at y 505): the collapse is steered there, so the logo comes out of the point itself.
 */
const BIRTH = { x: 540, y: 551 }

/**
 * An orbit: a circle of `radius` round (cx, cy), tilted toward the camera by `tilt`
 * degrees (positive: seen from above, its front passes low) and rolled by `roll`.
 */
type Orbit = { cx: number; cy: number; radius: number; tilt: number; roll: number }

/**
 * The cards: seen well from above, so the front ones pass under the line and the back ones
 * over it, and narrow enough that the side cards stay in the frame.
 */
const CARD_RING: Orbit = { cx: 540, cy: 596, radius: 430, tilt: 53, roll: -9 }

/**
 * The tokens: seen from below and turning the other way, like a gyroscope's second ring —
 * so a token crosses a card in a moment instead of riding along on top of it.
 */
const TOKEN_RING: Orbit = { cx: 540, cy: 650, radius: 460, tilt: -48, roll: 22 }

/** How far a card turns away at the sides of the ring, degrees: edge-on enough to read as 3D. */
const YAW = 60

/** How much of the perspective's growth a card keeps at the front, so neighbours don't cover each other. */
const FRONT_GROWTH = 0.5

/** The cast in orbit. The AI draft stays out: the dialog already carries its topic, and nine cards have room. */
const CAST = PIECES.filter((piece) => piece.id !== 'draft')

type Point = { x: number; y: number; z: number; s: number }

/** A point of an orbit in the frame: its position, depth (z toward the camera) and scale. */
function project(orbit: Orbit, phi: number, radius: number, lift: number, boost: number): Point {
  const a = phi * RAD
  const lx = radius * Math.cos(a)
  const lz = radius * Math.sin(a)
  const tilt = orbit.tilt * RAD
  const y1 = lift * Math.cos(tilt) + lz * Math.sin(tilt)
  const z = Math.min(-lift * Math.sin(tilt) + lz * Math.cos(tilt) + boost, FOCAL - 220)
  const roll = orbit.roll * RAD
  const x2 = lx * Math.cos(roll) - y1 * Math.sin(roll)
  const y2 = lx * Math.sin(roll) + y1 * Math.cos(roll)
  const s = FOCAL / (FOCAL - z)
  return { x: orbit.cx + x2 * s, y: orbit.cy + y2 * s, z, s }
}

/** An orbit drawn in toward the nucleus as everything falls. */
function falling(orbit: Orbit, fall: number): Orbit {
  return { ...orbit, cx: mix(orbit.cx, NUCLEUS.x, fall), cy: mix(orbit.cy, NUCLEUS.y, fall) }
}

/** Degrees per second at rest, and how much the spin-up adds by its end. */
const REST_SPIN = 36
const RAMP_SPIN = 1650

/** Extra degrees turned by the spin-up: cubic, so it starts gently and runs away. */
function rampTurn(t: number): number {
  if (t <= T.rampFrom) return 0
  const span = T.rampTo - T.rampFrom
  const u = Math.min(1, (t - T.rampFrom) / span)
  const past = t > T.rampTo ? (RAMP_SPIN * (t - T.rampTo)) / 1000 : 0
  return ((RAMP_SPIN * span) / 3000) * u ** 3 + past
}

/** The cards turn clockwise on screen, the tokens (their ring seen from below) against them. */
const spinCards = (t: number) => (REST_SPIN * t) / 1000 + rampTurn(t)
const spinTokens = (t: number) => (58 * t) / 1000 + 0.8 * rampTurn(t)

/** 0 → 1: the orbits falling into the nucleus, slow then all at once. */
const collapseAt = (t: number) => progress(t, T.collapse, T.collapseMs, (x) => x ** 2.4)

/** The slam's shockwave reaching the orbit: a push outward that peaks and settles. */
function recoilAt(t: number): number {
  const since = t - (T.slam + 70)
  return since <= 0 ? 0 : (since / 110) * Math.exp(1 - since / 110)
}

/** A landing with a little weight: past the mark by ~4.5%, then settled, still on the beat. */
function landing(x: number): number {
  const back = 1.1
  return 1 + (back + 1) * (x - 1) ** 3 + back * (x - 1) ** 2
}

const inOutSine = (x: number) => (1 - Math.cos(Math.PI * x)) / 2

/** One thing in orbit, and how it arrives. */
type Orbiter = {
  ring: Orbit
  phase: number
  radius: number
  lift: number
  bob: number
  enterAt: number
  enterMs: number
  /** Degrees still to swing round when it starts arriving. */
  swing: number
  /** How far out it starts, as a multiple of its radius. */
  spread: number
  /** How far in front of the orbit (toward the camera) it starts. */
  boost: number
  spin: (t: number) => number
  /** It falls in a little before or after the others. */
  lag: number
}

type Place = Point & { phi: number; fall: number; arrive: number }

/** Where an orbiter is at `t`: a pure function of time, so its past is its light trail. */
function place(orbiter: Orbiter, t: number): Place {
  const x = clamp((t - orbiter.enterAt) / orbiter.enterMs)
  const arrive = ease.outCubic(x)
  const away = 1 - arrive
  const fall = collapseAt(t - orbiter.lag)
  const phi = orbiter.phase + orbiter.spin(t) + orbiter.swing * away ** 1.2
  const radius =
    orbiter.radius * mix(orbiter.spread, 1, landing(x)) * (1 - fall) * (1 + 0.05 * recoilAt(t))
  const lift = (orbiter.lift + Math.sin(t / 640 + orbiter.bob) * 9) * (1 - fall)
  const point = project(falling(orbiter.ring, fall), phi, radius, lift, orbiter.boost * away * away)
  return { ...point, phi, fall, arrive }
}

/** Screen speed, px per ms. */
function speedOf(orbiter: Orbiter, t: number, now: Place): number {
  const before = place(orbiter, t - 16)
  return Math.hypot(now.x - before.x, now.y - before.y) / 16
}

// Every piece lands in its slot exactly on the lock: the later it sets off, the faster it flies.
const CARD_ORBITS: Orbiter[] = CAST.map((_, index) => {
  const [r1 = 0.5, r2 = 0.5, r3 = 0.5] = randoms(4100 + index, 3)
  const enterAt = T.enter + index * 9
  return {
    ring: CARD_RING,
    phase: 90 + (index * 360) / CAST.length,
    radius: CARD_RING.radius + (r1 - 0.5) * 20,
    lift: (r2 - 0.5) * 24,
    bob: r3 * Math.PI * 2,
    enterAt,
    enterMs: T.lock - enterAt,
    swing: -165,
    spread: 2.1,
    boost: 950,
    spin: spinCards,
    lag: (r3 - 0.5) * 70,
  }
})

const TOKEN_ORBITS: Orbiter[] = TOKENS.map((_, index) => {
  const [r1 = 0.5, r2 = 0.5, r3 = 0.5] = randoms(5200 + index, 3)
  const enterAt = T.enter + 70 + index * 8
  return {
    ring: TOKEN_RING,
    // The check starts where the ring brings it to the front (90°) on its beat; the bell,
    // a slot behind it, arrives there on the next one.
    phase: 90 - spinTokens(HIT_AT.check) - index * 30,
    radius: TOKEN_RING.radius + (r1 - 0.5) * 20,
    lift: (r2 - 0.5) * 20,
    bob: r3 * Math.PI * 2,
    enterAt,
    enterMs: T.lock - enterAt,
    swing: -170,
    spread: 2.2,
    boost: 700,
    spin: spinTokens,
    lag: (r3 - 0.5) * 50,
  }
})

/* ── small helpers ──────────────────────────────────────────────────────────────────── */

/** A kick on every beat while the orbit holds: 1 on the beat, gone after ~250 ms. */
function beatPulse(t: number): number {
  if (t < 0 || t > 2300) return 0
  return Math.exp(-(t % 500) / 110)
}

/** A pop: up in 90 ms, then settles. */
function bump(since: number): number {
  if (since < 0) return 0
  return since < 90 ? ease.outCubic(since / 90) : Math.exp(-(since - 90) / 170)
}

const build = (t: number) => progress(t, 1300, 1100, ease.inOutCubic)

/** A depth (z toward the camera) → a stacking order: the far side under the line, the near over it. */
const depthOrder = (z: number) => 3000 + 2 * Math.round(z)

/* ── the camera ─────────────────────────────────────────────────────────────────────── */

type CameraPose = { zoom: number; roll: number; x: number; y: number }

/**
 * Eases back as the pieces arrive, nudges as the orbit locks, punches in on the slam,
 * pushes and rolls with the spin-up, then dives into the point.
 */
function drift(time: number): CameraPose {
  const settle = 1 - progress(time, T.enter, T.lock - T.enter, ease.outCubic)
  const lock = time >= T.lock ? 0.012 * Math.exp(-(time - T.lock) / 140) : 0
  const punch =
    time >= T.slam ? 0.03 * (1 - spring(time - T.slam, { stiffness: 320, damping: 20 })) : 0
  const dive = progress(time, 2280, 520, ease.inCubic)
  return {
    zoom:
      1 +
      0.07 * settle +
      lock +
      punch +
      0.012 * Math.sin(time / 1250) +
      0.055 * build(time) +
      0.2 * dive,
    roll: -1.1 * Math.sin(time / 1900) - 3.5 * build(time) - 6 * dive,
    x: 7 * Math.sin(time / 1700),
    y: 5 * Math.cos(time / 2100),
  }
}

/**
 * The camera. While everything falls, it steers so the nucleus comes to rest where the next
 * shot's mark is born — pinned there exactly through the dive's last zoom and roll.
 */
function cameraAt(t: number): CameraPose {
  const time = Math.min(t, T.flash)
  const pose = drift(time)
  const aim = progress(time, 2100, 450, ease.inOutCubic)
  if (aim <= 0) return pose
  const natural = throughCamera(NUCLEUS, pose)
  const gx = (mix(natural.x, BIRTH.x, aim) - WIDTH / 2) / pose.zoom
  const gy = (mix(natural.y, BIRTH.y, aim) - HEIGHT / 2) / pose.zoom
  const back = -pose.roll * RAD
  return {
    ...pose,
    x: NUCLEUS.x - WIDTH / 2 - (gx * Math.cos(back) - gy * Math.sin(back)),
    y: NUCLEUS.y - HEIGHT / 2 - (gx * Math.sin(back) + gy * Math.cos(back)),
  }
}

/** Where a point of the world lands in the frame through the camera (as `Camera` draws it). */
function throughCamera(point: { x: number; y: number }, camera: CameraPose) {
  const dx = (point.x - WIDTH / 2 - camera.x) * camera.zoom
  const dy = (point.y - HEIGHT / 2 - camera.y) * camera.zoom
  const roll = camera.roll * RAD
  return {
    x: WIDTH / 2 + dx * Math.cos(roll) - dy * Math.sin(roll),
    y: HEIGHT / 2 + dx * Math.sin(roll) + dy * Math.cos(roll),
  }
}

/* ── light ──────────────────────────────────────────────────────────────────────────── */

/**
 * A streak along `points` (head first), tapering to a point at the tail. A core is widest
 * at its head; a glow (`gathered`) swells just behind it instead, so the head reads as one
 * hot point rather than a blunt round end.
 */
function ribbon(points: Point[], width: number, gathered = false): string {
  const last = points.length - 1
  const left: string[] = []
  const right: string[] = []
  let cap = 0
  for (let k = 0; k <= last; k++) {
    const newer = points[Math.max(0, k - 1)]!
    const older = points[Math.min(last, k + 1)]!
    const dx = newer.x - older.x
    const dy = newer.y - older.y
    const length = Math.hypot(dx, dy) || 1
    const u = k / last
    const half = (width / 2) * (1 - u) ** 0.85 * (gathered ? Math.min(1, (u + 0.16) / 0.4) : 1)
    if (k === 0) cap = half
    const nx = (-dy / length) * half
    const ny = (dx / length) * half
    const p = points[k]!
    left.push(`${(p.x + nx).toFixed(1)} ${(p.y + ny).toFixed(1)}`)
    right.push(`${(p.x - nx).toFixed(1)} ${(p.y - ny).toFixed(1)}`)
  }
  const r = cap.toFixed(1)
  return `M${left.join('L')}L${right.reverse().join('L')}A${r} ${r} 0 0 1 ${left[0]}Z`
}

/**
 * The streak an orbiter leaves: the path it took over the last moment, widest and hottest
 * at its head and tapering to nothing — a wide orange haze, a glow, a white-hot core. The
 * layers are screened, so where streaks cross the light adds up instead of greying.
 */
function Trail({
  id,
  orbiter,
  t,
  head,
  speed,
  width,
  zIndex,
  strength,
}: {
  id: string
  orbiter: Orbiter
  t: number
  head: Place
  speed: number
  width: number
  zIndex: number
  strength: number
}) {
  const span = clamp((speed - 0.55) * 80, 0, 150)
  const glow = clamp((speed - 0.55) / 2.2) * strength
  if (span < 12 || glow <= 0.01) return null

  const steps = span > 70 ? 22 : 11
  const points: Point[] = [head]
  for (let k = 1; k <= steps; k++) points.push(place(orbiter, t - (span * k) / steps))
  const tail = points[steps]!

  return (
    <svg
      width={WIDTH}
      height={HEIGHT}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        zIndex,
        overflow: 'visible',
        mixBlendMode: 'screen',
      }}
    >
      <defs>
        <linearGradient
          id={id}
          gradientUnits="userSpaceOnUse"
          x1={head.x}
          y1={head.y}
          x2={tail.x}
          y2={tail.y}
        >
          <stop offset="0" stopColor="#fff6ef" />
          <stop offset="0.22" stopColor="#ffc29a" />
          <stop offset="0.6" stopColor="#ff7a2e" stopOpacity={0.6} />
          <stop offset="1" stopColor={BRAND} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={ribbon(points, width, true)} fill={BRAND} opacity={0.17 * glow} />
      <path d={ribbon(points, width * 0.4, true)} fill="#ff7a2e" opacity={0.32 * glow} />
      <path d={ribbon(points, Math.max(3.5, width * 0.075))} fill={`url(#${id})`} opacity={glow} />
    </svg>
  )
}

/**
 * The warm light the line sits in: gathers itself in the empty nucleus before the slam,
 * breathes on the beat, swells with the spin-up.
 */
function Core({ t }: { t: number }) {
  if (t >= T.flash) return null
  const on = progress(t, T.enter + 100, 500, ease.outCubic)
  const kick = beatPulse(t)
  const charge = progress(t, 150, T.slam - 150, ease.inCubic) * (1 - progress(t, T.slam, 160))
  const slam = bump(t - T.slam) + charge
  const fall = collapseAt(t)
  const outer = mix(1000, 420, fall)
  const inner = mix(470, 200, fall) * (1 - 0.18 * charge)
  const disc = (size: number): CSSProperties => ({
    position: 'absolute',
    left: NUCLEUS.x - size / 2,
    top: NUCLEUS.y - size / 2,
    width: size,
    height: size,
    borderRadius: '50%',
  })

  return (
    <>
      <div
        style={{
          ...disc(outer),
          zIndex: 10,
          opacity: on * (0.26 + 0.07 * kick + 0.14 * build(t) + 0.12 * slam) + 0.35 * fall,
          background: `radial-gradient(circle, ${BRAND} 0%, rgb(255 79 1 / 0.4) 30%, transparent 68%)`,
        }}
      />
      <div
        style={{
          ...disc(inner),
          zIndex: 11,
          opacity:
            on * (0.12 + 0.05 * kick + 0.12 * build(t) + 0.2 * slam + 0.25 * charge) + 0.5 * fall,
          background:
            'radial-gradient(circle, #ffe2cc 0%, rgb(255 170 120 / 0.5) 35%, transparent 70%)',
        }}
      />
    </>
  )
}

/**
 * The stage clears: as the orbit locks, the dark closes over whatever the last shot left
 * swirling round the middle; the light comes back with the line, thinning the dark to a
 * shade that keeps it clear.
 */
function Scrim({ t }: { t: number }) {
  if (t >= T.flash) return null
  const amount = interpolate(
    t,
    [-220, 40, T.slam - 20, 1100],
    [0, 0.96, 0.96, 0.25],
    [ease.inOutCubic, ease.linear, ease.inOutCubic],
  )
  if (amount <= 0.005) return null
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        opacity: amount,
        background: `radial-gradient(ellipse 980px 700px at 540px 690px, ${INK} 0%, ${INK} 60%, transparent 100%)`,
      }}
    />
  )
}

/** One orbit's rail as a path, from `from` to `to` degrees, wherever the orbit is now. */
function railPath(orbit: Orbit, t: number, from = 90, to = 450, step = 6): string {
  const fall = collapseAt(t)
  const ring = falling(orbit, fall)
  let d = ''
  for (let phi = from, k = 0; phi <= to + 0.01; phi += step, k++) {
    const p = project(ring, phi, orbit.radius * (1 - fall), 0, 0)
    d += `${k ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`
  }
  return d
}

/**
 * On every beat a pulse of light runs from the front of the card orbit round both sides
 * to the back — each stretch stacked at its own depth, so the far cards pass over it.
 */
function BeatPulses({ t }: { t: number }) {
  const fade = 1 - progress(t, T.collapse, T.collapseMs, ease.inCubic)
  const live = T.beats.filter((beat) => t > beat && t < beat + 560)
  if (fade <= 0 || live.length === 0) return null
  const ring = falling(CARD_RING, collapseAt(t))
  const radius = CARD_RING.radius * (1 - collapseAt(t))

  return (
    <>
      {live.flatMap((beat) => {
        const p = progress(t, beat, 560, ease.outCubic)
        const reach = 180 * p
        const strength = (1 - p) * (beat === T.lock ? 1 : 0.85) * fade
        return [1, -1].map((side) => {
          const at = 90 + side * reach
          const d = railPath(CARD_RING, t, at - 20, at + 20, 2)
          const z = project(ring, at, radius, 0, 0).z
          return (
            <svg
              key={`${beat}${side}`}
              width={WIDTH}
              height={HEIGHT}
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                zIndex: depthOrder(z) - 1,
                overflow: 'visible',
              }}
            >
              <g opacity={strength}>
                <path
                  d={d}
                  fill="none"
                  stroke="#ff8a4c"
                  strokeWidth={14}
                  strokeLinecap="round"
                  opacity={0.18}
                />
                <path d={d} fill="none" stroke="#fff0e6" strokeWidth={3.5} strokeLinecap="round" />
              </g>
            </svg>
          )
        })
      })}
    </>
  )
}

/** The orbits' rails: they draw themselves in as the pieces arrive and brighten as the spin builds. */
function Rails({ t }: { t: number }) {
  const draw = progress(t, -380, 400, ease.inOutCubic)
  const fade = 1 - progress(t, T.collapse, T.collapseMs, ease.inCubic)
  if (draw <= 0 || fade <= 0) return null

  return (
    <svg
      width={WIDTH}
      height={HEIGHT}
      style={{ position: 'absolute', left: 0, top: 0, zIndex: 20, overflow: 'visible' }}
    >
      <path
        d={railPath(CARD_RING, t)}
        fill="none"
        stroke="#ffd2b8"
        strokeWidth={1.6}
        pathLength={1}
        strokeDasharray="1 1"
        strokeDashoffset={1 - draw}
        opacity={(0.16 + 0.24 * build(t)) * fade}
      />
      <path
        d={railPath(TOKEN_RING, t)}
        fill="none"
        stroke="#ffd2b8"
        strokeWidth={1.3}
        pathLength={1}
        strokeDasharray="1 1"
        strokeDashoffset={1 - draw}
        opacity={(0.1 + 0.16 * build(t)) * fade}
      />
    </svg>
  )
}

/** Motes of light circling with the orbit, drawn out into streaks as it speeds up. */
const MOTES = Array.from({ length: 28 }, (_, index) => {
  const [a = 0, r = 0, f = 0, s = 0, o = 0] = randoms(8800 + index, 5)
  return {
    phase: a * 360,
    radius: mix(250, 780, r),
    rate: mix(0.45, 1.1, f),
    size: mix(1.6, 3.6, s),
    alpha: mix(0.3, 0.85, o),
    lag: (r - 0.5) * 120,
  }
})

function motePosition(mote: (typeof MOTES)[number], t: number) {
  const fall = collapseAt(t - mote.lag)
  const angle = (mote.phase + spinCards(t) * mote.rate) * RAD
  const radius = mote.radius * (1 - fall)
  const x = Math.cos(angle) * radius
  const y = Math.sin(angle) * radius * 0.6
  const roll = CARD_RING.roll * RAD
  return {
    x: NUCLEUS.x + x * Math.cos(roll) - y * Math.sin(roll),
    y: NUCLEUS.y - 20 + x * Math.sin(roll) + y * Math.cos(roll),
    fall,
  }
}

function Motes({ t }: { t: number }) {
  const on = progress(t, -250, 600)
  if (on <= 0 || t >= T.collapse + T.collapseMs + 120) return null

  return (
    <>
      {MOTES.map((mote, index) => {
        const now = motePosition(mote, t)
        const before = motePosition(mote, t - 16)
        const speed = Math.hypot(now.x - before.x, now.y - before.y) / 16
        const heading = Math.atan2(now.y - before.y, now.x - before.x) / RAD
        const length = mote.size + speed * 22
        const opacity =
          mote.alpha * on * (0.65 + 0.35 * Math.sin(t / 240 + index)) * (1 - now.fall ** 2)
        if (opacity <= 0.01) return null
        return (
          <span
            key={index}
            style={{
              position: 'absolute',
              left: now.x - length,
              top: now.y - mote.size / 2,
              width: length,
              height: mote.size,
              zIndex: 30,
              borderRadius: 99,
              opacity,
              transformOrigin: '100% 50%',
              transform: `rotate(${heading.toFixed(2)}deg)`,
              background: 'linear-gradient(90deg, transparent, #ffe2cc)',
              boxShadow: '0 0 6px rgb(255 160 100 / 0.8)',
            }}
          />
        )
      })}
    </>
  )
}

/** Rays rushing into the nucleus as everything falls: the implosion's speed lines. */
const RAYS = Array.from({ length: 40 }, (_, index) => {
  const [a = 0, r = 0, l = 0, s = 0, w = 0] = randoms(7300 + index, 5)
  return {
    angle: a * 360,
    from: mix(460, 1000, r),
    length: mix(70, 240, l),
    start: mix(2120, 2470, s),
    width: mix(1.8, 3.6, w),
  }
})

function Rays({ t }: { t: number }) {
  if (t < 2100 || t > 2850) return null
  return (
    <>
      {RAYS.map((ray, index) => {
        const p = progress(t, ray.start, 340, ease.inCubic)
        if (p <= 0 || p >= 1) return null
        const r = ray.from * (1 - p)
        const opacity = clamp(p * 5) * clamp(r / 60) * 0.9
        if (opacity <= 0.01) return null
        return (
          <span
            key={index}
            style={{
              position: 'absolute',
              left: NUCLEUS.x,
              top: NUCLEUS.y - ray.width / 2,
              width: ray.length * (0.6 + p),
              height: ray.width,
              zIndex: 7000,
              borderRadius: 99,
              opacity,
              transformOrigin: '0 50%',
              transform: `rotate(${(ray.angle + 70 * p).toFixed(2)}deg) translateX(${r.toFixed(1)}px)`,
              background:
                'linear-gradient(90deg, rgb(255 240 228), rgb(255 150 90 / 0.55) 45%, rgb(255 79 1 / 0))',
            }}
          />
        )
      })}
    </>
  )
}

/* ── the cast ───────────────────────────────────────────────────────────────────────── */

/**
 * How present an orbiter is: it fades in as it arrives; falling, the piece itself burns off
 * half way in while its light carries on to the point.
 */
function presence(orbiter: Orbiter, t: number, fall: number) {
  const appear = progress(t, orbiter.enterAt, 110)
  return {
    // Gone quickly at the end, so a burning card never lingers as a pale ghost.
    body: appear * (1 - progress(fall, 0.22, 0.34, ease.inCubic)),
    light: appear * (1 - progress(fall, 0.82, 0.18)) * (1 + 0.6 * fall),
  }
}

function OrbitCard({
  piece,
  orbiter,
  index,
  t,
  copy,
}: {
  piece: Piece
  orbiter: Orbiter
  index: number
  t: number
  copy: FilmCopy
}) {
  const p = place(orbiter, t)
  const { body: opacity, light } = presence(orbiter, t, p.fall)
  if (opacity <= 0.001 && light <= 0.001) return null

  const speed = speedOf(orbiter, t, p)
  // The cards face out of the ring: turned toward the sides, flat to the camera in front.
  const yaw = YAW * Math.cos(p.phi * RAD) * (1 - p.fall)
  const depth = clamp(-p.z / 280)
  const front = clamp(p.z / 260)
  const blur = depth * 2 + clamp((speed - 1) * 1.3, 0, 8) + 6 * p.fall
  // Flying in from behind the camera they keep the whole perspective; in the ring the front
  // ones grow only half as much, so they stop covering their neighbours.
  const growth = p.s <= 1 ? p.s : 1 + (p.s - 1) * mix(1, FRONT_GROWTH, p.arrive)
  const scale = growth * (1 - p.fall) ** 0.6
  const turn = CARD_RING.roll * 0.5 + 220 * p.fall ** 2
  // Far cards sink into the dark; turned ones shade toward their far edge; falling ones
  // heat up into light.
  const dim = depth * 0.38 * (1 - p.fall)
  const side = (Math.abs(yaw) / YAW) * 0.26
  const heat = clamp(p.fall * 2.6) * 0.92

  return (
    <>
      <Trail
        id={`climax-card-${index}`}
        orbiter={orbiter}
        t={t}
        head={p}
        speed={speed}
        width={110 * p.s * (1 - p.fall) ** 0.3}
        zIndex={depthOrder(p.z)}
        strength={light}
      />
      {opacity <= 0.001 ? null : (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            zIndex: depthOrder(p.z) + 1,
            opacity,
            transform: `translate(${p.x.toFixed(2)}px, ${p.y.toFixed(2)}px) translate(-50%, -50%) perspective(900px) rotateZ(${turn.toFixed(2)}deg) rotateY(${yaw.toFixed(2)}deg) rotateX(-7deg) scale(${scale.toFixed(4)})`,
            filter: blur > 0.25 ? `blur(${blur.toFixed(2)}px)` : undefined,
          }}
        >
          <div
            style={{
              position: 'relative',
              width: piece.width,
              borderRadius: piece.radius,
              overflow: 'hidden',
              background: 'white',
              color: '#171717',
              boxShadow: [
                'inset 0 1px 0 rgb(255 255 255 / 0.7)',
                '0 30px 60px -24px rgb(0 0 0 / 0.8)',
                `0 0 70px -12px rgb(255 79 1 / ${(0.15 + 0.3 * front + 0.5 * heat).toFixed(3)})`,
              ].join(', '),
            }}
          >
            {piece.render(copy, t)}
            {dim + side > 0.005 ? (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: `linear-gradient(${yaw >= 0 ? 90 : 270}deg, rgb(11 9 8 / ${dim.toFixed(3)}) 15%, rgb(11 9 8 / ${(dim + side).toFixed(3)}) 100%)`,
                }}
              />
            ) : null}
            {heat > 0.005 ? (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background:
                    'radial-gradient(120% 140% at 50% 50%, #fff4ec 0%, #ffc49e 55%, #ff8a4c 100%)',
                  opacity: heat,
                }}
              />
            ) : null}
          </div>
        </div>
      )}
    </>
  )
}

const EMERALD = '#10b981'

function OrbitToken({
  token,
  orbiter,
  index,
  t,
  copy,
}: {
  token: Token
  orbiter: Orbiter
  index: number
  t: number
  copy: FilmCopy
}) {
  const p = place(orbiter, t)
  const { body: opacity, light } = presence(orbiter, t, p.fall)
  if (opacity <= 0.001 && light <= 0.001) return null

  const speed = speedOf(orbiter, t, p)
  const depth = clamp(-p.z / 380)
  const hitAt = token.hit ? HIT_AT[token.hit] : null
  const hit = hitAt === null ? 0 : bump(t - hitAt)
  const ring = hitAt === null ? 0 : progress(t, hitAt, 560, ease.outCubic)
  const scale = p.s * (1 - p.fall) ** 0.6 * (1 + 0.42 * hit)
  const blur = depth * 1.6 + clamp((speed - 1) * 1.1, 0, 7) + 5 * p.fall
  const swing =
    token.hit === 'bell' && hitAt !== null && t > hitAt
      ? 24 * Math.exp(-(t - hitAt) / 380) * Math.sin((t - hitAt) / 62)
      : 0
  const filters = [
    blur > 0.25 ? `blur(${blur.toFixed(2)}px)` : '',
    depth > 0.02 ? `brightness(${(1 - depth * 0.35).toFixed(3)})` : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <>
      <Trail
        id={`climax-token-${index}`}
        orbiter={orbiter}
        t={t}
        head={p}
        speed={speed}
        width={46 * p.s * (1 - p.fall) ** 0.3}
        zIndex={depthOrder(p.z)}
        strength={light * 0.8}
      />
      {opacity <= 0.001 ? null : (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            zIndex: depthOrder(p.z) + 1,
            opacity,
            transform: `translate(${p.x.toFixed(2)}px, ${p.y.toFixed(2)}px) translate(-50%, -50%) rotate(${(swing + 200 * p.fall ** 2).toFixed(2)}deg) scale(${scale.toFixed(4)})`,
            filter: filters || undefined,
          }}
        >
          <div style={{ position: 'relative', display: 'grid', placeItems: 'center' }}>
            {token.render(copy, t)}
            {ring > 0 && ring < 1 ? (
              <span
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: 56 + 90 * ring,
                  height: 56 + 90 * ring,
                  marginLeft: -(28 + 45 * ring),
                  marginTop: -(28 + 45 * ring),
                  borderRadius: '50%',
                  border: `3px solid ${token.hit === 'check' ? EMERALD : BRAND}`,
                  opacity: 1 - ring,
                }}
              />
            ) : null}
          </div>
        </div>
      )}
    </>
  )
}

/* ── the line ───────────────────────────────────────────────────────────────────────── */

/** The line in up to three rows: before the accent, the accent alone, after it. */
function rowsOf(text: string): { text: string; accent: boolean }[] {
  const words = parseAccents(text)
  const first = words.findIndex((word) => word.accent)
  if (first < 0) return [{ text: words.map((word) => word.word).join(' '), accent: false }]
  let last = first
  while (words[last + 1]?.accent) last++
  const join = (from: number, to?: number) =>
    words
      .slice(from, to)
      .map((word) => word.word)
      .join(' ')
  return [
    { text: join(0, first), accent: false },
    { text: join(first, last + 1), accent: true },
    { text: join(last + 1), accent: false },
  ].filter((row) => row.text)
}

/**
 * The light that crosses the accent word once, as a background position (%), or null
 * outside it. Its hot middle is on the word's left edge on the sparkle cue and the whole
 * band is past its right edge at the end, so the sweep is all on the word.
 */
function glossAt(t: number): number | null {
  const p = progress(t, T.gloss, T.glossMs, inOutSine)
  return t >= T.gloss && p < 1 ? mix(74, 15, p) : null
}

function Headline({ text, t }: { text: string; t: number }) {
  const suck = progress(t, T.suck, T.suckMs, ease.inCubic)
  if (t < T.slam || suck >= 1) return null

  const rows = rowsOf(text)
  const kick = beatPulse(t)
  const swell = 1 + 0.035 * build(t)
  const gloss = glossAt(t)
  const blur = suck * 7

  return (
    <div
      style={{
        position: 'absolute',
        left: NUCLEUS.x,
        top: NUCLEUS.y,
        zIndex: 3000,
        transform: `translate(-50%, -50%) scale(${(swell * (1 - suck)).toFixed(4)}) rotate(${(42 * suck).toFixed(2)}deg)`,
        filter: blur > 0.2 ? `blur(${blur.toFixed(2)}px)` : undefined,
        opacity: 1 - suck ** 3,
        textAlign: 'center',
        whiteSpace: 'nowrap',
        fontWeight: 650,
        letterSpacing: '-0.04em',
        color: 'white',
      }}
    >
      {rows.map((row, index) => {
        const enter = progress(t, T.slam + index * 70, 560, ease.outExpo)
        // A longer row in another language steps down rather than leaving the orbit's middle.
        const size = Math.min(
          rows.length === 1 ? 124 : row.accent ? 140 : 104,
          880 / (row.text.length * 0.58),
        )
        const spread = (index - (rows.length - 1) / 2) * 50
        return (
          <div
            key={index}
            style={{
              display: 'block',
              fontSize: size,
              lineHeight: 0.94,
              opacity: clamp(enter * 1.8),
              transform: `translateY(${(spread * (1 - enter)).toFixed(2)}px) scale(${mix(1.5, 1, enter).toFixed(4)})`,
              filter: enter < 0.98 ? `blur(${((1 - enter) * 16).toFixed(2)}px)` : undefined,
            }}
          >
            {row.accent ? (
              <span
                style={{
                  display: 'inline-block',
                  padding: '0 0.05em',
                  backgroundImage: `linear-gradient(100deg, ${BRAND} 0%, ${BRAND} 44%, #ffb489 47.5%, #fff3ea 50%, #ffb489 52.5%, ${BRAND} 56%, ${BRAND} 100%)`,
                  backgroundSize: '300% 100%',
                  backgroundPosition: `${gloss ?? 100}% 50%`,
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  color: 'transparent',
                  filter: `drop-shadow(0 0 ${(22 + 14 * kick + 18 * build(t)).toFixed(1)}px rgb(255 79 1 / ${(0.5 + 0.2 * kick + 0.25 * build(t)).toFixed(3)}))`,
                }}
              >
                {row.text}
              </span>
            ) : (
              <span style={{ textShadow: '0 8px 36px rgb(0 0 0 / 0.5)' }}>{row.text}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ── the end of it ──────────────────────────────────────────────────────────────────── */

/**
 * The frame goes dark round the point while it gathers itself — under the light, so the
 * streaks and the point stay hot instead of greying.
 */
function Dim({ t }: { t: number }) {
  const amount = t >= T.flash ? 0 : interpolate(t, [2330, 2640], [0, 0.6], ease.inOutCubic)
  if (amount <= 0.001) return null
  return (
    <div
      style={{ position: 'absolute', inset: -400, zIndex: 5, background: INK, opacity: amount }}
    />
  )
}

/**
 * Everything is in one point: white-hot, flaring; a last ring of light is drawn into it,
 * and it squeezes before the flash.
 */
function Singularity({ t }: { t: number }) {
  if (t < T.point || t >= T.flash) return null
  const on = progress(t, T.point, 180, ease.outCubic)
  const squeeze = progress(t, T.squeeze, 150, ease.inCubic)
  const flicker = 1 + 0.08 * Math.sin(t / 23)
  const core = 34 * on * (1 - 0.5 * squeeze) * flicker
  const halo = 320 * on * (1 - 0.35 * squeeze)
  const streak = 760 * on * (1 + 0.4 * squeeze)
  const inhale = progress(t, T.inhale, 190, ease.inCubic)
  const ring = mix(260, 8, inhale)
  const at = (width: number, height: number): CSSProperties => ({
    position: 'absolute',
    left: -width / 2,
    top: -height / 2,
    width,
    height,
  })

  return (
    <div style={{ position: 'absolute', left: NUCLEUS.x, top: NUCLEUS.y, zIndex: 9000 }}>
      {inhale > 0 && inhale < 1 ? (
        <div
          style={{
            ...at(ring, ring),
            borderRadius: '50%',
            border: '2.5px solid rgb(255 226 204 / 0.9)',
            boxShadow: '0 0 18px rgb(255 140 60 / 0.7), inset 0 0 18px rgb(255 140 60 / 0.5)',
            opacity: interpolate(inhale, [0, 0.25, 1], [0, 0.9, 0.4]),
          }}
        />
      ) : null}
      <div
        style={{
          ...at(halo, halo),
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgb(255 250 245 / 0.95) 0%, rgb(255 140 60 / 0.6) 22%, rgb(255 79 1 / 0.22) 45%, transparent 70%)',
        }}
      />
      <div
        style={{
          ...at(streak, 3),
          background:
            'linear-gradient(90deg, transparent, rgb(255 236 224 / 0.9) 42%, white 50%, rgb(255 236 224 / 0.9) 58%, transparent)',
        }}
      />
      <div
        style={{
          ...at(2, streak * 0.24),
          background: 'linear-gradient(180deg, transparent, white 50%, transparent)',
        }}
      />
      <div
        style={{
          ...at(core, core),
          borderRadius: '50%',
          background: 'white',
          boxShadow: '0 0 24px 8px rgb(255 255 255 / 0.9), 0 0 70px 24px rgb(255 120 40 / 0.8)',
        }}
      />
    </div>
  )
}

/**
 * The flash: one white frame on the impact; then the light pulls back into the point — a
 * white-hot core in a saturated orange falloff that contracts and burns down — so the
 * frame's edges are dark again at once and only the point the next shot is born from stays
 * hot. (A white veil fading over the whole frame would only turn it milky grey.)
 */
function Bloom({ t, origin }: { t: number; origin: { x: number; y: number } }) {
  if (t < T.flash) return null
  const since = t - T.flash
  const white = since < 20 ? 1 : since < 50 ? 0.12 : 0
  const heat = Math.exp(-since / 170) * (1 - progress(t, T.end - 170, 150))
  const size = mix(2600, 760, progress(since, 0, 300, ease.outCubic))

  return (
    <>
      {heat > 0.005 ? (
        <div
          style={{
            position: 'absolute',
            left: origin.x - size / 2,
            top: origin.y - size / 2,
            width: size,
            height: size,
            borderRadius: '50%',
            opacity: heat,
            mixBlendMode: 'screen',
            background:
              'radial-gradient(circle, #fff6ee 0%, #ffd2b4 6%, rgb(255 140 60 / 0.75) 14%, rgb(255 90 20 / 0.35) 28%, rgb(255 79 1 / 0.1) 45%, transparent 62%)',
          }}
        />
      ) : null}
      {white > 0.005 ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: '#fff8f3',
            opacity: white,
            mixBlendMode: 'screen',
          }}
        />
      ) : null}
    </>
  )
}

/* ── the shot ───────────────────────────────────────────────────────────────────────── */

export function Shot({ copy }: { copy: FilmCopy }) {
  const { local: t } = useShot()
  if (t < T.enter || t >= T.end) return null

  const camera = cameraAt(t)

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <Scrim t={t} />
      <Camera zoom={camera.zoom} roll={camera.roll} x={camera.x} y={camera.y}>
        {/* Flat on purpose: depth is solved by hand above, and stacking follows z-index. */}
        <div
          style={{ position: 'absolute', inset: 0, transformStyle: 'flat', isolation: 'isolate' }}
        >
          <Core t={t} />
          <Rails t={t} />
          <BeatPulses t={t} />
          <Motes t={t} />
          {CARD_ORBITS.map((orbiter, index) => {
            const piece = CAST[index]
            return piece ? (
              <OrbitCard
                key={piece.id}
                piece={piece}
                orbiter={orbiter}
                index={index}
                t={t}
                copy={copy}
              />
            ) : null
          })}
          {TOKEN_ORBITS.map((orbiter, index) => {
            const token = TOKENS[index]
            return token ? (
              <OrbitToken
                key={token.id}
                token={token}
                orbiter={orbiter}
                index={index}
                t={t}
                copy={copy}
              />
            ) : null
          })}
          <Headline text={copy.film.climax} t={t} />
          <Rays t={t} />
          <Dim t={t} />
          <Singularity t={t} />
          <div style={{ position: 'absolute', inset: 0, zIndex: 9500 }}>
            <Ring
              at={T.slam}
              x={NUCLEUS.x}
              y={NUCLEUS.y}
              from={90}
              to={660}
              duration={720}
              color="rgb(255 138 76 / 0.85)"
              width={3}
            />
            <Ring
              at={T.flash}
              x={NUCLEUS.x}
              y={NUCLEUS.y}
              from={24}
              to={820}
              duration={460}
              color="#ffd9c2"
              width={6}
            />
            <Burst
              at={T.flash + 10}
              x={NUCLEUS.x}
              y={NUCLEUS.y}
              count={44}
              seed={42}
              shape="spark"
              speed={[900, 2300]}
              size={[3, 7]}
              life={[300, 470]}
              gravity={0}
              colors={['#ffffff', '#ffd2b8', BRAND]}
            />
          </div>
        </div>
      </Camera>
      <Bloom t={t} origin={throughCamera(NUCLEUS, camera)} />
    </div>
  )
}

/** Where a token is when it pops, as a stereo position. */
function panOf(orbiter: Orbiter | undefined, at: number): number {
  if (!orbiter) return 0
  return Math.round(clamp(((place(orbiter, at).x - 540) / 540) * 0.8, -0.7, 0.7) * 100) / 100
}

export const cues: readonly Cue[] = [
  // The pieces pulled into orbit, then the token ring after them; both land as the orbit locks.
  { at: T.enter, kind: 'whoosh', duration: 420, gain: 0.85 },
  { at: T.enter + 70, kind: 'whoosh', duration: 360, gain: 0.45, pan: 0.3 },
  { at: T.lock, kind: 'thud', gain: 0.75 },
  // The line slams into the nucleus; a glint crosses the accent.
  { at: T.slam, kind: 'impact', gain: 0.9 },
  { at: T.gloss, kind: 'sparkle', gain: 0.3 },
  // The marks pop as they pass the front, one per beat.
  { at: HIT_AT.check, kind: 'pop', gain: 0.5, pan: panOf(TOKEN_ORBITS[0], HIT_AT.check) },
  { at: HIT_AT.bell, kind: 'ding', gain: 0.32, pan: panOf(TOKEN_ORBITS[1], HIT_AT.bell) },
  // The spin-up builds to the flash; the collapse sucks everything in.
  { at: 1300, kind: 'riser', duration: 1500, gain: 0.8 },
  { at: 2200, kind: 'suck', duration: 430, gain: 0.95 },
  { at: T.inhale, kind: 'suck', duration: 200, gain: 0.5, pitch: 5 },
  // The flash, and the sparks it throws.
  { at: T.flash, kind: 'impact', gain: 1 },
  { at: T.flash + 15, kind: 'sparkle', gain: 0.45 },
]
