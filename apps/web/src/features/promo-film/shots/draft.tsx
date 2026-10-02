'use client'

import { CheckIcon, MousePointer2Icon } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import type { Cue } from '../audio/cues'
import type { FilmCopy } from '../copy'
import { Glow } from '../fx/backdrop'
import { Burst, Dust, Flash, Ring, whip } from '../fx/effects'
import { Camera, Layer, Space } from '../fx/space'
import { UiCard } from '../fx/surface'
import { KineticText, parseAccents, plain } from '../fx/text'
import { Replica } from '../replica'
import {
  BRAND,
  BRAND_DEEP,
  clamp,
  ease,
  frameOf,
  interpolate,
  mix,
  progress,
  randoms,
  spring,
  useShot,
} from '../time'

/*
 * Chapter 02 — the AI lesson draft: AI proposes, the teacher decides.
 *
 * Beats, shot-local ms on the 120 BPM grid:
 *   −220  whip in from the right, with the library's whip out, onto the AI lesson dialog
 *      0  the topic types in; the product's own pointer heads for the button
 *   1000  "Створити чернетку" — the press bursts into sparkles, the dialog's edge lights up
 *         and the camera pulls out to the whole dialog while the AI works (a riser)
 *   1490  the draft is back: a flash and a shockwave; its four steps arc out toward the
 *         camera and land round it as the dialog sinks back; "ШІ пропонує —" rises
 *   1520  the steps' blocks spiral out of the draft after them and dock into their rows on
 *         the 1/8-beat grid, 1875–2187: four steps, sixteen blocks
 *   2000  "ви вирішуєте" slams in on the bar with a camera punch; the marker sweeps
 *   3000  the teacher picks step 2 — it takes the check, the rest falls into the dark
 *   3120  step 2 flies to (540, 760); from 3600 the editor opens over it with a circle
 */

const PRESS = 1000
/** The scene's form-to-draft swap (its PREVIEW_AT): here a cut, under the flash. */
const PREVIEW = 1490
const FAN = 1500
const LINE_1 = 1500
const LINE_2 = 2000
const CLICK = 3000
const TO_FRONT = 3120
const HANDOFF = 3600
const FADE = 4120
/** An eighth of a beat: the grid the blocks dock on. */
const EIGHTH = 62.5
/** When each step's first block docks: once the step is down from its arc, on the grid. */
const DOCK_AT = [1875, 1937.5, 2000, 2062.5] as const

/**
 * The draft is filmed by a second replica, mounted unseen this early with its clock already
 * past the scene's swap: the draft's own rise-in (CSS on film time, 560 ms with its
 * stagger) is over by the cut, so the reveal shows a finished lesson, not an empty card.
 */
const DRAFT_MOUNT = 850
const DRAFT_MS = 4700

export const cues: readonly Cue[] = [
  { at: -200, kind: 'whoosh', duration: 420, gain: 0.75, pan: 0.45 },
  { at: 20, kind: 'type', duration: 500, gain: 0.4, pan: -0.1 },
  { at: PRESS, kind: 'click', gain: 0.85, pan: 0.3 },
  { at: PRESS, kind: 'sparkle', gain: 0.9, pan: 0.3 },
  // The AI at work builds into the reveal.
  { at: 1100, kind: 'riser', duration: PREVIEW - 1100, gain: 0.5 },
  { at: FAN - 40, kind: 'whoosh', duration: 560, gain: 0.75 },
  // The first blocks docking pick up into the bar.
  { at: Math.round(DOCK_AT[0]), kind: 'pop', gain: 0.5, pan: -0.45, pitch: 2 },
  { at: Math.round(DOCK_AT[1]), kind: 'pop', gain: 0.45, pan: 0.4, pitch: 5 },
  { at: LINE_2, kind: 'impact', gain: 0.7 },
  { at: CLICK, kind: 'click', gain: 0.75, pan: 0.4 },
  { at: CLICK + 40, kind: 'chime', gain: 0.5, pan: 0.35 },
  { at: TO_FRONT, kind: 'whoosh', duration: 420, gain: 0.45, pan: 0.2 },
]

/**
 * The form's scene clock. Typing and "generating" are sped up so the press lands on beat 2.
 * The scene's pointer glides on film time (480 ms), so it starts 400 ms early. The form
 * starts to leave (the product's own exit) at 1440 and never reaches the swap: the draft
 * replica takes over at the cut.
 */
const formMs = (local: number) =>
  interpolate(
    local,
    [-400, 0, 520, 600, PRESS, 1060, 1440, FAN],
    [1250, 1600, 2720, 2900, 3640, 3760, 4560, 4650],
  )

/*
 * The dialog in the world. The scene's 520×720 box holds it at (40, 40), 440 wide: 443
 * tall as a form, 576 as the draft. It is scaled about its top-centre.
 */
const D_SCALE = 0.95
const D_TOP = 560
const FORM_H = 443
const PREVIEW_H = 576
const world = (sx: number, sy: number) => ({
  x: 540 + (sx - 260) * D_SCALE,
  y: D_TOP + (sy - 40) * D_SCALE,
})
/** The middle of the draft: the world turns about a point just behind it. */
const PIVOT = world(260, 40 + PREVIEW_H / 2)
const PIVOT_Z = -80
/** Where the editor's circle opens; the picked card ends here. The world recedes toward it. */
const HANDOFF_POINT = { x: 540, y: 760 }
const DEPTH = 1300
/** How far the dialog sinks back as its steps come forward. */
const SINK = -320
/** The press point, in the scene's own box: the burst lives on the dialog. */
const BUTTON_STAGE = { x: 401, y: 457 }

const draftZ = (local: number) => SINK * progress(local, PREVIEW - 40, 650, ease.house)

type BlockKey = 'multipleChoice' | 'callout' | 'gapFill'

type Step = {
  n: number
  /** Lesson content: English, as every lesson on the platform. */
  title: string
  /** The two block types its row names; the rest are counted. */
  chips: readonly [BlockKey, BlockKey]
  /** How many blocks the AI put in it (step 1 is the scene's own five). */
  blocks: number
  x: number
  y: number
  z: number
  rx: number
  ry: number
  rz: number
  /** How far toward the camera its flight arcs. */
  apex: number
  at: number
  seed: number
}

/**
 * The draft's four steps, fanned round it at different depths. Step 2, "Paying the bill",
 * is the one the editor opens next.
 */
const STEPS: readonly Step[] = [
  {
    n: 1,
    title: 'At the table',
    chips: ['multipleChoice', 'callout'],
    blocks: 5,
    x: 302,
    y: 588,
    z: 40,
    rx: 6,
    ry: 24,
    rz: -4,
    apex: 380,
    at: FAN,
    seed: 11,
  },
  {
    n: 2,
    title: 'Paying the bill',
    chips: ['gapFill', 'multipleChoice'],
    blocks: 4,
    x: 758,
    y: 658,
    z: 170,
    rx: 5,
    ry: -24,
    rz: 3.5,
    apex: 330,
    at: FAN + 60,
    seed: 12,
  },
  {
    n: 3,
    title: 'Menu vocabulary',
    chips: ['gapFill', 'callout'],
    blocks: 4,
    x: 360,
    y: 950,
    z: 280,
    rx: -6,
    ry: 22,
    rz: 3,
    apex: 270,
    at: FAN + 120,
    seed: 13,
  },
  {
    n: 4,
    title: 'Role-play',
    chips: ['multipleChoice', 'gapFill'],
    blocks: 3,
    x: 768,
    y: 1030,
    z: 100,
    rx: -5,
    ry: -22,
    rz: -3.5,
    apex: 350,
    at: FAN + 180,
    seed: 14,
  },
]
const PICKED = 2
const CARD_W = 340
const CARD_H = 128
const CARD_PAD = 19
/** A step's flight out of the draft; it lands on a spring (≈5% overshoot). */
const FLIGHT = 400
const LAND = { stiffness: 120, damping: 15 }
/** Where the teacher's pointer clicks step 2: on its title, from the card's middle. */
const PICK = { x: -48, y: -26 }

/* ------------------------------------------------------------------------------------ */
/* Block chips: sixteen of them spiral out of the draft and dock into the steps' rows     */
/* ------------------------------------------------------------------------------------ */

const CHIP_H = 28
const CHIP_GAP = 6
const CHIP_PAD = 9
/** About this much of an em a letter (Inter, 500): generous, so a label never overflows. */
const EM = 0.53

type Slot = { label: string; left: number; width: number }

type Flier = {
  step: number
  /** 0 and 1 dock into the named chips; the rest are counted into the third. */
  slot: 0 | 1 | 2
  launch: number
  arrive: number
  seed: number
  /** The block a counted flier carries. */
  extra: BlockKey
}

const EXTRA: readonly BlockKey[] = ['gapFill', 'multipleChoice', 'callout']

const FLIERS: readonly Flier[] = STEPS.flatMap((step, index) =>
  Array.from({ length: step.blocks }, (_, k) => ({
    step: index,
    slot: Math.min(k, 2) as 0 | 1 | 2,
    launch: step.at + 24 + k * 34,
    arrive: (DOCK_AT[index] ?? 2000) + k * EIGHTH,
    seed: 600 + index * 10 + k,
    extra: EXTRA[(index + k) % EXTRA.length] ?? 'gapFill',
  })),
)

function blockName(copy: FilmCopy, key: BlockKey): string {
  if (key === 'gapFill') return copy.promo.scenes.editor.blockType
  if (key === 'callout') return copy.promo.scenes.draft.callout
  return copy.promo.scenes.draft.multipleChoice
}

const chipWidth = (label: string, size: number) =>
  Math.ceil(label.length * size * EM) + 2 * CHIP_PAD + 2

/** Every step's row — two block names and a "+N" — at one type size the longest row fits. */
function layout(copy: FilmCopy): { size: number; slots: Slot[][] } {
  const rows = STEPS.map((step) => [
    blockName(copy, step.chips[0]),
    blockName(copy, step.chips[1]),
    `+${step.blocks - 2}`,
  ])
  const room = CARD_W - 2 * CARD_PAD - 2 * CHIP_GAP - 3 * (2 * CHIP_PAD + 2) - 3
  const letters = Math.max(...rows.map((row) => row.join('').length))
  const size = clamp(Math.floor(room / (letters * EM)), 11, 15)

  const slots = rows.map((row) => {
    let left = CARD_PAD
    return row.map((label) => {
      const width = chipWidth(label, size)
      const slot = { label, left, width }
      left += width + CHIP_GAP
      return slot
    })
  })
  return { size, slots }
}

/* ------------------------------------------------------------------------------------ */
/* The 3D arithmetic: the same transforms the browser applies, so what is drawn over the */
/* world (the flying blocks, the pointer and its click) sits exactly on a card in it     */
/* ------------------------------------------------------------------------------------ */

type Vec = readonly [number, number, number]
const RAD = Math.PI / 180

function turnX([x, y, z]: Vec, deg: number): Vec {
  const c = Math.cos(deg * RAD)
  const s = Math.sin(deg * RAD)
  return [x, c * y - s * z, s * y + c * z]
}

function turnY([x, y, z]: Vec, deg: number): Vec {
  const c = Math.cos(deg * RAD)
  const s = Math.sin(deg * RAD)
  return [c * x + s * z, y, -s * x + c * z]
}

function turnZ([x, y, z]: Vec, deg: number): Vec {
  const c = Math.cos(deg * RAD)
  const s = Math.sin(deg * RAD)
  return [c * x - s * y, s * x + c * y, z]
}

type Pose = { x: number; y: number; z: number; rx: number; ry: number; rz: number; scale: number }

/** A point on a posed card (offset from its middle, in its own px; `oz` off its face). */
function onCard(pose: Pose, ox: number, oy: number, oz = 0): Vec {
  const [x, y, z] = turnX(
    turnY(turnZ([ox * pose.scale, oy * pose.scale, oz], pose.rz), pose.ry),
    pose.rx,
  )
  return [pose.x + x, pose.y + y, pose.z + z]
}

/** The camera: close on the dialog, a punch at the press, out while the AI works, a kick at the cut. */
function cameraAt(local: number) {
  const punch = interpolate(
    local,
    [PRESS, PRESS + 50, PRESS + 340],
    [0, 1, 0],
    [ease.outCubic, ease.inOutCubic],
  )
  const slam = interpolate(
    local,
    [LINE_2, LINE_2 + 40, LINE_2 + 320],
    [0, 1, 0],
    [ease.outCubic, ease.inOutCubic],
  )
  const zoom =
    interpolate(
      local,
      [-400, 0, PRESS, 1080, PREVIEW, 2300, 2950, HANDOFF, 4400],
      [1.95, 2.02, 2.1, 2.1, 1.2, 1, 1.03, 1.12, 1.18],
      [
        ease.outCubic,
        ease.linear,
        ease.linear,
        ease.inOutCubic,
        ease.outCubic,
        ease.inOutCubic,
        ease.inOutCubic,
        ease.outCubic,
      ],
    ) *
    (1 + 0.04 * punch) *
    (1 + 0.03 * slam)

  // The world point in the middle of the frame: leading a little toward the button at the
  // press; from the cut on, world (540, 760) holds still on screen (540, 760), where the
  // editor's circle will open.
  const fx = interpolate(
    local,
    [-400, 560, PRESS, 1080, PREVIEW],
    [540, 540, 542, 542, 540],
    ease.inOutCubic,
  )
  const fy =
    local < PREVIEW
      ? interpolate(
          local,
          [-400, 560, PRESS, 1080, PREVIEW],
          [768, 772, 786, 786, 760 - 85 / 1.2],
          ease.inOutCubic,
        )
      : 760 - 85 / zoom

  const shake = local >= PRESS && local < PRESS + 220 ? 5 * (1 - (local - PRESS) / 220) : 0
  const [s1 = 0.5, s2 = 0.5] = randoms(frameOf(local) * 31 + 7, 2)
  const t = local / 1000
  // The handheld drift settles once the teacher picks, so the hand-off lands dead on.
  const calm = 1 - progress(local, CLICK, 600, ease.inOutCubic)

  return {
    zoom,
    x: fx - 540 + Math.sin(t * 1.1) * 5 * calm + (s1 - 0.5) * 2 * shake,
    y: fy - 675 + Math.cos(t * 0.8) * 4 * calm + (s2 - 0.5) * 2 * shake,
    roll: interpolate(local, [-400, PRESS, 2050, HANDOFF], [-1.8, -0.7, 0.6, 0], ease.inOutCubic),
    // The cut smears a little.
    blur:
      2.2 *
      interpolate(local, [PREVIEW - 60, PREVIEW + 30, PREVIEW + 180], [0, 1, 0], ease.inOutCubic),
  }
}

/**
 * The world turns about the draft: the dialog leans its button toward us while the topic
 * types, then the fan swings as it opens, so its depth shows, and comes back square.
 */
function worldTurn(local: number) {
  const wobble =
    Math.sin((local / 1000) * 1.3) * 0.6 * (1 - progress(local, CLICK, 600, ease.inOutCubic))
  return {
    ry:
      interpolate(local, [-400, PRESS, 2300, CLICK, HANDOFF], [-11, -8, 7, 2, 0], ease.inOutCubic) +
      wobble,
    rx: interpolate(local, [-400, PRESS, 2300, CLICK, HANDOFF], [9, 7, 3, 1, 0], ease.inOutCubic),
  }
}

type Pt = { x: number; y: number }

/** The world as the camera sees it at `local`: where a world point lands in the frame. */
function projector(local: number): (point: Vec) => Pt {
  const turn = worldTurn(local)
  const camera = cameraAt(local)
  const c = Math.cos(camera.roll * RAD)
  const s = Math.sin(camera.roll * RAD)

  return ([x, y, z]) => {
    const [qx, qy, qz] = turnX(turnY([x - PIVOT.x, y - PIVOT.y, z - PIVOT_Z], turn.ry), turn.rx)
    const k = DEPTH / (DEPTH - (qz + PIVOT_Z))
    const px = HANDOFF_POINT.x + (qx + PIVOT.x - HANDOFF_POINT.x) * k
    const py = HANDOFF_POINT.y + (qy + PIVOT.y - HANDOFF_POINT.y) * k
    const dx = (px - 540 - camera.x) * camera.zoom
    const dy = (py - 675 - camera.y) * camera.zoom
    return { x: 540 + c * dx - s * dy, y: 675 + s * dx + c * dy }
  }
}

/**
 * The transform that lays a w×h box onto a quad in the frame (top-left, top-right,
 * bottom-right, bottom-left): the box's exact perspective, drawn flat over the world.
 */
function quadTransform(
  w: number,
  h: number,
  [p0, p1, p2, p3]: readonly [Pt, Pt, Pt, Pt],
): string | null {
  const sx = p0.x - p1.x + p2.x - p3.x
  const sy = p0.y - p1.y + p2.y - p3.y
  let g = 0
  let k = 0
  if (Math.abs(sx) > 1e-6 || Math.abs(sy) > 1e-6) {
    const dx1 = p1.x - p2.x
    const dx2 = p3.x - p2.x
    const dy1 = p1.y - p2.y
    const dy2 = p3.y - p2.y
    const det = dx1 * dy2 - dx2 * dy1
    if (Math.abs(det) < 1e-9) return null
    g = (sx * dy2 - dx2 * sy) / det
    k = (dx1 * sy - sx * dy1) / det
  }
  const a = p1.x - p0.x + g * p1.x
  const b = p3.x - p0.x + k * p3.x
  const d = p1.y - p0.y + g * p1.y
  const e = p3.y - p0.y + k * p3.y
  // Column-major; z passes through untouched.
  return `matrix3d(${a / w}, ${d / w}, 0, ${g / w}, ${b / h}, ${e / h}, 0, ${k / h}, 0, 0, 1, 0, ${p0.x}, ${p0.y}, 0, 1)`
}

/**
 * A step's pose: out of the middle of the draft (which is sinking back), up toward the
 * camera on an arc, down onto its place in the fan on a spring; then it drifts. The picked
 * one lifts, then flies to the hand-off point.
 */
function stepPose(step: Step, local: number): Pose {
  const elapsed = local - step.at
  const land = spring(elapsed, LAND)
  const arc = Math.sin(Math.PI * clamp(elapsed / FLIGHT))
  const [r1 = 0.5, r2 = 0.5] = randoms(step.seed, 2)
  const drift = progress(local, step.at + 520, 700, ease.inOutCubic)
  const t = local / 1000

  let x = mix(540 + (step.x - 540) * 0.12, step.x, land)
  let y =
    mix(PIVOT.y + (step.y - PIVOT.y) * 0.12, step.y, land) +
    Math.sin(t * 1.6 + step.seed) * 5 * drift
  let z = mix(draftZ(step.at) + 12, step.z, land) + step.apex * arc
  let rx = step.rx * land
  let ry = step.ry * land
  let rz = mix((r1 - 0.5) * 50, step.rz, land) + Math.sin(t * 1.2 + r2 * 6) * 0.6 * drift
  let scale = mix(0.4, 1, land) * (1 + 0.22 * arc)

  if (step.n === PICKED) {
    const lift = spring(local - CLICK, { stiffness: 260, damping: 22 })
    const front = progress(local, TO_FRONT, 480, ease.house)
    const push = progress(local, HANDOFF, 800, ease.outCubic)
    x = mix(x, HANDOFF_POINT.x, front)
    y = mix(y, HANDOFF_POINT.y, front)
    z = mix(z + 40 * lift, 340, front) + 110 * push
    rx = mix(rx, 0, front)
    ry = mix(ry, 0, front)
    rz = mix(rz, 0, front)
    scale *= 1 + 0.04 * lift * (1 - front)
  }

  return { x, y, z, rx, ry, rz, scale }
}

/**
 * A block in flight: out of the side of the draft that faces its step, swirling round
 * (every block turns the same way) and up toward the camera, then down onto its slot from
 * in front of the moving step — so it lands in place rather than sliding across its row.
 */
function flierAt(flier: Flier, slot: Slot, local: number) {
  const step = STEPS[flier.step] ?? STEPS[0]!
  const u = clamp((local - flier.launch) / (flier.arrive - flier.launch))
  // Out fast, still quick on arrival: it snaps in rather than settling.
  const v = 0.55 * u + 0.45 * ease.outCubic(u)
  const [r1 = 0.5, r2 = 0.5, r3 = 0.5, r4 = 0.5, r5 = 0.5, r6 = 0.5] = randoms(flier.seed, 6)

  const ox = slot.left + slot.width / 2 - CARD_W / 2
  const oy = CARD_H / 2 - CARD_PAD - CHIP_H / 2
  const card = stepPose(step, local)
  const target = onCard(card, ox, oy)
  const normal = turnX(turnY([0, 0, 1], card.ry), card.rx)
  const rest = onCard(stepPose(step, flier.arrive), ox, oy)

  const reach = mix(0.2, 0.5, r1)
  const from: Vec = [
    540 + (step.x - 540) * reach + (r2 - 0.5) * 150,
    PIVOT.y + (step.y - PIVOT.y) * reach + (r3 - 0.5) * 150,
    draftZ(flier.launch) + 8,
  ]
  const dx = rest[0] - from[0]
  const dy = rest[1] - from[1]
  const swirl = mix(0.35, 0.6, r4)
  const out: Vec = [
    from[0] + dx * 0.3 - dy * swirl,
    from[1] + dy * 0.3 + dx * swirl,
    from[2] + mix(140, 300, r5),
  ]
  const above = mix(160, 260, r6)
  const down: Vec = [
    target[0] + normal[0] * above,
    target[1] + normal[1] * above,
    target[2] + normal[2] * above,
  ]

  const a = (1 - v) ** 3
  const b = 3 * (1 - v) ** 2 * v
  const c = 3 * (1 - v) * v * v
  const d = v ** 3
  const position: Vec = [
    a * from[0] + b * out[0] + c * down[0] + d * target[0],
    a * from[1] + b * out[1] + c * down[1] + d * target[1],
    a * from[2] + b * out[2] + c * down[2] + d * target[2],
  ]
  // It leaves flat on the draft, tumbles, and arrives square to its step.
  const tumble = Math.sin(Math.PI * u) * (1 - 0.6 * v)

  return {
    position,
    u,
    v,
    rx: (r5 - 0.5) * 70 * tumble + card.rx * v,
    ry: (r6 - 0.5) * 70 * tumble + card.ry * v,
    rz: (r1 - 0.5) * 110 * tumble + card.rz * v,
    scale: card.scale * mix(0.35, 1, ease.outCubic(clamp(u / 0.3))),
  }
}

/* ------------------------------------------------------------------------------------ */
/* The shot                                                                             */
/* ------------------------------------------------------------------------------------ */

export function Shot({ copy }: { copy: FilmCopy }) {
  const { local, duration } = useShot()
  if (local < -400 || local >= duration + 400) return null

  const fade = 1 - progress(local, FADE, 260, ease.inCubic)
  if (fade <= 0.001) return null

  // The whip in: in from the right as the library whips out, fast through the cut,
  // smeared while it is fast, settled on the bar.
  const shift = 1150 * (1 - ease.outExpo(clamp((local + 220) / 380)))

  return (
    <div className="absolute inset-0" style={{ opacity: fade }}>
      <div style={{ opacity: progress(local, -120, 400) }}>
        <Dust count={14} seed={31} opacity={0.3} />
      </div>
      {shift < 1100 ? (
        <div className="absolute inset-0" style={shift > 0.5 ? whip(shift) : undefined}>
          <World copy={copy} />
        </div>
      ) : null}
      <Fliers copy={copy} />
      <PickMarks />
      <Flash at={FAN - 14} rise={40} fall={380} color="#ffd8c2" peak={0.22} />
      <Headline text={copy.film.headlines.draft} />
    </div>
  )
}

function World({ copy }: { copy: FilmCopy }) {
  const { local } = useShot()
  const camera = cameraAt(local)
  const turn = worldTurn(local)
  const t = local / 1000
  const rows = layout(copy)
  // The light behind the dialog swells while the AI works, peaks on the cut.
  const swell = interpolate(
    local,
    [1100, PREVIEW, PREVIEW + 600],
    [0, 1, 0],
    [ease.inCubic, ease.outCubic],
  )

  // Everything but the picked step falls into the dark once it is picked.
  const focus = progress(local, CLICK + 80, 420, ease.inOutCubic)

  return (
    <Camera zoom={camera.zoom} x={camera.x} y={camera.y} roll={camera.roll} blur={camera.blur}>
      <Space depth={DEPTH} originX={HANDOFF_POINT.x} originY={HANDOFF_POINT.y}>
        <div
          className="absolute inset-0"
          style={{
            transformStyle: 'preserve-3d',
            transformOrigin: `${PIVOT.x}px ${PIVOT.y}px ${PIVOT_Z}px`,
            transform: `rotateX(${turn.rx}deg) rotateY(${turn.ry}deg)`,
          }}
        >
          <Depth z={-700}>
            <Glow
              x={PIVOT.x}
              y={PIVOT.y}
              size={1300}
              opacity={0.32 + 0.05 * Math.sin(t * 2.1) + 0.22 * swell}
            />
            <Rays />
          </Depth>
          <Depth z={-260}>
            <Ring
              at={PREVIEW}
              x={PIVOT.x}
              y={PIVOT.y}
              from={120}
              to={980}
              duration={760}
              width={3}
              color="#ffb58a"
            />
            <Ring
              at={PREVIEW + 90}
              x={PIVOT.x}
              y={PIVOT.y}
              from={120}
              to={1250}
              duration={900}
              width={1.5}
            />
          </Depth>
          <Depth z={-60}>
            <Gather />
          </Depth>
          <Dialog copy={copy} focus={focus} />
          {STEPS.map((step, index) => (
            <StepCardLayer
              key={step.n}
              step={step}
              index={index}
              slots={rows.slots[index] ?? []}
              size={rows.size}
              focus={focus}
            />
          ))}
        </div>
      </Space>
    </Camera>
  )
}

/** A full-frame plane at depth `z`, for things drawn in world coordinates. */
function Depth({ z, children }: { z: number; children: ReactNode }) {
  return (
    <div
      className="pointer-events-none absolute inset-0"
      style={{ transform: `translateZ(${z}px)`, transformStyle: 'preserve-3d' }}
    >
      {children}
    </div>
  )
}

/** Soft rays behind the dialog: faint while the AI works, bursting as the lesson exists. */
function Rays() {
  const { local } = useShot()
  const amount = interpolate(
    local,
    [1200, PREVIEW, FAN + 140, 2600, HANDOFF],
    [0, 0.3, 1, 0.5, 0],
    [ease.inCubic, ease.outCubic, ease.inOutCubic, ease.inOutCubic],
  )
  if (amount <= 0.001) return null
  const size = 1500

  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        left: PIVOT.x - size / 2,
        top: PIVOT.y - size / 2,
        width: size,
        height: size,
        borderRadius: '50%',
        opacity: 0.75 * amount,
        transform: `rotate(${local * 0.012}deg) scale(${mix(0.7, 1, ease.outExpo(clamp((local - PREVIEW) / 900)))})`,
        background:
          'repeating-conic-gradient(from 0deg, rgb(255 140 70 / 0) 0deg 7deg, rgb(255 140 70 / 0.34) 8.5deg, rgb(255 140 70 / 0) 10deg 15deg)',
        maskImage: 'radial-gradient(circle, black 8%, transparent 62%)',
        WebkitMaskImage: 'radial-gradient(circle, black 8%, transparent 62%)',
      }}
    />
  )
}

/** Where the form's middle is: what the AI draws its light into. */
const FORM_MIDDLE = world(260, 40 + FORM_H / 2)

const GATHER = Array.from({ length: 30 }, (_, index) => {
  const [r1 = 0, r2 = 0, r3 = 0, r4 = 0, r5 = 0] = randoms(800 + index, 5)
  return {
    angle: (index / 30) * 360 + r1 * 12,
    from: mix(540, 860, r2),
    at: 1080 + r3 * 290,
    life: mix(280, 400, r4),
    size: mix(2, 4.5, r5),
    color: index % 4 === 0 ? '#ffffff' : index % 2 === 0 ? '#ffb58a' : BRAND,
  }
})

/**
 * While the AI works, streaks of light are pulled in from all round, faster and faster,
 * and vanish behind the dialog: the breath before the burst.
 */
function Gather() {
  const { local } = useShot()
  if (local < 1080 || local > PREVIEW) return null

  const at = (mote: (typeof GATHER)[number], p: number) => {
    const pull = ease.inCubic(clamp(p))
    const r = mix(mote.from, 120, pull)
    const a = (mote.angle + 55 * pull) * RAD
    return { x: FORM_MIDDLE.x + Math.cos(a) * r, y: FORM_MIDDLE.y + Math.sin(a) * r * 0.92 }
  }

  return (
    <>
      {GATHER.map((mote, index) => {
        const p = (local - mote.at) / mote.life
        if (p <= 0 || p >= 1) return null
        const here = at(mote, p)
        const back = at(mote, p - 0.06)
        const heading = Math.atan2(here.y - back.y, here.x - back.x) / RAD
        const length = mote.size * mix(2, 10, ease.inCubic(p))
        return (
          <span
            key={index}
            style={{
              position: 'absolute',
              left: here.x - length,
              top: here.y - mote.size / 2,
              width: length,
              height: mote.size,
              borderRadius: 999,
              background: mote.color,
              opacity: Math.min(1, p * 5),
              transformOrigin: '100% 50%',
              transform: `rotate(${heading}deg)`,
              boxShadow: `0 0 ${mote.size * 2.2}px ${mote.color}`,
            }}
          />
        )
      })}
    </>
  )
}

/**
 * The real AI lesson dialog, filmed: the form, the press, "generating" with its edge lit,
 * then — cut under the flash — the finished draft, which grows to its height as the
 * product's dialog does and sinks back as its steps come forward.
 */
function Dialog({ copy, focus }: { copy: FilmCopy; focus: number }) {
  const { local } = useShot()
  const height = mix(FORM_H, PREVIEW_H, progress(local, PREVIEW + 12, 300, ease.house))

  // While the draft is being made its edge burns like the AI is thinking; it flares as
  // the draft lands and goes out.
  const edge = interpolate(
    local,
    [PRESS + 20, PRESS + 160, PREVIEW + 30, PREVIEW + 460],
    [0, 1, 1, 0],
    [ease.outCubic, ease.linear, ease.inOutCubic],
  )
  const flare = interpolate(
    local,
    [PREVIEW - 60, PREVIEW + 10, PREVIEW + 420],
    [0, 1, 0],
    [ease.inCubic, ease.outCubic],
  )
  const reveal = interpolate(local, [PREVIEW - 28, PREVIEW + 4], [0, 1])

  return (
    <div
      style={{
        position: 'absolute',
        left: 540 - 260,
        top: D_TOP - 40,
        width: 520,
        height: 720,
        transformOrigin: '260px 40px',
        transform: `translateZ(${draftZ(local)}px) scale(${D_SCALE})`,
        opacity: 1 - 0.1 * focus,
        filter: focus > 0.01 ? `blur(${2.6 * focus}px) brightness(${1 - 0.6 * focus})` : undefined,
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: 40,
          top: 40,
          width: 440,
          height,
          borderRadius: 12,
          boxShadow: '0 60px 110px -30px rgb(0 0 0 / 0.8), 0 26px 50px -24px rgb(0 0 0 / 0.6)',
        }}
      />
      {edge > 0.001 || flare > 0.001 ? (
        <EdgeLight height={height} amount={edge} flare={flare} />
      ) : null}
      {local < FAN ? <Replica scene="draft" ms={formMs(local)} copy={copy.promo} /> : null}
      {local >= DRAFT_MOUNT ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: reveal,
            clipPath:
              height < PREVIEW_H - 0.5
                ? `inset(38px 38px ${720 - 42 - height}px 38px round 14px)`
                : undefined,
          }}
        >
          <Replica scene="draft" ms={DRAFT_MS} copy={copy.promo} />
        </div>
      ) : null}
      <PressBurst />
      <Twinkles />
    </div>
  )
}

/** A ring of light running round the dialog's edge — the AI at work — and its flare. */
function EdgeLight({ height, amount, flare }: { height: number; amount: number; flare: number }) {
  const { local } = useShot()
  const turn = local * 0.55
  const ring = `conic-gradient(from ${turn}deg, #ff4f01, #ffb58a, #fff4ec, #ff7a33, #ff4f01 60%, #ffc6a4, #ff4f01)`
  const box = (pad: number): CSSProperties => ({
    position: 'absolute',
    left: 40 - pad,
    top: 40 - pad,
    width: 440 + pad * 2,
    height: height + pad * 2,
    borderRadius: 12 + pad,
    background: ring,
  })

  return (
    <>
      <div
        aria-hidden
        style={{
          ...box(14 + 22 * flare),
          filter: `blur(${22 + 14 * flare}px)`,
          opacity: Math.min(1, 0.75 * amount + 0.3 * flare),
        }}
      />
      {amount > 0.001 ? <div aria-hidden style={{ ...box(2.5), opacity: amount }} /> : null}
    </>
  )
}

/** A four-point star that swells and shrinks, turning as it goes. */
function Star({
  x,
  y,
  size,
  at,
  life,
  dx = 0,
  dy = 0,
  spin = 90,
  color = '#ffffff',
}: {
  x: number
  y: number
  size: number
  at: number
  life: number
  dx?: number
  dy?: number
  spin?: number
  color?: string
}) {
  const { local } = useShot()
  const p = (local - at) / life
  if (p <= 0 || p >= 1) return null
  const swell = Math.sin(Math.PI * Math.min(1, p * 1.25))
  const travel = ease.outExpo(p)

  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      width={size}
      height={size}
      style={{
        position: 'absolute',
        left: x + dx * travel - size / 2,
        top: y + dy * travel - size / 2,
        overflow: 'visible',
        opacity: Math.min(1, swell * 1.6),
        transform: `scale(${swell}) rotate(${spin * p}deg)`,
        filter: 'drop-shadow(0 0 3px rgb(255 140 60 / 0.95))',
      }}
    >
      <path d={STAR_PATH} fill={color} />
    </svg>
  )
}

const STAR_PATH =
  'M12 0C12.9 7.1 16.9 11.1 24 12C16.9 12.9 12.9 16.9 12 24C11.1 16.9 7.1 12.9 0 12C7.1 11.1 11.1 7.1 12 0Z'

const PRESS_STARS = Array.from({ length: 11 }, (_, index) => {
  const [r1 = 0, r2 = 0, r3 = 0, r4 = 0] = randoms(400 + index, 4)
  const angle = ((index / 11) * 360 + r1 * 26 - 90) * (Math.PI / 180)
  const reach = mix(50, 150, r2)
  return {
    dx: Math.cos(angle) * reach,
    dy: Math.sin(angle) * reach * 0.8,
    size: mix(9, 21, r3),
    delay: r4 * 140,
    life: mix(460, 760, r3),
    color: index % 3 === 0 ? '#ffc29e' : '#ffffff',
  }
})

/** The press: a quick warm bloom, two rings, sparks and stars from the button. */
function PressBurst() {
  const { local } = useShot()
  if (local < PRESS - 10 || local > PRESS + 950) return null
  const bloom = interpolate(
    local,
    [PRESS, PRESS + 50, PRESS + 380],
    [0, 1, 0],
    [ease.outCubic, ease.inOutCubic],
  )
  const { x, y } = BUTTON_STAGE

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{ overflow: 'visible' }}
    >
      {bloom > 0.001 ? (
        <>
          <Glow x={x} y={y} size={170} opacity={0.75 * bloom} />
          <Glow x={x} y={y} size={60} color="#fff6f0" opacity={0.95 * bloom} />
        </>
      ) : null}
      <Ring at={PRESS} x={x} y={y} from={6} to={96} duration={520} width={2} />
      <Ring
        at={PRESS + 80}
        x={x}
        y={y}
        from={6}
        to={150}
        duration={660}
        width={1.1}
        color="#ffb58a"
      />
      <Burst
        at={PRESS}
        x={x}
        y={y}
        count={24}
        seed={21}
        speed={[180, 520]}
        size={[1.4, 3.2]}
        life={[300, 620]}
        gravity={60}
        shape="spark"
      />
      {PRESS_STARS.map((star, index) => (
        <Star
          key={index}
          x={x}
          y={y}
          size={star.size}
          at={PRESS + star.delay}
          life={star.life}
          dx={star.dx}
          dy={star.dy}
          spin={140}
          color={star.color}
        />
      ))}
    </div>
  )
}

/** Twinkles on the dialog: one on its AI mark early, then round its edge while it works. */
const TWINKLES = [
  { x: 72, y: 72, at: 240, size: 16 },
  { x: 488, y: 120, at: 1090, size: 14 },
  { x: 32, y: 300, at: 1150, size: 11 },
  { x: 474, y: 392, at: 1210, size: 16 },
  { x: 150, y: 490, at: 1270, size: 12 },
  { x: 330, y: 32, at: 1320, size: 13 },
  { x: 40, y: 120, at: 1380, size: 10 },
] as const

function Twinkles() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{ overflow: 'visible' }}
    >
      {TWINKLES.map((twinkle, index) => (
        <Star
          key={index}
          x={twinkle.x}
          y={twinkle.y}
          size={twinkle.size}
          at={twinkle.at}
          life={420}
          spin={120}
        />
      ))}
    </div>
  )
}

/** One step of the draft, in the world. */
function StepCardLayer({
  step,
  index,
  slots,
  size,
  focus,
}: {
  step: Step
  index: number
  slots: Slot[]
  size: number
  focus: number
}) {
  const { local } = useShot()
  if (local < step.at) return null

  const pose = stepPose(step, local)
  const u = clamp((local - step.at) / FLIGHT)
  const motion = u < 1 ? 4.5 * (1 - u) ** 2 : 0
  let opacity = progress(local, step.at, 60)
  let selected = 0
  let filter: string | undefined

  if (step.n === PICKED) {
    selected = progress(local, CLICK, 220, ease.outCubic)
    filter = motion > 0.05 ? `blur(${motion}px)` : undefined
  } else {
    // Out of focus is into the dark: the picked card is the only lit thing left.
    opacity *= 1 - 0.1 * focus
    const blur = motion + 2.6 * focus
    filter =
      focus > 0.01
        ? `blur(${blur}px) brightness(${1 - 0.6 * focus})`
        : motion > 0.05
          ? `blur(${motion}px)`
          : undefined
  }

  return (
    <Layer
      cx={pose.x}
      cy={pose.y}
      width={CARD_W}
      height={CARD_H}
      pose={{ z: pose.z, rotateX: pose.rx, rotateY: pose.ry, rotateZ: pose.rz, scale: pose.scale }}
      opacity={opacity}
      flat
      style={{ filter }}
    >
      <StepCard
        step={step}
        index={index}
        slots={slots}
        size={size}
        selected={selected}
        sheen={progress(local, step.at + 300, 320, ease.inOutCubic)}
        flight={1 - progress(local, step.at + 140, 320, ease.inOutCubic)}
      />
    </Layer>
  )
}

const PILL: CSSProperties = {
  position: 'absolute',
  height: CHIP_H,
  borderRadius: 999,
  border: '1px solid #e7e5e4',
  background: 'white',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 500,
  color: '#44403c',
  whiteSpace: 'nowrap',
  lineHeight: 1,
}

const COUNTER: CSSProperties = {
  background: '#fff3ec',
  border: '1px solid rgb(255 79 1 / 0.3)',
  color: BRAND_DEEP,
  fontWeight: 600,
  fontVariantNumeric: 'tabular-nums',
}

/** A block docked in a step's row: it snaps in with a pop and a ring of the brand colour. */
function DockedChip({
  slot,
  label,
  size,
  since,
  counter = false,
}: {
  slot: Slot
  label: string
  size: number
  since: number
  counter?: boolean
}) {
  const snap = spring(since, { stiffness: 420, damping: 20 })
  const ring = 1 - progress(since, 0, 320, ease.outCubic)

  return (
    <span
      style={{
        ...PILL,
        ...(counter ? COUNTER : null),
        left: slot.left,
        top: CARD_H - CARD_PAD - CHIP_H,
        width: slot.width,
        fontSize: size,
        transform: `scale(${mix(1.1, 1, snap)})`,
        boxShadow:
          ring > 0.01
            ? `0 0 0 2px rgb(255 79 1 / ${0.85 * ring}), 0 0 16px 2px rgb(255 79 1 / ${0.35 * ring})`
            : undefined,
      }}
    >
      {label}
    </span>
  )
}

function StepCard({
  step,
  index,
  slots,
  size,
  selected,
  sheen,
  flight,
}: {
  step: Step
  index: number
  slots: Slot[]
  size: number
  selected: number
  sheen: number
  /** 1 while it flies: it trails the brand's light, gone by the time it lands. */
  flight: number
}) {
  const { local } = useShot()
  const dock = DOCK_AT[index] ?? 2000
  const counted = FLIERS.filter(
    (flier) => flier.step === index && flier.slot === 2 && local >= flier.arrive,
  )
  const latest = counted[counted.length - 1]
  const [first, second, counter] = slots
  const landAt = step.at + 300

  return (
    <div style={{ position: 'relative', width: CARD_W, height: CARD_H }}>
      {flight > 0.001 ? (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 21,
            boxShadow: `0 0 70px 14px rgb(255 79 1 / ${0.65 * flight})`,
          }}
        />
      ) : null}
      {selected > 0.001 ? (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: -6,
            borderRadius: 27,
            border: `3px solid ${BRAND}`,
            boxShadow: '0 0 44px 6px rgb(255 79 1 / 0.5)',
            opacity: selected,
            transform: `scale(${mix(1.06, 1, selected)})`,
          }}
        />
      ) : null}
      <UiCard
        width={CARD_W}
        height={CARD_H}
        radius={21}
        padding={CARD_PAD}
        style={{ position: 'relative' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
          <span
            style={{
              position: 'relative',
              width: 38,
              height: 38,
              flexShrink: 0,
              borderRadius: 999,
              background: '#f4f4f5',
              color: '#71717a',
              display: 'grid',
              placeItems: 'center',
              fontSize: 17,
              fontWeight: 600,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            <span style={{ opacity: 1 - selected }}>{step.n}</span>
            {selected > 0.001 ? (
              <span
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: 999,
                  background: BRAND,
                  display: 'grid',
                  placeItems: 'center',
                  transform: `scale(${0.3 + 0.7 * spring(selected * 420, { stiffness: 320, damping: 24 })})`,
                }}
              >
                <CheckIcon color="white" strokeWidth={3} style={{ width: 21, height: 21 }} />
              </span>
            ) : null}
          </span>
          <span
            style={{
              fontSize: 25,
              fontWeight: 600,
              letterSpacing: '-0.018em',
              whiteSpace: 'nowrap',
            }}
          >
            {step.title}
          </span>
        </div>
        {first && local >= dock ? (
          <DockedChip slot={first} label={first.label} size={size} since={local - dock} />
        ) : null}
        {second && local >= dock + EIGHTH ? (
          <DockedChip
            slot={second}
            label={second.label}
            size={size}
            since={local - dock - EIGHTH}
          />
        ) : null}
        {counter && latest ? (
          <DockedChip
            slot={counter}
            label={`+${counted.length}`}
            size={size}
            since={local - latest.arrive}
            counter
          />
        ) : null}
        {sheen > 0 && sheen < 1 ? (
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(115deg, rgb(255 240 230 / 0) 46%, rgb(255 240 230 / 0.7) 50%, rgb(255 240 230 / 0) 54%)',
              backgroundSize: '300% 100%',
              backgroundPosition: `${mix(100, 0, sheen)}% 0`,
              mixBlendMode: 'plus-lighter',
            }}
          />
        ) : null}
      </UiCard>
      <Star x={CARD_W - 12} y={10} size={24} at={landAt} life={500} spin={120} />
      <Star
        x={16}
        y={CARD_H - 10}
        size={14}
        at={landAt + 90}
        life={420}
        spin={-120}
        color="#ffc29e"
      />
    </div>
  )
}

/**
 * The blocks in flight. They are drawn over the world, each laid onto its exact projected
 * quad: in the world, a block homing onto a tilted step would cut through it.
 */
function Fliers({ copy }: { copy: FilmCopy }) {
  const { local } = useShot()
  if (local < FAN || local > 2200) return null
  const rows = layout(copy)

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {FLIERS.map((flier, index) => {
        const slot = rows.slots[flier.step]?.[flier.slot]
        if (!slot) return null
        const label = flier.slot === 2 ? blockName(copy, flier.extra) : slot.label
        return <FlierMark key={index} flier={flier} slot={slot} label={label} size={rows.size} />
      })}
    </div>
  )
}

/** A block flying from the draft to its step: blurred while fast, trailing the brand's light. */
function FlierMark({
  flier,
  slot,
  label,
  size,
}: {
  flier: Flier
  slot: Slot
  label: string
  size: number
}) {
  const { local } = useShot()
  if (local < flier.launch || local >= flier.arrive) return null

  const now = flierAt(flier, slot, local)
  // A counted block shrinks into the step's "+N" rather than taking a place of its own.
  const counted = flier.slot === 2
  const width = counted ? chipWidth(label, size) : slot.width
  const shrink = counted ? mix(1, 0.4, ease.inOutCubic(clamp((now.u - 0.35) / 0.65))) : 1
  const opacity =
    progress(local, flier.launch, 70) *
    (counted ? 1 - ease.inCubic(clamp((now.u - 0.75) / 0.25)) : 1)
  if (opacity <= 0.001) return null

  const project = projector(local)
  const scale = now.scale * shrink
  const corner = (dx: number, dy: number) => {
    const [x, y, z] = turnX(turnY(turnZ([dx * scale, dy * scale, 0], now.rz), now.ry), now.rx)
    return project([now.position[0] + x, now.position[1] + y, now.position[2] + z])
  }
  const transform = quadTransform(width, CHIP_H, [
    corner(-width / 2, -CHIP_H / 2),
    corner(width / 2, -CHIP_H / 2),
    corner(width / 2, CHIP_H / 2),
    corner(-width / 2, CHIP_H / 2),
  ])
  if (!transform) return null

  // Motion blur from how far its middle moved on screen in the last 16 ms.
  const here = project(now.position)
  const there = projector(local - 16)(flierAt(flier, slot, local - 16).position)
  const blur = clamp((Math.hypot(here.x - there.x, here.y - there.y) - 8) / 12, 0, 5)

  return (
    <span
      style={{
        ...PILL,
        left: 0,
        top: 0,
        width,
        fontSize: size,
        transformOrigin: '0 0',
        transform,
        opacity,
        filter: blur > 0.05 ? `blur(${blur}px)` : undefined,
        boxShadow: `0 0 22px 3px rgb(255 79 1 / ${0.5 * (1 - now.v)}), 0 12px 22px -10px rgb(0 0 0 / 0.55)`,
      }}
    >
      {label}
    </span>
  )
}

/**
 * The teacher's pointer, in the product's own look, and its click — drawn over the world
 * in screen space, on the point of step 2's title projected through the camera, so the
 * card's 3D never cuts them. They ride with the card, and are gone before it flies.
 */
function PickMarks() {
  const { local } = useShot()
  if (local < 2260 || local > CLICK + 620) return null

  const step = STEPS[PICKED - 1]
  if (!step) return null
  const pick = projector(local)(onCard(stepPose(step, local), PICK.x, PICK.y))

  const appear = progress(local, 2260, 200, ease.outCubic)
  const vanish = progress(local, CLICK + 40, 160, ease.inCubic)
  const opacity = appear * (1 - vanish)
  const glide = progress(local, 2440, 520, ease.house)
  const x = mix(1000, pick.x, glide)
  const y = mix(1180, pick.y, glide)
  const press =
    local >= CLICK && local < CLICK + 200 ? Math.sin(((local - CLICK) / 200) * Math.PI) : 0

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <Ring at={CLICK} x={pick.x} y={pick.y} from={8} to={70} duration={460} width={2.5} />
      <Burst
        at={CLICK}
        x={pick.x}
        y={pick.y}
        count={12}
        seed={33}
        speed={[120, 320]}
        size={[3, 6]}
        life={[280, 500]}
        gravity={160}
      />
      {opacity > 0.001 ? (
        <div
          style={{
            position: 'absolute',
            left: x - 6,
            top: y - 6,
            opacity,
            transform: `scale(${1 - press * 0.14})`,
            transformOrigin: '6px 6px',
            filter: 'drop-shadow(0 6px 12px rgb(0 0 0 / 0.5))',
          }}
        >
          <MousePointer2Icon
            style={{ width: 38, height: 38, color: 'white', fill: '#171717' }}
            strokeWidth={1.5}
          />
        </div>
      ) : null}
    </div>
  )
}

/** "ШІ пропонує —" over the fan, then "ви вирішуєте" slams in on the bar, the accent on its own line. */
function Headline({ text }: { text: string }) {
  const { local } = useShot()
  if (local < LINE_1 - 20) return null

  const [first, second] = splitHeadline(text)
  // About half an em a letter at this weight and tracking: as big as the longer line fits.
  const longest = Math.max(plain(first).length, plain(second).length)
  const size = clamp(Math.round(860 / (longest * 0.52)), 84, 106)
  const drift = progress(local, LINE_1, 2600) * -6

  return (
    <div
      className="absolute text-center"
      style={{
        left: 90,
        top: 170,
        width: 900,
        fontSize: size,
        fontWeight: 650,
        letterSpacing: '-0.035em',
        lineHeight: 1.08,
        transform: `translateY(${drift}px)`,
      }}
    >
      <div>
        <KineticText text={first} at={LINE_1} stagger={80} from={{ y: 80, blur: 16, opacity: 0 }} />
      </div>
      {second ? (
        <div>
          <KineticText
            text={second}
            at={LINE_2}
            stagger={60}
            duration={240}
            marker
            from={{ scale: 1.4, blur: 8, opacity: 0 }}
          />
        </div>
      ) : null}
    </div>
  )
}

/**
 * The plain words on one line, the accented run on the next: the same split in any
 * language. The run is one token (no-break spaces), so it slams in as one and takes one
 * unbroken marker.
 */
function splitHeadline(text: string): [string, string] {
  const words = parseAccents(text)
  const first = words.findIndex((word) => word.accent)
  if (first <= 0) return [text, '']

  const head = words
    .slice(0, first)
    .map((word) => word.word)
    .join(' ')
  const parts: string[] = []
  let run: string[] = []
  const flush = () => {
    if (run.length > 0) parts.push(`*${run.join(' ')}*`)
    run = []
  }
  for (const word of words.slice(first)) {
    if (word.accent) {
      run.push(word.word)
    } else {
      flush()
      parts.push(word.word)
    }
  }
  flush()
  return [head, parts.join(' ')]
}
