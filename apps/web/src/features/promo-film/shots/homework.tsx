'use client'

import { Fragment, type CSSProperties, type ReactNode } from 'react'
import { LESSON } from '@/features/login-promo/scenes/homework/data'
import { initials } from '@/lib/format'
import type { Cue } from '../audio/cues'
import type { FilmCopy } from '../copy'
import { Glow } from '../fx/backdrop'
import { Burst, Dust, Ring, whip } from '../fx/effects'
import { Camera, Layer, Space, type Transform3D } from '../fx/space'
import { KineticText } from '../fx/text'
import {
  BRAND,
  clamp,
  ease,
  type Easing,
  frameOf,
  HEIGHT,
  interpolate,
  mix,
  progress,
  randoms,
  spring,
  useShot,
  WIDTH,
} from '../time'
import {
  CARD_H,
  CARD_W,
  CheckBadge,
  type FlightPath,
  flightPath,
  leavesAt,
  LessonCard,
  PDF_H,
  PDF_W,
  PdfDoc,
  PdfGhost,
  Stamp,
  Strike,
  StudentDisc,
  type StudentLook,
} from './homework-parts'

/*
 * Chapter 05 — one lesson, three students, a copy each, and no PDF.
 * Shot-local ms on the 120 BPM grid (a beat is 500).
 *
 *   −70  whip in from the right, crossing the live shot's whip out left           whoosh
 *     0  "Завдання." lands over the lesson card and the PDF beside it              impact
 *   140  the class rises in along the bottom, muted: they are waiting
 *   500  "Без PDF." lands; the marker sweeps in behind it
 *   560  an orange stroke crosses the PDF out; it glitches…                        glitch
 *   760  …is flicked back into the dark and comes apart into pixels                whoosh
 *   780  the camera pulls back to the whole class; 960 the card glides to centre
 *  1060  the card charges: a light runs once round its edge                        riser
 *  1380  the camera leans in on it…
 *  1500  …and lets go: the card deals three copies straight at the lens — left,   sparkle, whoosh
 *        right, then the middle one — and each dives onto its student
 *  2000  Оля's copy collapses into her disc: flash, rings, a tick, a copy kept     pop
 *  2125  Ірина's                                                                   pop
 *  2250  Максим's                                                                  pop
 *  2500  all three in: light lands down every link, rings, the ticks pulse         chime
 *  3000  a packet runs down every link while the camera orbits the stage
 *  3500  the headline lifts away; 3560 the rest tips back and fades                whoosh
 */
const AT = {
  line1: 0,
  class: 140,
  line2: 500,
  strike: 560,
  fall: 760,
  dissolve: 1040,
  pullBack: 780,
  glide: 960,
  names: 1060,
  charge: 1060,
  push: 1380,
  split: 1500,
  allSet: 2500,
  headlineOut: 3500,
  exit: 3560,
} as const

const FLIGHT_MS = 500
/** A sixteenth note apart, so the copies land on 2000, 2125 and 2250. */
const DEAL_GAP = 125

export const cues: readonly Cue[] = [
  { at: -70, kind: 'whoosh', duration: 400, gain: 0.45, pan: 0.5 },
  { at: AT.line1, kind: 'impact', gain: 0.5 },
  { at: AT.strike, kind: 'glitch', gain: 0.8, pan: 0.45 },
  { at: AT.fall + 10, kind: 'whoosh', duration: 380, gain: 0.4, pan: 0.6, pitch: -5 },
  { at: AT.split - 500, kind: 'riser', duration: 500, gain: 0.5 },
  { at: AT.split, kind: 'sparkle', gain: 0.8 },
  { at: AT.split, kind: 'whoosh', duration: 650, gain: 0.55 },
  { at: AT.split + FLIGHT_MS, kind: 'pop', gain: 0.85, pan: -0.5 },
  { at: AT.split + DEAL_GAP + FLIGHT_MS, kind: 'pop', gain: 0.85, pan: 0.5, pitch: 3 },
  { at: AT.split + 2 * DEAL_GAP + FLIGHT_MS, kind: 'pop', gain: 0.85, pitch: 5 },
  { at: AT.allSet, kind: 'chime', gain: 0.6 },
  { at: AT.exit - 20, kind: 'whoosh', duration: 400, gain: 0.45 },
]

/** The Space every 3D layer here sits in, and where its perspective looks from. */
const DEPTH = 1800
const ORIGIN = { x: WIDTH / 2, y: HEIGHT / 2 }

/** The lesson card: MaterialCard laid out 2.6× its own size. */
const U = 2.6
const CARD = { w: CARD_W * U, h: CARD_H * U }
const CARD_X = 540
const CARD_Y = 640
const CARD_FROM_X = 400

const PDF_X = 834
const PDF_Y = 624
const PDF_SCALE = 1.34
const PDF_NAME = 'homework_B1_v7.pdf'
/** Room round the page for what pokes out of it (its badge, the stroke) while it is masked. */
const PDF_BLEED = 30
const DISSOLVE_MS = 150

const AVATAR = 140
const BADGE = 54
const MINT = '#34d399'
const MINT_PALE = '#d1fae5'

/** A no-break space: "Без PDF." is one block, so the marker sweeps it in one piece. */
const NBSP = String.fromCharCode(160)

const LOOKS: StudentLook[] = [
  // Оля and Максим keep their colours from the live room; Ірина takes the palette's pink.
  { color: '#0ea5e9', light: '#7dd3fc', dark: '#0369a1' },
  { color: '#a855f7', light: '#d8b4fe', dark: '#6b21a8' },
  { color: '#ec4899', light: '#f9a8d4', dark: '#9d174d' },
]

/**
 * The class stands in a shallow arc in front of the card, the middle one nearest the lens.
 * `deal` is the order the copies go out in: left, right, then the middle one, thrown straight
 * at the camera. `out` is where a flight heads off from the card, `dive` where it falls onto
 * its student from — both relative, so the paths follow the card and the class as they move.
 * `apex` is how far along its curve a copy hangs at the top of its throw, `hang` when.
 */
const SPOTS = [
  {
    x: 228,
    y: 1010,
    scale: 0.93,
    side: -1,
    deal: 0,
    apex: 0.42,
    hang: 0.3,
    out: { x: -210, y: -170 },
    dive: { x: -168, y: -310 },
  },
  {
    x: 540,
    y: 1030,
    scale: 1,
    side: 0,
    deal: 2,
    apex: 0.18,
    hang: 0.4,
    out: { x: 60, y: -250 },
    dive: { x: -70, y: -330 },
  },
  {
    x: 852,
    y: 1010,
    scale: 0.93,
    side: 1,
    deal: 1,
    apex: 0.42,
    hang: 0.3,
    out: { x: 210, y: -170 },
    dive: { x: 168, y: -310 },
  },
] as const

/**
 * How big a copy looks through its flight, in MaterialCards. The side copies open out like
 * wings and shrink as they dive; the middle one, thrown straight at the lens, stays big while
 * it drops past the card's face and only shrinks once it is below it.
 */
const SIZES = {
  side: {
    at: [0, 0.2, 0.36, 0.62, 0.86, 0.95, 1],
    visible: [U, U * 1.13, U * 1.05, 1.45, 0.62, 0.3, 0.2],
  },
  middle: {
    at: [0, 0.2, 0.45, 0.72, 0.84, 0.93, 1],
    visible: [U, U * 1.23, U * 1.17, U * 0.92, 1.5, 0.4, 0.2],
  },
} as const

const launchOf = (index: number) => AT.split + SPOTS[index]!.deal * DEAL_GAP
const landOf = (index: number) => launchOf(index) + FLIGHT_MS

/** Light running down every link: one landing on the all-set beat, one on the beat after. */
const PACKETS: readonly { at: number; duration: number; stagger: number; easing: Easing }[] = [
  { at: AT.allSet - 210, duration: 210, stagger: 0, easing: ease.inCubic },
  { at: 3000, duration: 520, stagger: 70, easing: ease.inOutCubic },
]

/**
 * How far along its curve a thrown copy is: out of the deck fast, a moment's hang at the top
 * of the throw — close to the lens — then an accelerating dive onto its student.
 */
const FLY = (raw: number, apex: number, hang: number) =>
  0.85 * interpolate(raw, [0, hang, 1], [0, apex, 1], [ease.outCubic, (x) => x * x]) + 0.15 * raw

/** How far a copy has turned to light on its way in: later for the middle one, still over the card till then. */
const heatOf = (side: number, raw: number) =>
  progress(raw, side === 0 ? 0.78 : 0.68, 0.28, ease.inCubic)

/** Up fast, then away: a flare or a camera punch, `elapsed` ms after the hit. */
function pulse(elapsed: number, rise = 40, fall = 180): number {
  if (elapsed <= 0) return 0
  if (elapsed < rise) return ease.outCubic(elapsed / rise)
  return Math.exp(-(elapsed - rise) / fall)
}

function mixColor(from: string, to: string, amount: number): string {
  const a = Number.parseInt(from.slice(1), 16)
  const b = Number.parseInt(to.slice(1), 16)
  const channel = (shift: number) =>
    Math.round(mix((a >> shift) & 255, (b >> shift) & 255, clamp(amount)))
  return `rgb(${channel(16)} ${channel(8)} ${channel(0)})`
}

/** "Завдання. *Без PDF.*" → the plain sentence, then the marked one, held as one block. */
function splitHeadline(text: string): [string, string] {
  const words = text.split(' ')
  const marked = words.findIndex((word) => word.startsWith('*'))
  if (marked <= 0) return [text, '']
  return [words.slice(0, marked).join(' '), words.slice(marked).join(NBSP)]
}

/**
 * The slow orbit of the hold, faked with parallax (0 → 1): the class, nearest the lens, slides
 * one way, the light behind the card the other, and the card turns a little between them.
 */
const orbitAt = (local: number) => progress(local, 1700, 2000, ease.inOutCubic)

/**
 * The lesson card's pose: it glides to the centre, squeezes as the camera leans in, kicks
 * out on the split and gives a little as each copy peels off its face.
 */
function cardPose(local: number) {
  const glide = progress(local, AT.glide, 420, ease.inOutCubic)
  const orbit = orbitAt(local)
  const squeeze =
    local < AT.split ? 0.045 * progress(local, AT.push, AT.split - AT.push, ease.inCubic) : 0
  const kick = 0.06 * pulse(local - AT.split, 35, 150)
  const give = SPOTS.reduce(
    (sum, _, index) => sum + 0.026 * pulse(local - launchOf(index), 25, 120),
    0,
  )
  // Once the copies are out it rises a touch, so card and class part in depth.
  const lift = -12 * progress(local, AT.allSet - 200, 1400, ease.inOutCubic)
  return {
    x: mix(CARD_FROM_X, CARD_X, glide) + 10 * orbit,
    y: CARD_Y + Math.sin(local / 640) * 4 + lift,
    rotateX: 9 + Math.sin(local / 1100) * 2,
    rotateY: mix(16, -3, glide) + Math.sin(local / 1500) * 2.5 - 8 * orbit,
    scale: 1 - squeeze + kick - give,
  }
}

/** Where a student's disc is: risen in, bobbing once their copy is in, sliding with the orbit. */
function discAt(local: number, index: number) {
  const spot = SPOTS[index]!
  const appear = progress(local, AT.class + index * 70, 520, ease.outExpo)
  const bob =
    Math.sin(local / 520 + index * 1.7) * 3 * progress(local, landOf(index), 400, ease.inOutCubic)
  return {
    x: spot.x - (spot.side === 0 ? 42 : 34) * orbitAt(local),
    y: spot.y + 40 * (1 - appear) + bob,
    appear,
  }
}

type Flight = StudentLook & {
  index: number
  side: number
  scale: number
  apex: number
  hang: number
  launch: number
  land: number
  disc: { x: number; y: number; appear: number }
  path: FlightPath
  /** How far along its path the link first shows from under the card. */
  shows: number
}

/** Each student's flight this frame: the curve from the card to them, which the link keeps. */
function flightsAt(local: number): Flight[] {
  const card = cardPose(local)
  const from = { x: card.x, y: card.y }
  return SPOTS.map((spot, index) => {
    const disc = discAt(local, index)
    const path = flightPath(
      from,
      { x: from.x + spot.out.x, y: from.y + spot.out.y },
      { x: disc.x + spot.dive.x, y: disc.y + spot.dive.y },
      disc,
      90,
    )
    return {
      ...LOOKS[index]!,
      index,
      side: spot.side,
      scale: spot.scale,
      apex: spot.apex,
      hang: spot.hang,
      launch: launchOf(index),
      land: landOf(index),
      disc,
      path,
      shows: leavesAt(path, from, (CARD.w * card.scale) / 2 + 4, (CARD.h * card.scale) / 2 + 4),
    }
  })
}

/**
 * A copy in flight: it peels off the card's face, is thrown at the lens — bigger than the
 * card, turned hard — hangs, then dives onto its student, shrinking to a hot point that
 * collapses into the disc as the disc flashes.
 */
function copyPose(flight: Flight, local: number) {
  const raw = clamp((local - flight.launch) / FLIGHT_MS)
  const point = flight.path.at(FLY(raw, flight.apex, flight.hang))
  const card = cardPose(flight.launch)
  const middle = flight.side === 0
  const size = middle ? SIZES.middle : SIZES.side
  const carried = 1 - progress(raw, 0, 0.35, ease.outCubic)
  const swing = interpolate(
    raw,
    [0, 0.24, 0.62, 1],
    [0, 1, 0.35, 0],
    [ease.outCubic, ease.inOutCubic, ease.inOutCubic],
  )
  const dive = interpolate(
    raw,
    [flight.hang + 0.06, Math.min(0.86, flight.hang + 0.44), 1],
    [0, 1, 0],
    [ease.inOutCubic, ease.outCubic],
  )
  return {
    raw,
    x: point.x,
    y: point.y,
    z: interpolate(
      raw,
      [0, 0.2, 0.45, 0.8, 1],
      [0, 640, 520, 150, 0],
      [ease.outCubic, ease.linear, ease.inOutCubic, ease.inCubic],
    ),
    visible: interpolate(
      raw,
      size.at,
      size.visible.map((value, index) => (index === 0 ? value * card.scale : value)),
      [ease.outCubic, ease.linear, ease.inOutCubic, ease.inOutCubic, ease.linear, ease.linear],
    ),
    rotateX: card.rotateX * carried + (middle ? -30 : -14) * swing + 26 * dive,
    rotateY:
      card.rotateY * carried + (middle ? 12 * Math.sin(Math.PI * raw) : flight.side * 42 * swing),
    rotateZ: middle ? 9 * Math.sin(2 * Math.PI * raw) : flight.side * -16 * swing,
  }
}

/**
 * Where a point of a posed layer lands on screen: the layer's own transform (scale, then
 * rotateZ, rotateY, rotateX, then translate, as CSS applies them) and the Space's
 * perspective. The PDF's pixels and shards are drawn flat, so they need this to sit on it.
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
    x: ORIGIN.x + (cx + (pose.x ?? 0) + x - ORIGIN.x) * k,
    y: ORIGIN.y + (cy + (pose.y ?? 0) + y - ORIGIN.y) * k,
    k,
  }
}

const pdfY = (local: number) => PDF_Y + Math.sin(local / 800) * 5

/**
 * The PDF: floats beside the card, is crossed out, glitches, then is flicked back and up into
 * the dark — away from the card gliding in and from the class — tumbling as it goes.
 */
function pdfPose(local: number) {
  const fall = progress(local, AT.fall, 400, (x) => x * x)
  const glitching = local >= AT.strike + 20 && local < AT.fall
  const [r1, r2, , , , r6] = randoms(frameOf(local) * 31 + 7, 6) as [
    number,
    number,
    number,
    number,
    number,
    number,
  ]
  const jitter = glitching && r2 > 0.25 ? (r1 - 0.5) * 34 : 0
  const jolt = glitching ? 1 + (r6 - 0.5) * 0.08 : 1
  const pose: Transform3D = {
    x: jitter + 300 * fall,
    y: -90 * fall,
    z: -40 - 1050 * fall,
    rotateX: 8 + 70 * fall,
    rotateY: -24 - 30 * fall,
    rotateZ: 7 + 40 * fall,
    scale: PDF_SCALE * jolt,
  }
  return { fall, glitching, pose }
}

/** How far the dissolve's sweep (top-left corner → bottom-right) is from a point of the page. */
const sweepOf = (x: number, y: number) =>
  (x + PDF_BLEED + y + PDF_BLEED) / (PDF_W + PDF_H + 4 * PDF_BLEED)

/** The page as pixels: where each comes from on it, and how it flies once it breaks off. */
const PIXELS = Array.from({ length: 30 }, (_, index) => {
  const [r1, r2, r3, r4, r5] = randoms(4100 + index, 5) as [number, number, number, number, number]
  const u = ((index % 5) + 0.2 + r1 * 0.6) / 5 - 0.5
  const v = (Math.floor(index / 5) + 0.2 + r2 * 0.6) / 6 - 0.5
  const onBadge = u < -0.12 && v > 0.12 && v < 0.42
  const onStroke = Math.abs(v - u * 0.74) < 0.07
  const sweep = sweepOf((u + 0.5) * PDF_W, (v + 0.5) * PDF_H)
  return {
    u,
    v,
    /** When the sweep reaches it, ms after the dissolve starts. */
    at: (DISSOLVE_MS * (sweep + 0.1)) / 1.2,
    speed: 150 + r3 * 300,
    turn: (r4 - 0.5) * 1.2,
    size: 0.09 + r5 * 0.06,
    life: 240 + r4 * 170,
    color: onBadge ? '#e5322d' : onStroke ? BRAND : r5 < 0.4 ? '#d9d2cb' : '#f4f1ee',
  }
})

/** Faint card silhouettes thrown out of the card on the split: the burst behind the deal. */
const GHOSTS = Array.from({ length: 8 }, (_, index) => {
  const [r1, r2, r3, r4] = randoms(5200 + index, 4) as [number, number, number, number]
  return {
    angle: (index / 8) * 2 * Math.PI + 0.2 + (r1 - 0.5) * 0.5,
    distance: 260 + r2 * 260,
    grow: 1.25 + r3 * 0.45,
    spin: (r4 - 0.5) * 26,
    peak: 0.16 + r3 * 0.14,
  }
})

/** A plain full-frame layer: it keeps its children flat, so layers paint in order. */
function Flat({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      className="pointer-events-none absolute inset-0"
      style={{ transformStyle: 'flat', ...style }}
    >
      {children}
    </div>
  )
}

type LessonCopy = { title: string; level: string; meta: string }

export function Shot({ copy }: { copy: FilmCopy }) {
  const { local } = useShot()

  // Out: the headline lifts on the beat, then the world tips back and fades fast, so the
  // next shot's answers sweep in over something already receding.
  const lineOut = [
    progress(local, AT.headlineOut, 280, ease.outCubic),
    progress(local, AT.headlineOut + 50, 280, ease.outCubic),
  ] as const
  const leave = progress(local, AT.exit, 300, ease.outCubic)
  if (leave >= 0.999 && lineOut[1] >= 0.999) return null

  const [lineOne, lineTwo] = splitHeadline(copy.film.headlines.homework)
  const people = copy.people
  const names = [people.olyaShort, people.maksymShort, people.iryna.split(' ')[0] ?? people.iryna]
  const marks = [initials(people.olya), initials(people.maksym), initials(people.iryna)]
  // MaterialCard's quiet line for a four-step lesson, as the library writes it.
  const library = copy.promo.scenes.library
  const meta =
    (library.shelf.find((lesson) => lesson.id === 'present-perfect') ?? library.shelf[0])?.meta ??
    ''
  const card: LessonCopy = { title: LESSON.title, level: 'B1', meta }

  // In: a whip from the right, crossing the live shot's whip out to the left.
  const shift = interpolate(local, [-70, 520], [1250, 0], ease.outExpo)

  const flights = flightsAt(local)
  const pose = cardPose(local)
  const charge = progress(local, AT.charge, 420, ease.inOutCubic)
  const splitFlash = interpolate(
    local,
    [AT.split - 10, AT.split + 30, AT.split + 420],
    [0, 0.85, 0],
    [ease.outCubic, ease.outCubic],
  )
  const allSet = interpolate(
    local,
    [AT.allSet, AT.allSet + 60, AT.allSet + 520],
    [0, 1, 0],
    [ease.outCubic, ease.inOutCubic],
  )
  const allSetBump = interpolate(
    local,
    [AT.allSet, AT.allSet + 60, AT.allSet + 300],
    [0, 1, 0],
    [ease.outCubic, ease.inOutCubic],
  )

  // The camera opens close on the card and the PDF, with the class waiting along the bottom;
  // pulls back to the whole stage as the PDF goes; leans in on the charged card and lets go
  // with the throw (a shake on the hit); punches on every landing and on the all-set; and
  // pushes slowly through the hold. It never stops drifting.
  const pull = progress(local, AT.pullBack, 560, ease.inOutQuart)
  const lean =
    local < AT.split
      ? 0.035 * progress(local, AT.push, AT.split - AT.push, ease.inCubic)
      : 0.035 * (1 - spring(local - AT.split, { stiffness: 240, damping: 14 }))
  const shake = local >= AT.split ? 7 * Math.exp(-(local - AT.split) / 110) : 0
  const [s1, s2] = randoms(frameOf(local) * 17 + 3, 2) as [number, number]
  const zoom =
    mix(1.1, 1, pull) +
    0.05 * progress(local, 2300, 1300, ease.inOutCubic) +
    lean +
    flights.reduce((sum, flight) => sum + 0.01 * pulse(local - flight.land, 40, 160), 0) +
    0.018 * pulse(local - AT.allSet, 50, 200)
  const camX = Math.sin(local / 1300) * 12 + (s1 - 0.5) * 2 * shake
  const camY = mix(-30, 0, pull) + Math.cos(local / 1700) * 5 + (s2 - 0.5) * 2 * shake
  const roll = Math.sin(local / 1900) * 0.35

  return (
    <>
      {leave < 0.999 ? (
        <div
          className="absolute inset-0"
          style={
            leave > 0
              ? {
                  transform: `perspective(1400px) translateY(${-30 * leave}px) rotateX(${16 * leave}deg) scale(${1 - 0.28 * leave})`,
                  transformOrigin: '540px 760px',
                  filter: `blur(${12 * leave}px)`,
                  opacity: 1 - leave,
                }
              : undefined
          }
        >
          <div className="absolute inset-0" style={shift > 0.5 ? whip(shift) : undefined}>
            <Camera zoom={zoom} x={camX} y={camY} roll={roll}>
              <Lights
                local={local}
                card={pose}
                flights={flights}
                charge={charge}
                splitFlash={splitFlash}
                allSet={allSet}
              />
              <SplitLight local={local} card={pose} splitFlash={splitFlash} />
              <Flat>
                <Space depth={DEPTH}>
                  <PdfLayer local={local} />
                </Space>
              </Flat>
              <Flat>
                <Shards />
                <PixelDissolve local={local} />
              </Flat>
              <Flat>
                <Trails local={local} flights={flights} allSet={allSet} />
              </Flat>
              <ClassFloor flights={flights} />
              <Kept local={local} flights={flights} card={card} marks={marks} />
              <MasterCard local={local} pose={pose} card={card} charge={charge} />
              <ClassDiscs
                local={local}
                flights={flights}
                names={names}
                marks={marks}
                allSetBump={allSetBump}
              />
              <Copies local={local} flights={flights} card={card} marks={marks} />
            </Camera>
          </div>
        </div>
      ) : null}

      <div
        className="absolute text-center"
        style={{
          left: 90,
          right: 90,
          top: 150,
          fontSize: 108,
          fontWeight: 650,
          letterSpacing: '-0.035em',
          lineHeight: 1.04,
          transform: `translateY(${Math.sin(local / 1400) * 2.5}px)`,
        }}
      >
        <div style={lifted(lineOut[0])}>
          <KineticText
            text={lineOne}
            at={AT.line1}
            from={{ y: 80, blur: 16, opacity: 0, scale: 1.06 }}
          />
        </div>
        {lineTwo ? (
          <div style={lifted(lineOut[1])}>
            <KineticText
              text={lineTwo}
              at={AT.line2}
              duration={440}
              marker
              from={{ y: 80, blur: 16, opacity: 0, scale: 1.08 }}
            />
          </div>
        ) : null}
      </div>
    </>
  )
}

/** A headline line on its way out: up, blurred, gone. */
function lifted(amount: number): CSSProperties | undefined {
  if (amount <= 0) return undefined
  return {
    transform: `translateY(${-90 * amount}px)`,
    filter: amount > 0.02 ? `blur(${12 * amount}px)` : undefined,
    opacity: 1 - amount,
  }
}

/** Light: the card's warm glow, the floor the class stands on, the card's shadow on it, and each student's colour once their copy is in. */
function Lights({
  local,
  card,
  flights,
  charge,
  splitFlash,
  allSet,
}: {
  local: number
  card: ReturnType<typeof cardPose>
  flights: Flight[]
  charge: number
  splitFlash: number
  allSet: number
}) {
  const orbit = orbitAt(local)
  const floorX = CARD_X - 34 * orbit
  const settle = 1 - progress(local, AT.split + 100, 500, ease.inOutCubic)
  const emerald = pulse(local - AT.allSet, 60, 300)
  const lift = CARD_Y - card.y

  return (
    <Flat>
      <Glow
        x={card.x + 16 * orbit}
        y={CARD_Y}
        size={1080}
        opacity={0.24 + 0.24 * charge * settle + 0.25 * splitFlash}
      />
      <div
        style={{
          position: 'absolute',
          left: floorX - 680,
          width: 1360,
          top: 1030 - 190,
          height: 380,
          borderRadius: '50%',
          background:
            'radial-gradient(closest-side, rgb(255 110 40 / 0.17), rgb(255 110 40 / 0.05) 60%, transparent)',
          opacity: 0.8 + 0.2 * Math.sin(local / 700),
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: card.x - 250 - lift,
          width: 500 + 2 * lift,
          top: 866 - 30,
          height: 60,
          borderRadius: '50%',
          background:
            'radial-gradient(closest-side, rgb(0 0 0 / 0.55), rgb(0 0 0 / 0.2) 60%, transparent)',
          opacity: 0.85 - 0.02 * lift,
        }}
      />
      {emerald > 0.01 ? (
        <div
          style={{
            position: 'absolute',
            left: floorX - 600,
            width: 1200,
            top: 1036 - 160,
            height: 320,
            borderRadius: '50%',
            background:
              'radial-gradient(closest-side, rgb(52 211 153 / 0.42), rgb(16 185 129 / 0.12) 60%, transparent)',
            opacity: emerald,
          }}
        />
      ) : null}
      {flights.map((flight) => {
        const lit = progress(local, flight.land - 30, 260, ease.outCubic)
        if (lit <= 0) return null
        const breathe = 0.04 * Math.sin(local / 430 + flight.index * 2.1)
        const size = AVATAR * flight.scale
        return (
          <Fragment key={flight.index}>
            <Glow
              x={flight.disc.x}
              y={flight.disc.y}
              size={430 * flight.scale}
              color={flight.color}
              opacity={(0.3 + breathe) * lit + 0.14 * allSet}
            />
            <div
              style={{
                position: 'absolute',
                left: flight.disc.x - size * 1.2,
                width: size * 2.4,
                top: flight.disc.y + size * 0.5 - size * 0.22,
                height: size * 0.44,
                borderRadius: '50%',
                background: `radial-gradient(closest-side, ${flight.color}, transparent)`,
                opacity: (0.4 + breathe) * lit + 0.25 * allSet,
              }}
            />
          </Fragment>
        )
      })}
      <Dust count={18} seed={55} opacity={0.35} />
    </Flat>
  )
}

/** The split, behind the card: a hot core, a streak of light, shock waves on the floor, sparks and a burst of ghost cards. */
function SplitLight({
  local,
  card,
  splitFlash,
}: {
  local: number
  card: ReturnType<typeof cardPose>
  splitFlash: number
}) {
  if (local < AT.split - 20 || local > AT.split + 1000) return null
  return (
    <Flat>
      {splitFlash > 0.001 ? (
        <>
          <Glow x={card.x} y={card.y} size={900} color="#ffd2b8" opacity={splitFlash} />
          <div
            style={{
              position: 'absolute',
              left: card.x - 560 * (0.6 + 0.4 * splitFlash),
              width: 1120 * (0.6 + 0.4 * splitFlash),
              top: card.y - 5,
              height: 10,
              borderRadius: 99,
              opacity: splitFlash,
              background: `linear-gradient(90deg, transparent, ${BRAND} 22%, #fff3ea 50%, ${BRAND} 78%, transparent)`,
              boxShadow: '0 0 30px rgb(255 120 40 / 0.9)',
              filter: 'blur(1.5px)',
            }}
          />
        </>
      ) : null}
      <Ghosts local={local} x={card.x} y={card.y} />
      <FloorRing
        local={local}
        at={AT.split}
        x={card.x}
        y={card.y + 60}
        from={300}
        to={640}
        duration={700}
        color={BRAND}
        width={3}
      />
      <FloorRing
        local={local}
        at={AT.split + 90}
        x={card.x}
        y={card.y + 60}
        from={300}
        to={520}
        duration={560}
        color="#ffd2b8"
        width={2}
      />
      {[-1, 1].map((side) => (
        <Burst
          key={side}
          at={AT.split}
          x={card.x + side * (CARD.w / 2 - 30)}
          y={card.y}
          count={20}
          seed={side < 0 ? 12 : 13}
          shape="spark"
          speed={[700, 1700]}
          size={[3, 8]}
          life={[420, 900]}
          gravity={240}
          direction={side < 0 ? 180 : 0}
          spread={110}
        />
      ))}
    </Flat>
  )
}

/** Faint card silhouettes thrown out from behind the card, gone within a third of a second. */
function Ghosts({ local, x, y }: { local: number; x: number; y: number }) {
  const elapsed = local - AT.split
  if (elapsed < 0 || elapsed > 340) return null
  const p = ease.outCubic(elapsed / 340)
  return (
    <>
      {GHOSTS.map((ghost, index) => (
        <div
          key={index}
          style={{
            position: 'absolute',
            left: x - CARD.w / 2,
            top: y - CARD.h / 2,
            width: CARD.w,
            height: CARD.h,
            borderRadius: 16 * U,
            background: 'linear-gradient(160deg, rgb(255 255 255 / 0.6), rgb(255 214 190 / 0.25))',
            boxShadow: 'inset 0 0 0 3px rgb(255 190 150 / 0.85)',
            opacity: ghost.peak * (1 - p),
            transform: `translate(${Math.cos(ghost.angle) * ghost.distance * p}px, ${Math.sin(ghost.angle) * ghost.distance * p * 0.7}px) rotate(${ghost.spin * p}deg) scale(${mix(1, ghost.grow, p)})`,
            filter: `blur(${(3 + 10 * p).toFixed(1)}px)`,
          }}
        />
      ))}
    </>
  )
}

/**
 * A shock wave on the floor the card hovers over: an ellipse, so it spreads out sideways
 * and in depth rather than up through the headline.
 */
function FloorRing({
  local,
  at,
  x,
  y,
  from,
  to,
  duration,
  color,
  width,
}: {
  local: number
  at: number
  x: number
  y: number
  from: number
  to: number
  duration: number
  color: string
  width: number
}) {
  const p = progress(local, at, duration, ease.outCubic)
  if (local < at || p >= 1) return null
  const rx = mix(from, to, p)
  const ry = rx * 0.3
  return (
    <span
      aria-hidden
      style={{
        position: 'absolute',
        left: x - rx,
        top: y - ry,
        width: rx * 2,
        height: ry * 2,
        borderRadius: '50%',
        border: `${width}px solid ${color}`,
        opacity: interpolate(p, [0, 0.12, 1], [0, 1, 0]),
        boxShadow: `0 0 18px ${color}`,
      }}
    />
  )
}

/** The PDF: crossed out, glitching, flicked away, and wiped off the page into pixels. */
function PdfLayer({ local }: { local: number }) {
  const sweep = mix(-0.1, 1.1, progress(local, AT.dissolve, DISSOLVE_MS))
  if (sweep >= 1.09) return null

  const { fall, glitching, pose } = pdfPose(local)
  const strike = progress(local, AT.strike, 150, ease.outExpo)
  const [r1, , r3, r4, r5, r6] = randoms(frameOf(local) * 31 + 7, 6) as [
    number,
    number,
    number,
    number,
    number,
    number,
  ]
  const split = 8 + r3 * 12
  const blur = 10 * fall
  const label = 1 - progress(local, AT.fall, 180, ease.outCubic)
  const mask =
    local >= AT.dissolve
      ? `linear-gradient(135deg, transparent ${((sweep - 0.06) * 100).toFixed(1)}%, #000 ${((sweep + 0.06) * 100).toFixed(1)}%)`
      : undefined

  return (
    <Layer
      cx={PDF_X}
      cy={pdfY(local)}
      width={PDF_W}
      height={PDF_H}
      flat
      pose={pose}
      style={{
        filter: ['drop-shadow(0 26px 34px rgb(0 0 0 / 0.55))', blur > 0.3 ? `blur(${blur}px)` : '']
          .filter(Boolean)
          .join(' '),
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: -PDF_BLEED,
          padding: PDF_BLEED,
          maskImage: mask,
          WebkitMaskImage: mask,
        }}
      >
        <div style={{ position: 'relative', width: PDF_W, height: PDF_H }}>
          <PdfDoc style={{ opacity: glitching && r6 < 0.2 ? 0.4 : 1 }} />
          {glitching ? (
            <>
              <PdfGhost
                color="#00e1ff"
                style={{ opacity: 0.6, transform: `translateX(${-split}px)` }}
              />
              <PdfGhost
                color="#ff2a5f"
                style={{ opacity: 0.6, transform: `translateX(${split}px)` }}
              />
              <PdfDoc
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  clipPath: `inset(${10 + r4 * 30}% -30% ${44 - r4 * 22}% -30%)`,
                  transform: `translateX(${(r5 - 0.5) * 90}px)`,
                }}
              />
              <PdfDoc
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  clipPath: `inset(${60 + r5 * 20}% -30% ${4 + r3 * 12}% -30%)`,
                  transform: `translateX(${(r1 - 0.5) * -70}px)`,
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  left: -20,
                  right: -20,
                  top: r4 * PDF_H,
                  height: 5,
                  background: 'rgb(255 255 255 / 0.85)',
                  boxShadow: '0 0 12px rgb(255 255 255 / 0.8)',
                }}
              />
            </>
          ) : null}
          <Strike amount={strike} />
        </div>
      </div>
      {label > 0.01 ? (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: PDF_H + 16,
            transform: 'translateX(-50%)',
            whiteSpace: 'nowrap',
            fontFamily: 'var(--font-mono), ui-monospace, monospace',
            fontSize: 17,
            color: 'rgb(255 255 255 / 0.55)',
            opacity: label,
          }}
        >
          {PDF_NAME}
        </div>
      ) : null}
    </Layer>
  )
}

/** Shards knocked off the page as the stroke crosses it out. */
function Shards() {
  const at = AT.strike + 30
  const point = project(pdfPose(at).pose, PDF_X, pdfY(at), -6, -10)
  return (
    <Burst
      at={at}
      x={point.x}
      y={point.y}
      count={22}
      seed={9}
      shape="square"
      colors={['#e5322d', '#f4f1ee', BRAND, '#ffb58a']}
      speed={[200, 640]}
      size={[5, 12]}
      life={[500, 850]}
      gravity={900}
      direction={-70}
      spread={220}
    />
  )
}

/** The page breaking into pixels where the sweep wipes it away, each flying off and fading. */
function PixelDissolve({ local }: { local: number }) {
  const elapsed = local - AT.dissolve
  if (elapsed < 0 || elapsed > DISSOLVE_MS + 520) return null
  return (
    <>
      {PIXELS.map((pixel, index) => {
        const age = elapsed - pixel.at
        if (age < 0 || age > pixel.life) return null
        const born = AT.dissolve + pixel.at
        const { pose } = pdfPose(born)
        const y = pdfY(born)
        const centre = project(pose, PDF_X, y, 0, 0)
        const from = project(pose, PDF_X, y, pixel.u * PDF_W, pixel.v * PDF_H)
        const angle = Math.atan2(from.y - centre.y, from.x - centre.x) + pixel.turn
        const seconds = age / 1000
        const drag = (1 - Math.exp(-3 * seconds)) / 3
        const life = age / pixel.life
        const size = PDF_W * PDF_SCALE * pixel.size * from.k * (1 - 0.5 * life)
        return (
          <span
            key={index}
            style={{
              position: 'absolute',
              left: from.x + Math.cos(angle) * pixel.speed * drag + 90 * seconds - size / 2,
              top: from.y + Math.sin(angle) * pixel.speed * drag - 70 * seconds - size / 2,
              width: size,
              height: size,
              borderRadius: 2,
              background: pixel.color,
              opacity: 1 - ease.inCubic(life),
            }}
          />
        )
      })}
    </>
  )
}

/** The links the copies fly along: a comet while a copy is in the air, a living line after. */
function Trails({ local, flights, allSet }: { local: number; flights: Flight[]; allSet: number }) {
  return (
    <svg
      width={WIDTH}
      height={HEIGHT}
      style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}
    >
      {flights.map((flight) => {
        const raw = (local - flight.launch) / FLIGHT_MS
        if (raw <= 0) return null
        const f = FLY(clamp(raw), flight.apex, flight.hang)
        const flying = raw < 1
        const landed = local - flight.land
        const zap = landed >= 0 ? Math.exp(-landed / 180) : 0
        const flow = progress(local, flight.land + 150, 400, ease.outCubic)
        const line = flying ? 0.7 : 0.5 + 0.45 * allSet + 0.4 * zap
        const d = flight.path.d
        return (
          <g key={flight.index}>
            <path
              d={d}
              pathLength={1}
              fill="none"
              stroke={flight.color}
              strokeWidth={12}
              strokeLinecap="round"
              strokeOpacity={0.12 + 0.16 * allSet + 0.2 * zap}
              strokeDasharray={`${f} 2`}
            />
            <path
              d={d}
              pathLength={1}
              fill="none"
              stroke={flight.color}
              strokeWidth={3.5}
              strokeLinecap="round"
              strokeOpacity={line}
              strokeDasharray={`${f} 2`}
            />
            {allSet > 0.01 ? (
              <path
                d={d}
                pathLength={1}
                fill="none"
                stroke="#ffffff"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeOpacity={0.75 * allSet}
                strokeDasharray={`${1 - flight.shows} 2`}
                strokeDashoffset={-flight.shows}
              />
            ) : null}
            {flow > 0.01 ? (
              <path
                d={d}
                pathLength={1}
                fill="none"
                stroke={flight.light}
                strokeWidth={3}
                strokeLinecap="round"
                strokeOpacity={0.65 * flow}
                strokeDasharray="0.004 0.036"
                strokeDashoffset={-((local / 1000) * 0.16 + flight.index * 0.013)}
              />
            ) : null}
            {flying ? (
              <>
                <Segment
                  d={d}
                  from={f - 0.34}
                  to={f}
                  color={flight.color}
                  width={22}
                  opacity={0.2}
                />
                <Segment
                  d={d}
                  from={f - 0.2}
                  to={f}
                  color={flight.light}
                  width={8}
                  opacity={0.75}
                />
                <Segment d={d} from={f - 0.08} to={f} color="#ffffff" width={4} opacity={0.95} />
              </>
            ) : null}
            {PACKETS.map((packet) => {
              const travel = progress(
                local,
                packet.at + flight.index * packet.stagger,
                packet.duration,
                packet.easing,
              )
              if (travel <= 0 || travel >= 1) return null
              const q = mix(flight.shows, 1, travel)
              const head = flight.path.at(q)
              return (
                <g key={packet.at}>
                  <Segment
                    d={d}
                    from={q - 0.18}
                    to={q}
                    color={flight.color}
                    width={16}
                    opacity={0.3}
                  />
                  <Segment d={d} from={q - 0.1} to={q} color="#ffffff" width={4} opacity={0.9} />
                  <circle cx={head.x} cy={head.y} r={7} fill="#ffffff" />
                  <circle cx={head.x} cy={head.y} r={16} fill={flight.light} opacity={0.35} />
                </g>
              )
            })}
          </g>
        )
      })}
    </svg>
  )
}

/** A stretch of a path, from one fraction of its length to another. */
function Segment({
  d,
  from,
  to,
  color,
  width,
  opacity,
}: {
  d: string
  from: number
  to: number
  color: string
  width: number
  opacity: number
}) {
  const start = Math.max(0, from)
  const length = Math.min(1, to) - start
  if (length <= 0.002) return null
  return (
    <path
      d={d}
      pathLength={1}
      fill="none"
      stroke={color}
      strokeWidth={width}
      strokeLinecap="round"
      strokeOpacity={opacity}
      strokeDasharray={`${length} 2`}
      strokeDashoffset={-start}
    />
  )
}

/**
 * What happens on the floor round each student, under the discs and their names: a contact
 * shadow, the rings and sparks of an arrival, and the emerald rings of the all-set.
 */
function ClassFloor({ flights }: { flights: Flight[] }) {
  return (
    <Flat>
      {flights.map((flight) => {
        const { disc } = flight
        if (disc.appear <= 0.001) return null
        const r = (AVATAR * flight.scale) / 2
        const tick = r * Math.SQRT1_2
        return (
          <Fragment key={flight.index}>
            <div
              style={{
                position: 'absolute',
                left: disc.x - r * 0.95,
                width: r * 1.9,
                top: disc.y + r * 1.02 - r * 0.2,
                height: r * 0.4,
                borderRadius: '50%',
                background: 'radial-gradient(closest-side, rgb(0 0 0 / 0.6), transparent)',
                opacity: disc.appear,
              }}
            />
            <Ring
              at={flight.land}
              x={disc.x}
              y={disc.y}
              from={r + 2}
              to={r + 80}
              duration={420}
              color={flight.color}
              width={3}
            />
            <Ring
              at={flight.land + 40}
              x={disc.x}
              y={disc.y}
              from={r + 2}
              to={Math.min(112, r + 42)}
              duration={340}
              color="#ffffff"
              width={2}
            />
            <Burst
              at={flight.land}
              x={disc.x}
              y={disc.y}
              count={16}
              seed={30 + flight.index}
              colors={[flight.color, flight.light, '#ffffff']}
              speed={[240, 600]}
              size={[4, 9]}
              life={[380, 700]}
              gravity={520}
            />
            <Ring
              at={AT.allSet}
              x={disc.x}
              y={disc.y}
              from={r + 4}
              to={r + 74}
              duration={460}
              color={MINT}
              width={3}
            />
            <Ring
              at={AT.allSet + 70}
              x={disc.x}
              y={disc.y}
              from={r + 4}
              to={r + 44}
              duration={380}
              color={MINT_PALE}
              width={2}
            />
            <Burst
              at={AT.allSet}
              x={disc.x + tick}
              y={disc.y + tick}
              count={9}
              seed={44 + flight.index}
              colors={[MINT, MINT_PALE, '#ffffff']}
              speed={[180, 420]}
              size={[3, 6]}
              life={[300, 560]}
              gravity={160}
            />
          </Fragment>
        )
      })}
    </Flat>
  )
}

/** The copy each student keeps once it has arrived: tucked behind their disc, peeking out. */
function Kept({
  local,
  flights,
  card,
  marks,
}: {
  local: number
  flights: Flight[]
  card: LessonCopy
  marks: string[]
}) {
  return (
    <Flat>
      {flights.map((flight) => {
        const tuck = spring(local - (flight.land + 70), { stiffness: 240, damping: 19 })
        if (tuck <= 0.001) return null
        const size = AVATAR * flight.scale
        const unit = 0.56 * flight.scale
        const width = CARD_W * unit
        const height = CARD_H * unit
        const sway = Math.sin(local / 900 + flight.index * 1.3) * 1.5
        return (
          <div
            key={flight.index}
            style={{
              position: 'absolute',
              left: flight.disc.x - size * 0.26 - width / 2,
              top: flight.disc.y - size * 0.47 - height / 2,
              width,
              height,
              opacity: clamp(tuck * 2.5),
              transform: `translateY(${(1 - tuck) * 34}px) rotate(${-9 + sway}deg) scale(${0.7 + 0.3 * tuck})`,
            }}
          >
            <LessonCard
              {...card}
              unit={unit}
              glow={{ color: flight.color, amount: 0.6 }}
              stamp={<Stamp label={marks[flight.index]!} color={flight.color} unit={unit} />}
            />
          </div>
        )
      })}
    </Flat>
  )
}

/** The lesson card itself, with the light that charges round its edge and the flashes it gives off. */
function MasterCard({
  local,
  pose,
  card,
  charge,
}: {
  local: number
  pose: ReturnType<typeof cardPose>
  card: LessonCopy
  charge: number
}) {
  const rim = interpolate(
    local,
    [AT.charge, AT.charge + 60, AT.split, AT.split + 160],
    [0, 1, 1, 0],
  )
  const rimFlash = interpolate(
    local,
    [AT.split - 10, AT.split + 20, AT.split + 200],
    [0, 1, 0],
    [ease.outCubic, ease.outCubic],
  )
  const sent = interpolate(
    local,
    [AT.allSet, AT.allSet + 50, AT.allSet + 420],
    [0, 1, 0],
    [ease.outCubic, ease.inOutCubic],
  )
  // The light runs once round the edge from the top-left corner (so a full rim has no seam
  // on a straight edge), its head white-hot until the circle closes.
  const sweep = charge * 360
  const head = mixColor(BRAND, '#fff4ea', 1 - progress(charge, 0.88, 0.12))

  return (
    <Flat>
      <Space depth={DEPTH}>
        <Layer
          cx={pose.x}
          cy={pose.y}
          width={CARD.w}
          height={CARD.h}
          pose={{ rotateX: pose.rotateX, rotateY: pose.rotateY, scale: pose.scale }}
        >
          {rim > 0.001 && sweep > 0.5 ? (
            <div
              style={{
                position: 'absolute',
                inset: -6,
                borderRadius: 16 * U + 6,
                opacity: rim,
                background: `conic-gradient(from -64deg, ${BRAND} 0deg, ${BRAND} ${Math.max(0, sweep - 16)}deg, ${head} ${sweep}deg, transparent ${Math.min(360, sweep + 0.5)}deg)`,
                boxShadow: `0 0 ${40 * charge}px rgb(255 79 1 / ${0.75 * charge})`,
              }}
            />
          ) : null}
          {rimFlash > 0.001 ? (
            <div
              style={{
                position: 'absolute',
                inset: -8,
                borderRadius: 16 * U + 8,
                opacity: rimFlash,
                background: '#fff1e6',
                boxShadow: `0 0 70px rgb(255 120 40 / 0.95), 0 0 24px ${BRAND}`,
              }}
            />
          ) : null}
          {sent > 0.001 ? (
            <div
              style={{
                position: 'absolute',
                inset: -5,
                borderRadius: 16 * U + 5,
                opacity: sent,
                boxShadow: `0 0 0 3px ${MINT}, 0 0 46px rgb(16 185 129 / 0.75)`,
              }}
            />
          ) : null}
          <LessonCard {...card} unit={U} />
        </Layer>
      </Space>
    </Flat>
  )
}

/** The class: muted discs that rise in early, light up as their copy lands, and take a tick. */
function ClassDiscs({
  local,
  flights,
  names,
  marks,
  allSetBump,
}: {
  local: number
  flights: Flight[]
  names: string[]
  marks: string[]
  allSetBump: number
}) {
  return (
    <Flat>
      {flights.map((flight) => {
        const { disc, land, index } = flight
        if (disc.appear <= 0.001) return null
        const size = AVATAR * flight.scale
        const lit = progress(local, land - 30, 160, ease.outCubic)
        const bump = interpolate(
          local,
          [land - 10, land + 60, land + 340],
          [0, 1, 0],
          [ease.outCubic, ease.inOutCubic],
        )
        const flash = interpolate(
          local,
          [land - 30, land + 10, land + 300],
          [0, 0.85, 0],
          [ease.outCubic, ease.outCubic],
        )
        const badge = spring(local - (land + 60), { stiffness: 320, damping: 23 })
        const packet = PACKETS[1]!
        const arrival = packet.at + index * packet.stagger + packet.duration
        const knock = interpolate(local, [arrival - 40, arrival + 20, arrival + 280], [0, 1, 0])
        const scale =
          (0.9 + 0.1 * disc.appear) * (1 + 0.13 * bump + 0.05 * allSetBump + 0.035 * knock)
        const blur = 10 * (1 - disc.appear)
        const badgeAt = size / 2 + (size / 2) * Math.SQRT1_2
        const named = progress(local, AT.names + index * 60, 400, ease.outCubic)

        return (
          <Fragment key={index}>
            <div
              style={{
                position: 'absolute',
                left: disc.x - size / 2,
                top: disc.y - size / 2,
                width: size,
                height: size,
                opacity: disc.appear,
                transform: `scale(${scale})`,
                filter: blur > 0.3 ? `blur(${blur}px)` : undefined,
              }}
            >
              <StudentDisc
                size={size}
                look={flight}
                label={marks[index]!}
                lit={lit}
                flash={flash}
              />
              {badge > 0.001 ? (
                <div
                  style={{
                    position: 'absolute',
                    left: badgeAt - BADGE / 2,
                    top: badgeAt - BADGE / 2,
                    transform: `scale(${badge * (1 + 0.28 * allSetBump)}) rotate(${(1 - badge) * -45}deg)`,
                  }}
                >
                  <CheckBadge size={BADGE} />
                </div>
              ) : null}
            </div>
            {named > 0.001 ? (
              <div
                style={{
                  position: 'absolute',
                  left: disc.x - 160,
                  width: 320,
                  top: disc.y + size / 2 + 22,
                  textAlign: 'center',
                  fontSize: 30,
                  fontWeight: 550,
                  letterSpacing: '-0.01em',
                  color: 'white',
                  opacity: disc.appear * named * (0.5 + 0.5 * lit),
                }}
              >
                {names[index]}
              </div>
            ) : null}
          </Fragment>
        )
      })}
    </Flat>
  )
}

/** The copies in the air, over everything: the last one out is drawn on top. */
function Copies({
  local,
  flights,
  card,
  marks,
}: {
  local: number
  flights: Flight[]
  card: LessonCopy
  marks: string[]
}) {
  const flying = flights
    .filter((flight) => local >= flight.launch && local < flight.land)
    .sort((a, b) => a.launch - b.launch)
  if (flying.length === 0) return null
  return (
    <>
      {flying.map((flight) => {
        const now = copyPose(flight, local)
        const hot = heatOf(flight.side, now.raw)
        const fade = 1 - progress(now.raw, 0.94, 0.06)
        return (
          <Flat key={flight.index}>
            {hot > 0.01 ? (
              <>
                <Glow
                  x={now.x}
                  y={now.y}
                  size={120 + 170 * hot}
                  color={flight.color}
                  opacity={0.95 * hot * fade}
                />
                <Glow
                  x={now.x}
                  y={now.y}
                  size={50 + 60 * hot}
                  color="#ffffff"
                  opacity={0.7 * hot * fade}
                />
              </>
            ) : null}
            <Space depth={DEPTH}>
              <FlyingCopy local={local} flight={flight} card={card} mark={marks[flight.index]!} />
            </Space>
          </Flat>
        )
      })}
    </>
  )
}

/** A copy in the air: the card, stamped with its student's initials, on its way to them. */
function FlyingCopy({
  local,
  flight,
  card,
  mark,
}: {
  local: number
  flight: Flight
  card: LessonCopy
  mark: string
}) {
  const now = copyPose(flight, local)
  const before = copyPose(flight, local - 17)
  const after = copyPose(flight, local + 17)
  const speed =
    Math.hypot(after.x - before.x, after.y - before.y) +
    Math.abs(after.visible - before.visible) * CARD_W * 0.5
  const blur = clamp((speed - 8) / 6, 0, 9)
  // On the way in it turns to light in its student's colour, so it reads as merging into them.
  const hot = heatOf(flight.side, now.raw)
  const tint = progress(now.raw, flight.side === 0 ? 0.8 : 0.7, 0.2, ease.inOutCubic)
  // Placed so that, seen through the perspective, it sits exactly on its trail and is the
  // size `visible` says; its depth only shapes how hard its turns foreshorten.
  const k = (DEPTH - now.z) / DEPTH
  const filter = [
    blur > 0.3 ? `blur(${blur.toFixed(2)}px)` : '',
    hot > 0.01 ? `brightness(${(1 + 0.5 * hot).toFixed(3)})` : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <Layer
      cx={ORIGIN.x + (now.x - ORIGIN.x) * k}
      cy={ORIGIN.y + (now.y - ORIGIN.y) * k}
      width={CARD.w}
      height={CARD.h}
      flat
      opacity={1 - progress(now.raw, 0.94, 0.06)}
      pose={{
        z: now.z,
        rotateX: now.rotateX,
        rotateY: now.rotateY,
        rotateZ: now.rotateZ,
        scale: (now.visible / U) * k,
      }}
      style={{ filter: filter || undefined }}
    >
      <LessonCard
        {...card}
        unit={U}
        glow={{ color: flight.color, amount: progress(now.raw, 0.02, 0.12) * (1 + hot) }}
        stamp={
          <Stamp
            label={mark}
            color={flight.color}
            unit={U}
            opacity={progress(now.raw, 0.02, 0.08)}
          />
        }
      />
      {tint > 0.01 ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 16 * U,
            background: `linear-gradient(160deg, ${flight.light}, ${flight.color} 70%)`,
            opacity: 0.88 * tint,
          }}
        />
      ) : null}
    </Layer>
  )
}
