'use client'

import type { CSSProperties } from 'react'
import type { Cue } from '../audio/cues'
import type { FilmCopy } from '../copy'
import { Glow } from '../fx/backdrop'
import { Burst, Dust, Ring, whip } from '../fx/effects'
import { FilmPointer } from '../fx/pointer'
import { Layer, Space } from '../fx/space'
import { UiCard } from '../fx/surface'
import { KineticText, parseAccents, plain } from '../fx/text'
import { Replica } from '../replica'
import { BEAT, BRAND, clamp, ease, interpolate, mix, progress, spring, useShot } from '../time'
import { Bell, BellBadge, Dial, Face, PRESENCE, Reminder, type Person } from './schedule-parts'

/**
 * Chapter 07 — the week, and the reminder a quarter of an hour before a lesson.
 *
 * The real calendar whips in from the right with its grid still empty; the students' faces
 * drop onto it with weight on the beats — Оля's weekly series first, the rest of the week a
 * beat later — while a counter tallies them. The camera pushes in on today's 16:00 as the
 * rest of the week sinks into the dark; on the beat Оля's face pops out toward us, the week
 * drops away, and a clock of the hour before the lesson draws itself round from her face,
 * its last quarter counting back from 16:00 to 15:45. On the bar the bell strikes and the
 * product's own reminder springs up; a beat later Оля's own reminder stacks behind it, and
 * on the next one a pointer opens the lesson. Then everything is pulled into orbit.
 */

// ── The beats, in shot-local ms (120 BPM: a beat every 500) ─────────────────────────────

const SERIES = BEAT // Оля's Monday–Wednesday–Thursday series lands
const WEEK = 2 * BEAT // the rest of the week lands
const PUSH = 1050 // the camera leans in on today's 16:00
const ANTICIPATE = 1330 // today's 16:00 lifts, ready
const DIVE = 3 * BEAT // the face pops out, the week drops away
const CLOCK_AT = 1640 // the clock draws itself round from 12 o'clock, under the face
const BELL_AT = 1680 // the bell rises into it
const ARC_FROM = 1720 // the last quarter starts counting back
const STRIKE = 4 * BEAT // 15:45: the bell strikes, the reminder springs up
const ECHO = 5 * BEAT // Оля's own reminder
const CLICK = 6 * BEAT // the reminder opens the lesson
const ORBIT_AT = 3550 // pulled into orbit

export const cues: readonly Cue[] = [
  { at: -380, kind: 'whoosh', duration: 520, gain: 0.75, pan: 0.45 },
  { at: SERIES, kind: 'thud', gain: 0.85 },
  { at: WEEK, kind: 'thud', gain: 0.7, pitch: -2 },
  { at: WEEK + 135, kind: 'pop', gain: 0.32, pitch: 5 },
  { at: ANTICIPATE, kind: 'pop', gain: 0.32, pitch: 8 },
  { at: DIVE, kind: 'whoosh', duration: 420, gain: 0.55, pitch: -3 },
  { at: DIVE, kind: 'riser', duration: STRIKE - DIVE, gain: 0.5 },
  { at: STRIKE, kind: 'ding', gain: 1 },
  { at: STRIKE, kind: 'impact', gain: 0.75 },
  { at: ECHO, kind: 'ding', gain: 0.45, pitch: 5, pan: 0.15 },
  { at: CLICK, kind: 'click', gain: 0.6, pan: 0.4 },
  { at: ORBIT_AT + 30, kind: 'suck', duration: 800, gain: 0.6 },
]

// ── Shared arithmetic ───────────────────────────────────────────────────────────────────────

type Vec2 = { x: number; y: number }
type Vec3 = Vec2 & { z: number }
type Pose3 = { x: number; y: number; z: number; rotateX: number; rotateY: number; rotateZ: number }
/** A flat camera: the world point `look` is drawn at `anchor`, zoomed and rolled about it. */
type Cam = { anchor: Vec2; look: Vec2; zoom: number; roll: number }

const RAD = Math.PI / 180
const FULL: CSSProperties = { position: 'absolute', inset: 0 }
const inQuad = (x: number) => x * x

/** A smooth kick: 0 → 1 at `k` ms → back towards 0. */
function bump(dt: number, k: number): number {
  return dt <= 0 ? 0 : (dt / k) * Math.exp(1 - dt / k)
}

/** Where a point of the world lands in the frame through a camera, exactly as `cameraCss` draws it. */
function viaCamera(point: Vec2, cam: Cam): Vec2 {
  const dx = (point.x - cam.look.x) * cam.zoom
  const dy = (point.y - cam.look.y) * cam.zoom
  const c = Math.cos(cam.roll * RAD)
  const s = Math.sin(cam.roll * RAD)
  return { x: cam.anchor.x + dx * c - dy * s, y: cam.anchor.y + dx * s + dy * c }
}

function cameraCss(cam: Cam): CSSProperties {
  return {
    ...FULL,
    transformOrigin: '0 0',
    transform: `translate(${cam.anchor.x}px, ${cam.anchor.y}px) rotate(${cam.roll}deg) scale(${cam.zoom}) translate(${-cam.look.x}px, ${-cam.look.y}px)`,
  }
}

// ── Act one: the week ───────────────────────────────────────────────────────────────────────

/** The scene's clock while the grid is drawn and still empty (its faces come at 1280). */
const HOLD_MS = 1100
/** The toolbar and grid in the scene's 520×720 box, with a margin of the page around them. */
const CROP = { x: 22, y: 22, width: 476, height: 383 }
const S = 1.82
const CARD = { x: 540, y: 808, w: CROP.width * S, h: CROP.height * S }
/** The grid's face: 28px in the product. Оля's series lands a size up: it is the week's story. */
const FACE = 28 * S
const SERIES_SIZE = 1.2

const DEPTH = 1700
const ORIGIN = { x: 540, y: 675 }

/** Thursday 16:00 — today's lesson with Оля, the one the reminder is about. */
const TODAY_1600 = { x: 265, y: 212 }

type Lesson = { person: Person; x: number; y: number; land: number; series?: true; hero?: true }

/**
 * Each lesson's face where the grid places it (measured in the scene's box) and the moment
 * it lands. The series lands as one row; the rest of the week sweeps in a beat later.
 */
const LESSONS: Lesson[] = [
  { person: 'olya', x: 101, y: 212, land: SERIES, series: true },
  { person: 'olya', x: 210, y: 212, land: SERIES + 60, series: true },
  { person: 'olya', ...TODAY_1600, land: SERIES + 120, series: true, hero: true },
  { person: 'iryna', x: 156, y: 148, land: WEEK },
  { person: 'iryna', x: 319, y: 180, land: WEEK + 45 },
  { person: 'anna', x: 374, y: 244, land: WEEK + 90 },
  { person: 'maksym', x: 101, y: 308, land: WEEK + 135 },
  { person: 'maksym', x: 265, y: 308, land: WEEK + 180 },
  { person: 'dmytro', x: 156, y: 340, land: WEEK + 225 },
  { person: 'dmytro', x: 319, y: 340, land: WEEK + 270 },
]

/** The lesson's title, which the reminder carries — lesson content stays English. */
const LESSON_TITLE = 'Ordering food at a restaurant'

/** A face falls from this high (card px, straight at the camera) and shows only near the end. */
const FALL_MS = 300
const DROP_FROM = 1050
const SHOWN_FROM = 180
/** How close the camera leans in on today's 16:00. */
const PUSH_ZOOM = 1.3
/** Once its lesson has left it, the week drops out of the frame in this long. */
const DROP_MS = 190
const WEEK_GONE = DIVE + DROP_MS + 20

/** A lesson's spot on the card, in the card's own px from its top-left. */
const spot = (lesson: Vec2) => ({
  u: (lesson.x + 14 - CROP.x) * S,
  v: (lesson.y + 14 - CROP.y) * S,
})
const HERO = spot(TODAY_1600)
/** Today's 16:00, from the card's centre. */
const HERO_ON_CARD: Vec3 = { x: HERO.u - CARD.w / 2, y: HERO.v - CARD.h / 2, z: 0 }

/**
 * The focus on today's lesson, the way a product tour points at one thing: the week goes dark
 * round today's 16:00 cell (card px), with a soft edge.
 */
const FOCUS = { w: 150, h: 128, radius: 28, blur: 46 }

/** How dark the focus leaves a point of the card (0–1), matching the shadow's soft edge. */
function shadeAt(u: number, v: number): number {
  const qx = Math.abs(u - HERO.u) - (FOCUS.w / 2 - FOCUS.radius)
  const qy = Math.abs(v - HERO.v) - (FOCUS.h / 2 - FOCUS.radius)
  const outside =
    Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - FOCUS.radius
  const s = clamp((outside + FOCUS.blur) / (2 * FOCUS.blur))
  return s * s * (3 - 2 * s)
}

/**
 * The card's pose: it yaws in with the whip, turns a little toward us while the faces land,
 * dips under each beat's landing, then — once today's lesson has left it — drops away.
 */
function cardPose(t: number): Pose3 {
  const stops = [-400, 300, DIVE]
  const curves = [ease.outExpo, ease.inOutCubic]
  const dip = 9 * bump(t - SERIES, 70) + 6 * bump(t - WEEK, 70)
  const drop = progress(t, DIVE, DROP_MS, ease.inCubic)

  return {
    x: Math.sin(t / 700) * 3,
    y: dip + 900 * drop,
    z: -260 * drop,
    rotateX: interpolate(t, stops, [18, 14, 9], curves) + 26 * drop,
    rotateY: interpolate(t, stops, [26, 11, 5], curves),
    rotateZ: interpolate(t, stops, [-4, -1.5, -0.5], curves) + 4 * drop,
  }
}

/** A point of the card (from its centre) turned as CSS turns it: rotateZ, then Y, then X. */
function turnCard(point: Vec3, pose: Pose3): Vec3 {
  let { x, y, z } = point
  const cz = Math.cos(pose.rotateZ * RAD)
  const sz = Math.sin(pose.rotateZ * RAD)
  ;[x, y] = [x * cz - y * sz, x * sz + y * cz]
  const cy = Math.cos(pose.rotateY * RAD)
  const sy = Math.sin(pose.rotateY * RAD)
  ;[x, z] = [x * cy + z * sy, -x * sy + z * cy]
  const cx = Math.cos(pose.rotateX * RAD)
  const sx = Math.sin(pose.rotateX * RAD)
  ;[y, z] = [y * cx - z * sx, y * sx + z * cx]
  return { x, y, z }
}

/** Where a point of the card is drawn before the camera, and how much its depth enlarges it. */
function onCard(point: Vec3, pose: Pose3) {
  const p = turnCard(point, pose)
  const k = DEPTH / (DEPTH - (pose.z + p.z))
  return {
    x: ORIGIN.x + (CARD.x + pose.x + p.x - ORIGIN.x) * k,
    y: ORIGIN.y + (CARD.y + pose.y + p.y - ORIGIN.y) * k,
    k,
  }
}

/** The eye in the card's own space (from its centre): the card's pose undone in reverse. */
function eyeOnCard(pose: Pose3): Vec3 {
  let x = ORIGIN.x - (CARD.x + pose.x)
  let y = ORIGIN.y - (CARD.y + pose.y)
  let z = DEPTH - pose.z
  const cx = Math.cos(pose.rotateX * RAD)
  const sx = Math.sin(pose.rotateX * RAD)
  ;[y, z] = [y * cx + z * sx, -y * sx + z * cx]
  const cy = Math.cos(pose.rotateY * RAD)
  const sy = Math.sin(pose.rotateY * RAD)
  ;[x, z] = [x * cy - z * sy, x * sy + z * cy]
  const cz = Math.cos(pose.rotateZ * RAD)
  const sz = Math.sin(pose.rotateZ * RAD)
  ;[x, y] = [x * cz + y * sz, -x * sz + y * cz]
  return { x, y, z }
}

/**
 * How far a face `lift` px above its cell sits off it sideways. It hangs on the line from
 * the eye to the cell, so in the frame it never leaves its cell — it only shrinks onto it.
 */
function towardEye(cell: Vec2, lift: number, eye: Vec3): Vec2 {
  return { x: (lift * (eye.x - cell.x)) / eye.z, y: (lift * (eye.y - cell.y)) / eye.z }
}

/** Height above the grid: a fall that accelerates, then one small bounce. */
function dropHeight(t: number, land: number): number {
  if (t < land) {
    const p = clamp((t - (land - FALL_MS)) / FALL_MS)
    return DROP_FROM * (1 - p * p)
  }
  const dt = t - land
  return 12 * Math.exp(-dt / 70) * Math.abs(Math.sin((dt / 150) * Math.PI))
}

function heroLift(t: number): number {
  return 34 * spring(t - ANTICIPATE, { stiffness: 260, damping: 18 })
}

function heroScale(t: number): number {
  return 1 + 0.12 * spring(t - ANTICIPATE, { stiffness: 260, damping: 18 })
}

/**
 * Act one's camera: a drift, a punch on each beat's landing, then a push onto today's 16:00
 * that brings it to the middle of the frame for the moment it leaves.
 */
function cameraOne(t: number): Cam {
  const push = progress(t, PUSH, DIVE - PUSH, ease.inOutCubic)
  const hero = onCard(HERO_ON_CARD, cardPose(Math.min(t, DIVE)))
  const punch = 0.025 * bump(t - SERIES, 60) + 0.025 * bump(t - WEEK, 60)
  return {
    anchor: ORIGIN,
    look: {
      x: mix(ORIGIN.x, hero.x, push) + Math.sin(t / 1300) * 6,
      y: mix(ORIGIN.y, hero.y, push) + Math.cos(t / 1700) * 5,
    },
    zoom: mix(1, PUSH_ZOOM, push) * (1 + punch),
    roll: Math.sin(t / 1900) * 0.35,
  }
}

// ── Act two: the clock, the bell and the reminder, standing in depth ──────────────────────

const STAGE_DEPTH = 1800
/** The clock at the back with Оля's face on it, the strike's light, the bell, the reminders nearest. */
const Z = { dial: -250, face: -246, strike: 20, bell: 40, back: 120, toast: 160 }
const DIAL = { x: 540, y: 712 }
const DIAL_R = 232
/** How much the stage's perspective enlarges a layer at depth `z`. */
const depthScale = (z: number) => STAGE_DEPTH / (STAGE_DEPTH - z)
/** The point of a layer at depth `z` that the perspective draws at (x, y), the stage unturned. */
const atDepth = (x: number, y: number, z: number): Vec2 => ({
  x: DIAL.x + (x - DIAL.x) / depthScale(z),
  y: DIAL.y + (y - DIAL.y) / depthScale(z),
})

/** Оля's face rests on the clock's 12 o'clock, 84px across in the frame. */
const HERO_SIZE = 84
const HERO_REST = atDepth(DIAL.x, DIAL.y - DIAL_R, Z.face)
const HERO_CSS = HERO_SIZE / depthScale(Z.face)
/** CSS px on the clock's plane per px in the frame. */
const ON_CLOCK = 1 / depthScale(Z.face)
const BELL = { ...atDepth(540, 700, Z.bell), size: 260 }
const READOUT_TOP = atDepth(540, 840, Z.bell).y
const REMINDER = atDepth(540, 1076, Z.toast)
const BACK = atDepth(540, 1076, Z.back)
/** The Sonner toast at the frame's scale (schedule-parts' Reminder) and its height there. */
const TOAST = { f: 2.2, scale: 0.9, height: 160 }
/** How far the toast stacked behind shows above the front one, in its own px. */
const STACK_LIFT = 40

/** The ring everything is pulled onto at the end: a carousel seen from above. */
const ORBIT = { x: 540, y: 690, rx: 430, ry: 132 }

type StageView = { yaw: number; pitch: number; cam: Cam }

const CAM2 = { x: 540, y: 760 }

/**
 * Act two's camera: it settles back as the clock forms, punches on the strike (with a short
 * shake), the echo and the click, and dollies in through the hold — still moving when the
 * orbit takes over, then easing back out to hand the climax its framing.
 */
function cameraTwo(t: number): Cam {
  const settle = 0.06 * (1 - progress(t, DIVE, 560, ease.outCubic))
  const dolly =
    0.075 *
    progress(t, 2150, 1900, ease.inOutCubic) *
    (1 - progress(t, ORBIT_AT, 500, ease.inOutCubic))
  const punch =
    0.05 * bump(t - STRIKE, 70) + 0.015 * bump(t - ECHO, 60) + 0.008 * bump(t - CLICK, 60)
  const shake = t >= STRIKE && t < STRIKE + 300 ? 7 * Math.exp(-(t - STRIKE) / 80) : 0
  return {
    anchor: CAM2,
    look: {
      x: CAM2.x + Math.sin(t / 1300) * 6 + shake * Math.sin(t * 0.9),
      y: CAM2.y + Math.cos(t / 1700) * 5 + shake * Math.cos(t * 1.3),
    },
    zoom: (1 + settle + dolly) * (1 + punch),
    roll: Math.sin(t / 1900) * 0.35,
  }
}

/** A slow orbit of the camera round the stage, so its layers slide past one another. */
function stageView(t: number): StageView {
  return {
    yaw: interpolate(t, [DIVE, STRIKE, 4100], [-11, -4, 12], [ease.outCubic, ease.inOutCubic]),
    pitch: 3 + Math.sin(t / 900) * 1.6,
    cam: cameraTwo(t),
  }
}

/** Where a point of the stage is drawn in the frame — the stage's turn, its perspective, act two's camera. */
function stageToScreen(point: Vec3, view: StageView) {
  let x = point.x - 540
  let y = point.y - 675
  let z = point.z
  const cy = Math.cos(view.yaw * RAD)
  const sy = Math.sin(view.yaw * RAD)
  ;[x, z] = [x * cy + z * sy, -x * sy + z * cy]
  const cx = Math.cos(view.pitch * RAD)
  const sx = Math.sin(view.pitch * RAD)
  ;[y, z] = [y * cx - z * sx, y * sx + z * cx]
  const k = STAGE_DEPTH / (STAGE_DEPTH - z)
  const seen = viaCamera(
    { x: DIAL.x + (540 + x - DIAL.x) * k, y: DIAL.y + (675 + y - DIAL.y) * k },
    view.cam,
  )
  return { ...seen, scale: k * view.cam.zoom }
}

/** Where and how big today's face is in the frame at the moment it leaves the card. */
const HANDOFF = (() => {
  const pose = cardPose(DIVE)
  const lift = heroLift(DIVE)
  const off = towardEye(HERO_ON_CARD, lift, eyeOnCard(pose))
  const p = onCard({ x: HERO_ON_CARD.x + off.x, y: HERO_ON_CARD.y + off.y, z: lift }, pose)
  const cam = cameraOne(DIVE)
  return { ...viaCamera(p, cam), size: FACE * SERIES_SIZE * heroScale(DIVE) * p.k * cam.zoom }
})()

/** The same place and size on the clock's plane in act two: where the face carries on from. */
const START = (() => {
  const view = stageView(DIVE)
  let { x, y } = HANDOFF
  for (let step = 0; step < 12; step++) {
    const seen = stageToScreen({ x, y, z: Z.face }, view)
    x += (HANDOFF.x - seen.x) / seen.scale
    y += (HANDOFF.y - seen.y) / seen.scale
  }
  return { x, y, size: HANDOFF.size / stageToScreen({ x, y, z: Z.face }, view).scale }
})()

/** The toasts' gentle float while they rest. */
function toastFloat(t: number): number {
  return Math.sin((t - 2300) / 600) * 3 * progress(t, 2300, 300)
}

/**
 * Where the pointer presses the reminder's action button, on the toast's plane (Sonner's
 * measures): its right half, so the arrow leaves the word readable.
 */
function buttonOf(action: string, t: number): Vec3 {
  const width = action.length * 0.56 * 12 * TOAST.f + 16 * TOAST.f
  return {
    x: REMINDER.x + TOAST.scale * (178 * TOAST.f - 16 * TOAST.f - width * 0.22),
    y: REMINDER.y + toastFloat(t) + 8,
    z: Z.toast,
  }
}

/** The bell's swing on its knob: a strike, a smaller second one, a shiver before. */
function swing(t: number): number {
  const strike = (at: number, amp: number) => {
    const dt = t - at
    return dt < 0 ? 0 : amp * Math.exp(-dt / 640) * Math.sin((dt / 520) * 2 * Math.PI)
  }
  const shiver =
    t < STRIKE ? 2.6 * progress(t, STRIKE - 240, 240, ease.inCubic) * Math.sin(t * 0.11) : 0
  const sway = 1.8 * Math.sin((t - 1700) / 420) * progress(t, 1700, 400)
  return strike(STRIKE, 24) + strike(ECHO, 9) + shiver + sway
}

/** The light of a strike, for the ring, the arc and the glow. */
function flare(t: number): number {
  return (
    (t >= STRIKE ? Math.exp(-(t - STRIKE) / 260) : 0) +
    (t >= ECHO ? 0.45 * Math.exp(-(t - ECHO) / 220) : 0)
  )
}

/**
 * Pulled into orbit: each piece leaves its place for a point on a tilted ring around the
 * centre, then circles it faster and faster, shrinking as it goes round the back. `z` is the
 * piece's depth in act two's stage while it rests; on the ring every piece shares one depth.
 */
function orbitStyle(
  t: number,
  rest: Vec2,
  phi0: number,
  shrink: number,
  z = 0,
  fadeFrom = 4060,
): CSSProperties {
  const onto = progress(t, ORBIT_AT, 520, ease.inOutCubic)
  const depth = z * (1 - onto)
  const lift = depth ? `translateZ(${depth}px) ` : ''
  if (onto <= 0) return lift ? { transform: lift } : {}
  const spin = 250 * progress(t, ORBIT_AT, 850, ease.inCubic)
  const phi = (phi0 + spin) * RAD
  const ex = ORBIT.x + ORBIT.rx * Math.cos(phi)
  const ey = ORBIT.y + ORBIT.ry * Math.sin(phi)
  const near = 0.7 + 0.3 * Math.sin(phi)
  const blur = 12 * progress(t, ORBIT_AT + 150, 700, inQuad)
  return {
    transform: `${lift}translate(${(ex - rest.x) * onto}px, ${(ey - rest.y) * onto}px) scale(${mix(1, shrink * near, onto)})`,
    transformOrigin: `${rest.x}px ${rest.y}px`,
    filter: blur > 0.3 ? `blur(${blur}px)` : undefined,
    opacity: 1 - progress(t, fadeFrom, 340, ease.inCubic),
  }
}

/** The headline split into its plain part and its coloured part, each on its own line. */
function headlineLines(text: string): string[] {
  const lines: { accent: boolean; words: string[] }[] = []
  for (const { word, accent } of parseAccents(text)) {
    const last = lines[lines.length - 1]
    if (last && last.accent === accent) last.words.push(word)
    else lines.push({ accent, words: [word] })
  }
  // The coloured words share one marker: joined so they never wrap apart.
  return lines.map(({ accent, words }) => (accent ? `*${words.join(' ')}*` : words.join(' ')))
}

// ── The shot ────────────────────────────────────────────────────────────────────────────────

export function Shot({ copy }: { copy: FilmCopy }) {
  const { local: t } = useShot()

  const shift = 1250 * (1 - ease.outExpo(progress(t, -400, 720)))
  const world = shift > 0.5 ? whip(shift) : undefined
  const fade = 1 - progress(t, 4000, 400)
  // Lit as the week arrives, not before: during the lead-in the previous shot is still on
  // screen, and a full-strength glow would tint its white card.
  const weekLight = 0.2 * progress(t, -250, 350) * (1 - progress(t, DIVE, 300))
  const bellLight =
    (0.24 + 0.04 * Math.sin(t / 600) + 0.2 * flare(t)) * progress(t, CLOCK_AT - 100, 400) * fade

  return (
    <div className="absolute inset-0 overflow-hidden">
      {weekLight > 0.001 ? <Glow x={560} y={830} size={1300} opacity={weekLight} /> : null}
      {bellLight > 0.001 ? <Glow x={DIAL.x} y={DIAL.y} size={880} opacity={bellLight} /> : null}
      <Dust count={22} seed={38} opacity={0.4 * fade} />

      <div style={{ ...FULL, ...world }}>
        <div style={cameraCss(cameraOne(t))}>
          <Calendar t={t} copy={copy} />
        </div>
        <Tally t={t} label={copy.promo.scenes.progress.planned} />
        <div style={cameraCss(cameraTwo(t))}>
          <Stage t={t} copy={copy} />
        </div>
        <Pointer t={t} action={copy.promo.scenes.schedule.open} />
      </div>

      <StrikeBloom t={t} />
      <Headline t={t} text={copy.film.headlines.schedule} />
      <Streaks t={t} />
    </div>
  )
}

// ── Act one, drawn ──────────────────────────────────────────────────────────────────────────

function Calendar({ t, copy }: { t: number; copy: FilmCopy }) {
  if (t > WEEK_GONE) return null
  const pose = cardPose(t)
  const eye = eyeOnCard(pose)
  const drop = progress(t, DIVE, DROP_MS, ease.inCubic)
  // The rest of the week sinks into the dark while the camera leans in on today.
  const focus = 0.93 * progress(t, PUSH, 380, ease.inOutCubic)
  const smear = 16 * drop * drop
  const faces = copy.promo.scenes.schedule.faces

  return (
    <Space depth={DEPTH} originX={ORIGIN.x} originY={ORIGIN.y}>
      <Layer
        cx={CARD.x}
        cy={CARD.y}
        width={CARD.w}
        height={CARD.h}
        pose={pose}
        // Solid while it starts to fall, gone once it is moving fast: a trapdoor, not a fade.
        opacity={1 - progress(t, DIVE + 80, DROP_MS - 70)}
        style={{ filter: smear > 0.4 ? `blur(${smear}px)` : undefined }}
      >
        <UiCard width={CARD.w} height={CARD.h} radius={30}>
          <div style={{ transform: `scale(${S})`, transformOrigin: '0 0' }}>
            <Replica scene="schedule" ms={HOLD_MS} copy={copy.promo} crop={CROP} />
          </div>
          <div
            aria-hidden
            style={{
              ...FULL,
              background: 'linear-gradient(160deg, rgb(255 255 255 / 0) 45%, rgb(30 20 10 / 0.07))',
            }}
          />
          {focus > 0.005 ? (
            <div
              aria-hidden
              style={{
                position: 'absolute',
                left: HERO.u - FOCUS.w / 2,
                top: HERO.v - FOCUS.h / 2,
                width: FOCUS.w,
                height: FOCUS.h,
                borderRadius: FOCUS.radius,
                boxShadow: `0 0 ${FOCUS.blur}px 2000px rgb(11 9 8 / ${focus})`,
              }}
            />
          ) : null}
        </UiCard>

        <div style={{ ...FULL, transformStyle: 'preserve-3d' }}>
          {LESSONS.map((lesson, index) => {
            if (t < lesson.land - SHOWN_FROM) return null
            const { u, v } = spot(lesson)
            if (lesson.hero && t >= DIVE) return <EmptySpot key={index} t={t} u={u} v={v} />
            const fall = dropHeight(t, lesson.land)
            const lift = fall + (lesson.hero ? heroLift(t) : 0)
            const off = towardEye({ x: u - CARD.w / 2, y: v - CARD.h / 2 }, lift, eye)
            const impact = bump(t - lesson.land, 55)
            const size = FACE * (lesson.series ? SERIES_SIZE : 1) * (lesson.hero ? heroScale(t) : 1)
            const appear = progress(t, lesson.land - SHOWN_FROM, 70)
            const ring = progress(t, lesson.land, 560, ease.outCubic)
            const ringR = mix(size / 2, size * 1.35, ring)
            const lit = 1 - focus * shadeAt(u, v)
            // The shadow only shows in the last stretch of the fall, tightening as it lands.
            const near = clamp(1 - fall / 260)
            const spread = 1.15 * (1 + fall / 320)
            // Out of focus while it is still high above the grid.
            const soft = 5 * clamp(fall / DROP_FROM)

            return (
              <div key={index} style={{ ...FULL, transformStyle: 'preserve-3d' }}>
                {near > 0.01 ? (
                  <div
                    style={{
                      position: 'absolute',
                      left: u - (size / 2) * spread,
                      top: v - (size / 2) * spread + 4,
                      width: size * spread,
                      height: size * spread,
                      borderRadius: '50%',
                      background:
                        'radial-gradient(circle, rgb(40 25 10 / 0.42), rgb(40 25 10 / 0) 70%)',
                      opacity: appear * near * near * lit,
                      transform: 'translateZ(0.3px)',
                    }}
                  />
                ) : null}
                {t >= lesson.land && ring < 1 ? (
                  <span
                    style={{
                      position: 'absolute',
                      left: u - ringR,
                      top: v - ringR,
                      width: 2 * ringR,
                      height: 2 * ringR,
                      borderRadius: '50%',
                      border: `3px solid ${PRESENCE[lesson.person]}`,
                      opacity: 0.85 * (1 - ring) * lit,
                      transform: 'translateZ(0.4px)',
                    }}
                  />
                ) : null}
                {lesson.hero ? <HeroCall t={t} u={u} v={v} /> : null}
                <div
                  style={{
                    position: 'absolute',
                    left: u - size / 2,
                    top: v - size / 2,
                    opacity: appear,
                    transform: `translate3d(${off.x}px, ${off.y}px, ${Math.max(0.6, lift)}px) scale(${1 + 0.16 * impact}, ${1 - 0.1 * impact})`,
                    filter: soft > 0.3 ? `blur(${soft}px)` : undefined,
                  }}
                >
                  <Face initials={faces[lesson.person]} person={lesson.person} size={size} />
                  {lit < 0.99 ? (
                    <span
                      aria-hidden
                      style={{
                        ...FULL,
                        borderRadius: '50%',
                        background: 'rgb(11 9 8)',
                        opacity: 1 - lit,
                      }}
                    />
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      </Layer>
    </Space>
  )
}

/** Today's lesson getting ready: two rings of Оля's colour as it lifts off the grid. */
function HeroCall({ t, u, v }: { t: number; u: number; v: number }) {
  return (
    <>
      {[ANTICIPATE, ANTICIPATE + 110].map((at) => {
        const p = progress(t, at, 420, ease.outCubic)
        if (t < at || p >= 1) return null
        const r = mix(FACE * 0.7, FACE * 1.9, p)
        return (
          <span
            key={at}
            style={{
              position: 'absolute',
              left: u - r,
              top: v - r,
              width: 2 * r,
              height: 2 * r,
              borderRadius: '50%',
              border: `4px solid ${PRESENCE.olya}`,
              opacity: 1 - p,
              transform: 'translateZ(2px)',
            }}
          />
        )
      })}
    </>
  )
}

/** Where today's face was, once it has popped out: a ring left behind on the grid. */
function EmptySpot({ t, u, v }: { t: number; u: number; v: number }) {
  const p = progress(t, DIVE, 460, ease.outCubic)
  if (p >= 1) return null
  const r = mix(FACE * 0.7, FACE * 2.1, p)
  return (
    <span
      style={{
        position: 'absolute',
        left: u - r,
        top: v - r,
        width: 2 * r,
        height: 2 * r,
        borderRadius: '50%',
        border: `5px solid ${BRAND}`,
        opacity: 1 - p,
        transform: 'translateZ(1px)',
      }}
    />
  )
}

/**
 * The week's lessons, counted as they land: a counter that floats over the card's corner
 * and pops out of the way the moment today's lesson leaves.
 */
function Tally({ t, label }: { t: number; label: string }) {
  const leave = progress(t, DIVE, 150, ease.inCubic)
  if (leave >= 1) return null
  const count = LESSONS.filter((lesson) => t >= lesson.land).length
  const tick = Math.max(...LESSONS.map((lesson) => bump(t - lesson.land, 50)))

  return (
    <div
      style={{
        position: 'absolute',
        right: 100,
        top: 430,
        transformOrigin: '22% 50%',
        transform: `translateY(${Math.sin(t / 640) * 3 - 26 * leave}px) scale(${(1 + 0.1 * tick) * (1 - leave)})`,
      }}
    >
      <div
        className="flex items-center"
        style={{
          gap: 16,
          padding: '14px 28px 14px 16px',
          borderRadius: 999,
          background: 'rgb(20 16 14 / 0.94)',
          border: '1px solid rgb(255 255 255 / 0.1)',
          boxShadow: '0 26px 50px -18px rgb(0 0 0 / 0.7)',
          whiteSpace: 'nowrap',
        }}
      >
        <span
          className="flex items-center justify-center rounded-full font-semibold tabular-nums"
          style={{ width: 64, height: 64, background: BRAND, color: 'white', fontSize: 32 }}
        >
          {count}
        </span>
        <span style={{ fontSize: 29, fontWeight: 500, color: 'rgb(255 255 255 / 0.78)' }}>
          {label}
        </span>
      </div>
    </div>
  )
}

// ── Act two, drawn ──────────────────────────────────────────────────────────────────────────

function Stage({ t, copy }: { t: number; copy: FilmCopy }) {
  if (t < DIVE) return null
  const scene = copy.promo.scenes.schedule
  const view = stageView(t)
  const light = flare(t)
  const box = 2 * (DIAL_R + 44)

  // The clock draws itself round from 12 o'clock, under the face, once the week has gone.
  const form = progress(t, CLOCK_AT, 460, ease.outExpo)
  const reveal = progress(t, CLOCK_AT, 260, ease.outExpo)
  const arc = progress(t, ARC_FROM, STRIKE - ARC_FROM, inQuad)
  const exitTilt = progress(t, ORBIT_AT, 520, ease.inOutCubic)
  const spin = 250 * progress(t, ORBIT_AT, 850, ease.inCubic)
  const dialZ = Z.dial * (1 - exitTilt)
  const dialFade = 1 - progress(t, 3950, 400, ease.inCubic)

  // The face carries on from where the card drew it, pops toward us and rides up to 12 —
  // there before the clock starts drawing round from it.
  const rise = progress(t, DIVE, 240, ease.outCubic)
  const settle = progress(t, DIVE, 200, ease.outCubic)
  const faceX = mix(START.x, HERO_REST.x, settle) - Math.sin(Math.PI * settle) * 22
  const faceY = mix(START.y, HERO_REST.y, rise) + Math.sin(t / 520) * 2 * progress(t, 2000, 400)
  const faceSize = mix(START.size, HERO_CSS, rise) * (1 + 0.5 * bump(t - DIVE, 150))
  const halo = progress(t, DIVE + 120, 300)
  const badge = spring(t - ECHO, { stiffness: 320, damping: 19 })

  // The minutes run back from the lesson to the reminder: 16:00 … 15:45.
  const minute = 60 - Math.floor(15 * arc + 1e-6)
  const readout = minute >= 60 ? '16:00' : `15:${String(minute).padStart(2, '0')}`

  const appear = spring(t - BELL_AT, { stiffness: 240, damping: 20 })
  const bellSwing = swing(t)
  const clapper = 1.25 * (swing(t - 80) - bellSwing)
  // The strike punches the bell up and it stays a size bigger.
  const punch =
    1 +
    0.08 * spring(t - STRIKE, { stiffness: 260, damping: 17 }) +
    0.16 * bump(t - STRIKE, 60) +
    0.05 * bump(t - ECHO, 60)

  const arrive = spring(t - (STRIKE - 40), { stiffness: 240, damping: 21 })
  const lag = 1 - arrive
  const stack = spring(t - ECHO, { stiffness: 230, damping: 19 })
  const press = bump(t - CLICK, 70)
  const float = toastFloat(t)

  return (
    <Space depth={STAGE_DEPTH} originX={DIAL.x} originY={DIAL.y}>
      <Layer
        cx={540}
        cy={675}
        width={1080}
        height={1350}
        pose={{ rotateY: view.yaw, rotateX: view.pitch }}
      >
        {form > 0 ? (
          <Layer
            cx={DIAL.x}
            cy={DIAL.y}
            width={box}
            height={box}
            opacity={clamp(form * 4) * dialFade}
            pose={{
              z: dialZ,
              rotateX: 72 * exitTilt,
              rotateZ: 0.6 * spin,
              scale: (mix(0.82, 1, form) / depthScale(dialZ)) * mix(1, ORBIT.rx / DIAL_R, exitTilt),
            }}
            flat
          >
            <Dial
              r={DIAL_R}
              reveal={reveal}
              arc={arc}
              flare={light}
              satellite={150 + t * 0.09}
              pulse={progress(t, CLICK, 600, ease.outCubic)}
            />
          </Layer>
        ) : null}

        {/* Оля's face on the hour mark, the hour beside it, and her own bell. */}
        <div style={{ ...FULL, ...orbitStyle(t, HERO_REST, -62, 0.7, Z.face) }}>
          <div
            style={{
              position: 'absolute',
              left: faceX - faceSize / 2,
              top: faceY - faceSize / 2,
              borderRadius: '50%',
              boxShadow: [
                `0 0 0 ${7 * halo * ON_CLOCK}px #0b0908`,
                `0 0 0 ${(7 * halo + 3.5) * ON_CLOCK}px rgb(14 165 233 / ${0.75 * halo})`,
                `0 ${(18 * (1 - halo) + 8) * ON_CLOCK}px ${44 * ON_CLOCK}px rgb(0 0 0 / 0.45)`,
                `0 0 ${46 * halo * ON_CLOCK}px rgb(14 165 233 / ${0.45 * halo})`,
              ].join(', '),
            }}
          >
            <Face initials={scene.faces.olya} person="olya" size={faceSize} />
            {badge > 0.001 ? (
              <div
                style={{
                  position: 'absolute',
                  right: -18 * ON_CLOCK,
                  top: -16 * ON_CLOCK,
                  transform: `scale(${badge})`,
                }}
              >
                <BellBadge size={42 * ON_CLOCK} />
              </div>
            ) : null}
          </div>
          <div
            className="font-semibold tabular-nums"
            style={{
              position: 'absolute',
              left: HERO_REST.x + HERO_CSS / 2 + 40 * ON_CLOCK,
              top: HERO_REST.y - 17 * ON_CLOCK,
              fontSize: 30 * ON_CLOCK,
              lineHeight: 1,
              color: 'rgb(255 255 255 / 0.8)',
              opacity: progress(t, 1780, 260),
              transform: `translateX(${(1 - progress(t, 1780, 400, ease.outExpo)) * -18}px)`,
            }}
          >
            16:00
          </div>
          <Ring
            at={ECHO}
            x={HERO_REST.x + HERO_CSS / 2 + 6 * ON_CLOCK}
            y={HERO_REST.y - HERO_CSS / 2 + 8 * ON_CLOCK}
            from={20 * ON_CLOCK}
            to={84 * ON_CLOCK}
            duration={520}
          />
        </div>

        <StrikeLight t={t} />

        {/* The bell, its rays and waves, and the minutes under it. */}
        <div style={{ ...FULL, ...orbitStyle(t, BELL, 165, 0.5, Z.bell) }}>
          {t >= STRIKE ? (
            <div
              aria-hidden
              style={{
                position: 'absolute',
                left: BELL.x - 340,
                top: BELL.y + 6 - 340,
                width: 680,
                height: 680,
                borderRadius: '50%',
                background: `repeating-conic-gradient(from ${t * 0.014}deg, rgb(255 140 70 / 0.2) 0deg 4deg, rgb(255 140 70 / 0) 4deg 15deg)`,
                WebkitMaskImage: 'radial-gradient(circle, black 16%, transparent 64%)',
                maskImage: 'radial-gradient(circle, black 16%, transparent 64%)',
                opacity: progress(t, STRIKE, 70) * (0.4 + 0.6 * Math.exp(-(t - STRIKE) / 420)),
              }}
            />
          ) : null}
          <Waves t={t} />
          {appear > 0.001 ? (
            <div
              style={{
                position: 'absolute',
                left: BELL.x - BELL.size / 2,
                top: BELL.y - BELL.size / 2 + (1 - Math.min(1, appear)) * 50,
                transform: `scale(${mix(0.15, 1, appear) * punch})`,
                opacity: clamp(appear * 3),
              }}
            >
              <Bell size={BELL.size} swing={bellSwing} clapper={clapper} glow={0.35 + light} />
            </div>
          ) : null}
          <div
            className="font-semibold tabular-nums"
            style={{
              position: 'absolute',
              left: DIAL.x - 130,
              width: 260,
              top: READOUT_TOP,
              textAlign: 'center',
              fontSize: 46,
              letterSpacing: '-0.02em',
              lineHeight: 1,
              color: t >= STRIKE ? '#ff7a3d' : 'white',
              textShadow: t >= STRIKE ? `0 0 ${18 + 30 * light}px rgb(255 79 1 / 0.6)` : undefined,
              opacity: progress(t, ARC_FROM, 200),
              transform: `translateY(${(1 - progress(t, ARC_FROM, 300, ease.outExpo)) * 14}px) scale(${1 + 0.14 * bump(t - STRIKE, 60)})`,
            }}
          >
            {readout}
          </div>
        </div>

        {/* Оля's own reminder, stacked behind the teacher's the way the product's toaster stacks them. */}
        {stack > 0.001 ? (
          <div style={{ ...FULL, ...orbitStyle(t, BACK, 90, 0.45, Z.back) }}>
            <div
              aria-hidden
              className="bg-popover border"
              style={{
                position: 'absolute',
                left: BACK.x - (356 * TOAST.f) / 2,
                top: BACK.y - TOAST.height / 2,
                width: 356 * TOAST.f,
                height: TOAST.height,
                borderRadius: 10 * TOAST.f,
                boxShadow: '0 30px 60px -24px rgb(0 0 0 / 0.6)',
                transform: `translateY(${-STACK_LIFT * stack + float}px) scale(${TOAST.scale * (1 - 0.05 * stack)})`,
                opacity: clamp(stack * 3),
              }}
            />
          </div>
        ) : null}

        {/* The reminder, as the product's toaster shows it. */}
        {arrive > 0.001 ? (
          <div style={{ ...FULL, ...orbitStyle(t, REMINDER, 90, 0.45, Z.toast) }}>
            <div
              style={{
                position: 'absolute',
                left: REMINDER.x,
                top: REMINDER.y,
                transform: `translate(-50%, -50%) translateY(${lag * 130 + float}px) perspective(1400px) rotateX(${lag * 28}deg) scale(${TOAST.scale * (0.82 + 0.18 * arrive) * (1 + 0.012 * bump(t - ECHO, 70) - 0.02 * press)})`,
                filter:
                  Math.abs(lag) > 0.04 ? `blur(${clamp(Math.abs(lag) * 14, 0, 9)}px)` : undefined,
                opacity: clamp(arrive * 4),
              }}
            >
              <Reminder title={scene.reminder} description={LESSON_TITLE} action={scene.open} />
            </div>
          </div>
        ) : null}
      </Layer>
    </Space>
  )
}

/** Sound you can see: arcs leaving the side the bell swings toward, at every swing's end. */
function Waves({ t }: { t: number }) {
  const waves: { at: number; side: 1 | -1; strength: number }[] = []
  for (const [strike, strength] of [
    [STRIKE, 1],
    [ECHO, 0.45],
  ] as const) {
    for (let k = 0; k < 4; k++) {
      const at = strike + 130 + k * 260
      const fall = strength * Math.exp(-(130 + k * 260) / 640)
      waves.push({ at, side: k % 2 === 0 ? -1 : 1, strength: fall })
      waves.push({ at: at + 70, side: k % 2 === 0 ? -1 : 1, strength: 0.6 * fall })
    }
  }

  return (
    <>
      {waves.map(({ at, side, strength }, index) => {
        const p = progress(t, at, 560, ease.outCubic)
        if (t < at || p >= 1) return null
        const r = mix(0.5 * BELL.size, 1.05 * BELL.size, p)
        const color = index % 2 === 0 ? '#ffffff' : BRAND
        return (
          <span
            key={index}
            style={{
              position: 'absolute',
              left: BELL.x - r,
              top: BELL.y + 10 - r,
              width: 2 * r,
              height: 2 * r,
              borderRadius: '50%',
              borderStyle: 'solid',
              borderWidth: 5,
              borderTopColor: 'transparent',
              borderBottomColor: 'transparent',
              borderLeftColor: side < 0 ? color : 'transparent',
              borderRightColor: side > 0 ? color : 'transparent',
              opacity: strength * (1 - p),
            }}
          />
        )
      })}
    </>
  )
}

/**
 * The strike itself: shock rings and sparks thrown off the bell. They stand between the bell
 * and the clock, so the bell's rim hides where they start and the reminder covers them.
 */
function StrikeLight({ t }: { t: number }) {
  if (t < STRIKE - 10 || t > STRIKE + 1000) return null
  return (
    <div style={{ ...FULL, transform: `translateZ(${Z.strike}px)` }}>
      <Ring at={STRIKE} x={BELL.x} y={BELL.y} from={130} to={660} duration={760} width={5} />
      <Ring
        at={STRIKE + 70}
        x={BELL.x}
        y={BELL.y}
        from={110}
        to={470}
        duration={620}
        width={2}
        color="rgb(255 255 255 / 0.85)"
      />
      <Burst
        at={STRIKE}
        x={BELL.x}
        y={BELL.y + 30}
        count={30}
        seed={71}
        shape="spark"
        speed={[420, 1200]}
        size={[3, 6]}
        life={[450, 900]}
        gravity={320}
      />
    </div>
  )
}

/** The strike's light on the frame: a hot bloom round the bell that leaves the edges dark. */
function StrikeBloom({ t }: { t: number }) {
  const since = t - STRIKE
  if (since < 0 || since > 320) return null
  const amount = since < 30 ? since / 30 : Math.exp(-(since - 30) / 80)
  const centre = stageToScreen({ x: BELL.x, y: BELL.y, z: Z.bell }, stageView(t))
  const size = 760
  return (
    <div
      aria-hidden
      className="pointer-events-none"
      style={{
        position: 'absolute',
        left: centre.x - size / 2,
        top: centre.y - size / 2,
        width: size,
        height: size,
        borderRadius: '50%',
        mixBlendMode: 'screen',
        opacity: 0.7 * amount,
        background:
          'radial-gradient(circle, rgb(255 255 255) 0%, rgb(255 226 206 / 0.9) 15%, rgb(255 130 60 / 0.5) 38%, rgb(255 79 1 / 0) 68%)',
      }}
    />
  )
}

/** A pointer comes for the reminder and opens the lesson, on the beat. */
function Pointer({ t, action }: { t: number; action: string }) {
  if (t < 2300 || t > ORBIT_AT) return null
  const tip = stageToScreen(buttonOf(action, t), stageView(t))
  return (
    <FilmPointer
      keys={[
        { at: 2560, x: 990, y: 1228 },
        { at: CLICK - 70, x: tip.x, y: tip.y },
      ]}
      clicks={[CLICK]}
      hideAt={3330}
      size={46}
    />
  )
}

// ── The headline ────────────────────────────────────────────────────────────────────────────

function Headline({ t, text }: { t: number; text: string }) {
  const lines = headlineLines(text)
  const longest = Math.max(...lines.map((line) => plain(line).length))
  const size = Math.min(104, Math.floor(880 / (longest * 0.56)))

  return (
    // In the orbit it would be loose type among the climax's cards: it fades as it is pulled.
    <div style={{ ...FULL, ...orbitStyle(t, { x: 540, y: 278 }, -90, 0.42, 0, 3790) }}>
      <div
        style={{
          position: 'absolute',
          left: 90,
          right: 90,
          top: 160,
          textAlign: 'center',
          fontSize: size,
          lineHeight: 1.08,
          fontWeight: 650,
          letterSpacing: '-0.04em',
        }}
      >
        {lines.map((line, index) => (
          // The plain line keeps a soft shadow: the camera pushes the card up under it.
          <div
            key={index}
            style={{
              textShadow: line.startsWith('*') ? undefined : '0 4px 26px rgb(0 0 0 / 0.45)',
            }}
          >
            <KineticText
              text={line}
              at={30 + index * 160}
              stagger={90}
              duration={600}
              from={{ x: 150, blur: 16, opacity: 0 }}
              marker
            />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Light streaks on the orbit's ring as everything is pulled round it. */
function Streaks({ t }: { t: number }) {
  const shown = progress(t, ORBIT_AT + 80, 280) * (1 - progress(t, 4100, 300))
  if (shown <= 0.001) return null
  const spin = 420 * progress(t, ORBIT_AT, 850, ease.inCubic)
  const size = 2 * ORBIT.rx + 40
  const r = ORBIT.rx
  const length = 2 * Math.PI * r

  return (
    <Space depth={1500} originX={ORBIT.x} originY={ORBIT.y}>
      <Layer
        cx={ORBIT.x}
        cy={ORBIT.y}
        width={size}
        height={size}
        opacity={shown}
        pose={{ rotateX: 72, rotateZ: spin }}
        flat
      >
        <svg width={size} height={size} style={{ overflow: 'visible' }}>
          {[
            { offset: 0, color: BRAND, width: 7, dash: 0.16 },
            { offset: 0.33, color: '#ffb58a', width: 4, dash: 0.1 },
            { offset: 0.62, color: '#ffffff', width: 3, dash: 0.08 },
          ].map((streak, index) => (
            <circle
              key={index}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={streak.color}
              strokeWidth={streak.width}
              strokeLinecap="round"
              strokeDasharray={`${streak.dash * length} ${length}`}
              strokeDashoffset={-streak.offset * length}
              style={{ filter: `drop-shadow(0 0 8px ${streak.color})` }}
            />
          ))}
        </svg>
      </Layer>
    </Space>
  )
}
