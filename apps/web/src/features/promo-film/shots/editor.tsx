'use client'

import { CheckIcon, MousePointer2Icon } from 'lucide-react'
import { Fragment, type ReactNode } from 'react'
import { GAP_WORDS } from '@/features/login-promo/scenes/editor/data'
import type { Cue } from '../audio/cues'
import type { FilmCopy } from '../copy'
import { Backdrop, FULL, Glow } from '../fx/backdrop'
import { Burst, Dust, Flash, Ring } from '../fx/effects'
import { Layer, Space } from '../fx/space'
import { UiCard } from '../fx/surface'
import { KineticText, parseAccents } from '../fx/text'
import { Replica } from '../replica'
import {
  BRAND,
  bezier,
  clamp,
  ease,
  FPS,
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

/**
 * Chapter 03 — the editor: one click turns a word into a gap.
 *
 * An iris opens from the draft's step onto an extreme close-up of the real step canvas (the
 * sign-in tour's editor scene, filmed), the page filling the frame under a macro lens. The
 * pointer clicks "have": it becomes a gap with an orange pop, the camera drops back and the
 * headline's first words slam into the space it opens. The camera dollies along the line to
 * "card" while the headline sets itself like an exercise, with one blank. The second click
 * lands on the bar: "card" is stamped out of the page as an orange chip, thrown up into the
 * blank, and sweeps across it as the accent word's marker — the proof becomes the claim —
 * while the lens pulls all the way back to the whole block, saved. Exit: a vertical whip up
 * and away while the live lesson rises from below.
 */

/* The beats this shot is cut to (shot-local ms; 120 BPM, a beat every 500). */
const CLICK_HAVE = 1000
const CLICK_CARD = 2000
/** "card", stamped orange, lifts off the page toward the lens… */
const LIFT = CLICK_CARD
/** …is thrown up at the headline's blank… */
const LAUNCH = 2080
/** …lands on it, and sweeps across it as the accent's marker. */
const LAND = 2250
const SWEEP = 300
const SAVED = 2500
/** The held frame's beats: each gap's line ticks once. */
const TICKS = [3000, 3500] as const
const EXIT = 3600

export const cues: readonly Cue[] = [
  { at: -380, kind: 'whoosh', duration: 620, gain: 0.55 },
  { at: CLICK_HAVE - 70, kind: 'click', gain: 0.7, pan: -0.1 },
  { at: CLICK_HAVE, kind: 'pop', gain: 0.9, pan: -0.1 },
  { at: CLICK_HAVE, kind: 'impact', gain: 0.45 },
  { at: 1150, kind: 'whoosh', duration: 600, gain: 0.3, pan: 0.45 },
  { at: CLICK_CARD - 70, kind: 'click', gain: 0.75, pan: 0.15 },
  { at: CLICK_CARD, kind: 'pop', gain: 1, pitch: 3, pan: 0.15 },
  { at: CLICK_CARD, kind: 'impact', gain: 0.7 },
  { at: LAUNCH - 40, kind: 'whoosh', duration: 420, gain: 0.5 },
  { at: LAND, kind: 'thud', gain: 0.6 },
  { at: SAVED, kind: 'chime', gain: 0.7, pan: 0.35 },
]

/**
 * The scene's own clock, warped onto the shot's beats: its gaps appear on the two clicks,
 * its hover tints when this shot's pointer arrives, its autosave reads "saved" on beat 5.
 * Between its moments nothing in the scene moves by itself, so the warp never shows.
 */
function sceneMs(local: number): number {
  return interpolate(
    local,
    [-400, 250, 800, CLICK_HAVE, 1160, 1800, CLICK_CARD, 2200, 2350, SAVED, 4400],
    [1350, 1790, 1975, 2390, 2745, 2895, 3360, 3725, 4160, 4440, 4900],
  )
}

/**
 * The part of the scene's 520×720 stage that is filmed: the editor's card with a margin of
 * page around it. Every point below is in the stage's own px, measured on the replica with
 * the shot's transforms removed; they are the same in every language.
 */
const CROP = { x: 16, y: 16, width: 488, height: 448 }
type Box = { x: number; y: number; w: number; h: number }
const HAVE_GAP: Box = { x: 156.6, y: 191.5, w: 51, h: 33.9 }
const CARD_GAP: Box = { x: 359, y: 225.4, w: 51, h: 33.9 }
const BLOCK: Box = { x: 67.5, y: 111.1, w: 394.5, h: 260.4 }
/** The saved status in the step's top row (its text, uk 391.6–451.3 / tr 398.1–451.3). */
const STATUS = { x: 422, y: 76.6 }
/** The editor card's top-right corner. */
const CARD_CORNER = { x: 480, y: 40 }
/** The answer words are 15px in the product, drawn at the scene's 0.9. */
const ANSWER_PX = 13.5

/** The product's autosave status, which the saved callout lifts off. */
const STATUS_SELECTOR =
  '[data-editor-shot] [data-promo-scene] .rounded-2xl > div > div > div:first-child > span:nth-child(3)'

const centre = (box: Box) => ({ x: box.x + box.w / 2, y: box.y + box.h / 2 })

/**
 * The page is laid out this many times larger than the stage and only ever scaled down by
 * the lens, so its type stays sharp in the close-up (a 3D layer is rasterised at its own
 * size and would otherwise be stretched).
 */
const ZOOM = 3

const FRAME = 1000 / FPS

/* ------------------------------------------------------------------------------------ */
/* The camera                                                                           */
/* ------------------------------------------------------------------------------------ */

/**
 * The lens, as a pose of the page: the stage point (ox, oy) it looks at sits at frame
 * point (fx, fy); the page is scaled by `s` and turned about that point. Moving the focus
 * slides the page under the lens the way a dolly would.
 */
type Lens = {
  ox: number
  oy: number
  fx: number
  fy: number
  s: number
  rx: number
  ry: number
  rz: number
}

/** A long lens: enough perspective for depth, not so much that upright type leans. */
const DEPTH = 2000
const DRIFT = ease.inOutCubic
const DOLLY = bezier(0.65, 0, 0.3, 1)
const PULL = bezier(0.72, 0, 0.16, 1)

/** The dolly: what the lens looks at — "have", then "card", then the whole block. */
const ALONG = [-400, 1150, 1800, 2060, 2560]
const ALONG_CURVES = [DRIFT, DOLLY, DRIFT, PULL]
/**
 * The framing: high and close until the first click, the page filling the frame; the click
 * drops the camera back into place, opening the dark above the page for the headline.
 */
const FRAMING = [-400, CLICK_HAVE, CLICK_HAVE + 300, 2060, 2560]
const FRAMING_CURVES = [DRIFT, ease.outExpo, DRIFT, PULL]

function lensAt(local: number): Lens {
  const along = (values: readonly number[]) => interpolate(local, ALONG, values, ALONG_CURVES)
  const framing = (values: readonly number[]) => interpolate(local, FRAMING, values, FRAMING_CURVES)
  // Through the iris: the page rushes up to the lens.
  const arrive = 1 - 0.18 * (1 - progress(local, -400, 800, ease.outExpo))
  // A slow orbit and push that is already turning when the pull-back lands, so the held
  // frame never stops.
  const orbit = clamp((local - 2300) / 2100)
  // The second click knocks the page back.
  const recoil = 3 * kick(local - CLICK_CARD)
  // Out: the page tips away as the whip takes it.
  const leave = progress(local, EXIT, 400, ease.inCubic)

  return {
    ox: along([176, 180, 376, 380, 262]),
    oy: along([207, 210, 244, 244, 238]),
    fx: along([480, 540, 560, 560, 540]),
    fy: framing([545, 600, 880, 900, 832]) - 14 * orbit,
    s: framing([2.74, 2.94, 2.6, 2.64, 1.52]) * arrive * (1 + 0.1 * orbit) * (1 - 0.06 * leave),
    rx: framing([32, 30, 28, 27, 13]) - 5 * orbit + recoil + 10 * leave,
    ry: along([6, 4, -1, -2, -10]) + 22 * orbit,
    rz: along([1.2, 0.2, 0, 0, -0.4]) + 1.6 * orbit,
  }
}

const rad = (degrees: number) => (degrees * Math.PI) / 180

/**
 * Where a point of the page lands in the frame, and how much it is magnified there: the
 * same transform the page's Layer gets (scale, then rotateZ, Y, X about the focus), then
 * the Space's perspective.
 */
function project(lens: Lens, px: number, py: number): { x: number; y: number; k: number } {
  const x0 = (px - lens.ox) * lens.s
  const y0 = (py - lens.oy) * lens.s

  const cz = Math.cos(rad(lens.rz))
  const sz = Math.sin(rad(lens.rz))
  const x1 = x0 * cz - y0 * sz
  const y1 = x0 * sz + y0 * cz

  const x2 = x1 * Math.cos(rad(lens.ry))
  const z2 = -x1 * Math.sin(rad(lens.ry))

  const cx = Math.cos(rad(lens.rx))
  const sx = Math.sin(rad(lens.rx))
  const y3 = y1 * cx - z2 * sx
  const z3 = y1 * sx + z2 * cx

  const f = DEPTH / (DEPTH - z3)
  return {
    x: WIDTH / 2 + (lens.fx + x2 - WIDTH / 2) * f,
    y: HEIGHT / 2 + (lens.fy + y3 - HEIGHT / 2) * f,
    k: lens.s * f,
  }
}

/** A camera punch: up in 70 ms, then let go. */
function kick(elapsed: number): number {
  if (elapsed <= 0 || elapsed > 900) return 0
  return (
    Math.sin((Math.min(elapsed, 70) / 70) * (Math.PI / 2)) *
    Math.exp(-Math.max(0, elapsed - 70) / 150)
  )
}

/** The exit: a vertical whip, accelerating up and out of frame. */
const WHIP = 380
const whipAt = (local: number) => -1150 * ease.inCubic(clamp((local - EXIT) / WHIP))

/* ------------------------------------------------------------------------------------ */
/* The page and what happens on it                                                      */
/* ------------------------------------------------------------------------------------ */

/** The filmed page, posed by the lens. Children are drawn on the page, in stage px. */
function Page({ lens, children }: { lens: Lens; children: ReactNode }) {
  const ox = (lens.ox - CROP.x) * ZOOM
  const oy = (lens.oy - CROP.y) * ZOOM
  const width = CROP.width * ZOOM
  const height = CROP.height * ZOOM

  return (
    <Layer
      cx={lens.fx - ox + width / 2}
      cy={lens.fy - oy + height / 2}
      width={width}
      height={height}
      origin={`${ox}px ${oy}px`}
      pose={{ rotateX: lens.rx, rotateY: lens.ry, rotateZ: lens.rz, scale: lens.s / ZOOM }}
    >
      <div style={{ position: 'absolute', left: 0, top: 0, zoom: ZOOM }}>
        <div style={{ position: 'absolute', left: -CROP.x, top: -CROP.y, width: 520, height: 720 }}>
          {children}
        </div>
      </div>
    </Layer>
  )
}

/**
 * On the page, where a word turns into a gap: the gap is stamped in orange (unless the
 * stamp lifts off as a chip), its outline springs off it and its line lights up.
 */
function PagePop({
  at,
  gap,
  stamp = true,
  big = false,
}: {
  at: number
  gap: Box
  stamp?: boolean
  big?: boolean
}) {
  const { local } = useShot()
  const elapsed = local - at
  if (elapsed < 0 || elapsed > 820) return null

  const spread = progress(elapsed, 0, 480, ease.outCubic)

  return (
    <>
      {stamp ? (
        <span
          style={{
            position: 'absolute',
            left: gap.x - 1,
            top: gap.y + 3,
            width: gap.w + 2,
            height: gap.h - 5,
            borderRadius: 5,
            background: BRAND,
            boxShadow: '0 0 6px 1.5px rgb(255 79 1 / 0.55)',
            opacity: interpolate(elapsed, [0, 30, 90, 300], [0.75, 0.95, 0.65, 0]),
          }}
        />
      ) : null}
      <span
        style={{
          position: 'absolute',
          left: gap.x - 2,
          top: gap.y + 1,
          width: gap.w + 4,
          height: gap.h - 2,
          borderRadius: 7,
          border: `1.4px solid ${BRAND}`,
          opacity: interpolate(elapsed, [0, 40, 480], [0, 1, 0]),
          transform: `scale(${mix(1, big ? 1.8 : 1.55, spread)})`,
        }}
      />
      <span
        style={{
          position: 'absolute',
          left: gap.x + 4,
          top: gap.y + gap.h - 2.6,
          width: gap.w - 8,
          height: 2.6,
          borderRadius: 2,
          background: BRAND,
          boxShadow: '0 0 6px 1px rgb(255 79 1 / 0.85)',
          transform: `scaleX(${progress(elapsed, 60, 240, ease.outExpo)})`,
          opacity: interpolate(elapsed, [0, 360, 820], [1, 1, 0]),
        }}
      />
    </>
  )
}

/** On the page, in the held frame: a gap's line flares once on its beat. */
function GapTick({ at, gap }: { at: number; gap: Box }) {
  const { local } = useShot()
  const elapsed = local - at
  if (elapsed < 0 || elapsed > 900) return null
  const glow = progress(elapsed, 0, 50, ease.outCubic) * Math.exp(-Math.max(0, elapsed - 50) / 190)
  if (glow < 0.01) return null

  return (
    <span
      style={{
        position: 'absolute',
        left: gap.x + 3,
        top: gap.y + gap.h - 2.8,
        width: gap.w - 6,
        height: 2.8,
        borderRadius: 2,
        background: '#ff6a1f',
        boxShadow: `0 0 ${(3 + 7 * glow).toFixed(2)}px ${(1 + 1.5 * glow).toFixed(2)}px rgb(255 79 1 / ${(0.85 * glow).toFixed(3)})`,
        opacity: glow,
        transform: `scaleX(${1 + 0.12 * glow})`,
      }}
    />
  )
}

/** On the page: the block glows emerald for a moment once it has saved. */
function SavedGlow() {
  const { local } = useShot()
  const elapsed = local - SAVED
  if (elapsed < 0 || elapsed > 1000) return null

  return (
    <span
      style={{
        position: 'absolute',
        left: BLOCK.x - 3,
        top: BLOCK.y - 3,
        width: BLOCK.w + 6,
        height: BLOCK.h + 6,
        borderRadius: 14,
        border: '1.5px solid #10b981',
        boxShadow: '0 0 18px rgb(16 185 129 / 0.45), inset 0 0 14px rgb(16 185 129 / 0.18)',
        opacity: interpolate(elapsed, [0, 90, 1000], [0, 1, 0]),
      }}
    />
  )
}

/* ------------------------------------------------------------------------------------ */
/* Over the page                                                                        */
/* ------------------------------------------------------------------------------------ */

/** A soft shockwave: a band of light widening from a point. */
function Wave({
  at,
  x,
  y,
  to,
  duration,
  color,
}: {
  at: number
  x: number
  y: number
  to: number
  duration: number
  color: string
}) {
  const { local } = useShot()
  const p = progress(local, at, duration, ease.outCubic)
  if (local < at || p >= 1) return null
  const r = mix(60, to, p)

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
        background: `radial-gradient(circle, transparent 58%, ${color} 69%, transparent 76%)`,
        opacity: interpolate(p, [0, 0.12, 1], [0, 1, 0]),
      }}
    />
  )
}

/** Rings and particles fly off the page toward the lens, from the gap as the lens sees it. */
function ScreenPop({
  at,
  x,
  y,
  seed,
  big = false,
}: {
  at: number
  x: number
  y: number
  seed: number
  big?: boolean
}) {
  return (
    <>
      <Ring
        at={at}
        x={x}
        y={y}
        from={30}
        to={big ? 290 : 210}
        duration={big ? 640 : 600}
        width={big ? 6 : 5}
      />
      <Ring
        at={at + 80}
        x={x}
        y={y}
        from={16}
        to={big ? 170 : 130}
        duration={520}
        color="#ffb58a"
        width={2.5}
      />
      {big ? (
        <>
          {/* The bar: a shockwave across the whole frame. */}
          <Ring at={at} x={x} y={y} from={40} to={900} duration={450} width={3} />
          <Wave at={at + 30} x={x} y={y} to={760} duration={620} color="rgb(255 110 40 / 0.4)" />
        </>
      ) : null}
      <Burst
        at={at}
        x={x}
        y={y}
        seed={seed}
        count={big ? 30 : 22}
        colors={[BRAND, '#ff8a3d', '#ffb58a', '#e22f00']}
        speed={[320, big ? 1150 : 860]}
        size={[7, big ? 17 : 15]}
        life={[480, 1000]}
        gravity={700}
      />
      <Burst
        at={at}
        x={x}
        y={y}
        seed={seed + 50}
        count={big ? 20 : 12}
        shape="spark"
        colors={[BRAND, '#ffc39e']}
        speed={[700, big ? 1600 : 1350]}
        size={[4, 7]}
        life={[280, 600]}
        gravity={150}
      />
    </>
  )
}

/** The pointer's path on the page (stage px), so it stays on its word while the lens moves. */
const GLIDE = bezier(0.4, 0, 0.2, 1)
const POINTER = {
  at: [-80, 840, 1150, 1830, 2110, 2420],
  x: [332, 176, 176, 377, 377, 432],
  y: [366, 214, 214, 248, 248, 304],
  curves: [GLIDE, ease.linear, DOLLY, ease.linear, ease.inCubic],
}
const PRESSES = [CLICK_HAVE - 70, CLICK_CARD - 70]

function Pointer({ lens }: { lens: Lens }) {
  const { local } = useShot()
  const opacity =
    progress(local, POINTER.at[0]!, 200, ease.outCubic) *
    (1 - progress(local, 2150, 250, ease.inCubic))
  if (opacity <= 0.001) return null

  const tip = project(
    lens,
    interpolate(local, POINTER.at, POINTER.x, POINTER.curves),
    interpolate(local, POINTER.at, POINTER.y, POINTER.curves),
  )
  const press = PRESSES.reduce((depth, at) => {
    const elapsed = local - at
    return elapsed >= 0 && elapsed < 200
      ? Math.max(depth, Math.sin((elapsed / 200) * Math.PI))
      : depth
  }, 0)
  const size = 48

  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        left: tip.x - size * 0.167,
        top: tip.y - size * 0.167,
        opacity,
        transform: `scale(${1 - press * 0.16})`,
        transformOrigin: '16.7% 16.7%',
        filter: 'drop-shadow(0 8px 14px rgb(0 0 0 / 0.35))',
      }}
    >
      <MousePointer2Icon
        style={{ width: size, height: size, color: '#111', fill: 'white' }}
        strokeWidth={1.4}
      />
    </div>
  )
}

/** "Saved", lifted off the step's tiny status into a callout over the card's corner. */
function SavedPill({ lens, label }: { lens: Lens; label: string }) {
  const { local } = useShot()
  const elapsed = local - SAVED
  if (elapsed < 0) return null

  const from = project(lens, STATUS.x, STATUS.y)
  const corner = project(lens, CARD_CORNER.x, CARD_CORNER.y)
  const travel = progress(elapsed, 0, 460, ease.outExpo)
  // Once landed it floats a little above the page, as a callout does.
  const float = Math.sin((elapsed - 400) / 520) * 4 * progress(elapsed, 300, 400)
  const x = mix(from.x, corner.x - 150, travel)
  const y = mix(from.y, corner.y - 6, travel) + float
  const grow = mix(0.25, 1, spring(elapsed, { stiffness: 240, damping: 21 }))
  const sheen = progress(elapsed, 420, 520, ease.inOutCubic)

  return (
    <>
      <Ring
        at={SAVED + 60}
        x={corner.x - 150}
        y={corner.y - 6}
        from={40}
        to={125}
        duration={600}
        color="#34d399"
        width={3}
      />
      <div
        style={{
          position: 'absolute',
          left: x,
          top: y,
          transform: `translate(-50%, -50%) scale(${grow})`,
          opacity: progress(elapsed, 0, 120, ease.outCubic),
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 26px 10px 10px',
          borderRadius: 999,
          overflow: 'hidden',
          background: '#10b981',
          color: 'white',
          fontSize: 30,
          fontWeight: 600,
          letterSpacing: '-0.01em',
          whiteSpace: 'nowrap',
          boxShadow:
            '0 18px 40px -12px rgb(16 185 129 / 0.7), inset 0 1px 0 rgb(255 255 255 / 0.3)',
        }}
      >
        {sheen > 0 && sheen < 1 ? (
          <span
            aria-hidden
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: `${mix(-40, 130, sheen)}%`,
              width: '30%',
              background:
                'linear-gradient(100deg, transparent, rgb(255 255 255 / 0.45), transparent)',
              transform: 'skewX(-18deg)',
            }}
          />
        ) : null}
        <span
          style={{
            display: 'grid',
            placeItems: 'center',
            width: 40,
            height: 40,
            borderRadius: 999,
            background: 'white',
          }}
        >
          <CheckIcon style={{ width: 24, height: 24, color: '#059669' }} strokeWidth={3} />
        </span>
        {label}
      </div>
    </>
  )
}

/* ------------------------------------------------------------------------------------ */
/* The headline, and the chip that fills its blank                                       */
/* ------------------------------------------------------------------------------------ */

const HEADLINE = { x: 90, y: 166 }
const SLAM = { scale: 1.5, blur: 16, opacity: 0, y: 0 }
const RISE = { y: 50, blur: 12, opacity: 0 }
const STAMP = { scale: 1.12, blur: 6, opacity: 0, y: 0 }
/** The words after the dash rise in while the lens travels. */
const MIDDLE_AT = 1350

/**
 * The accent word is a CSS anchor, so the chip can find it in any language without
 * measuring: it is the blank the chip is thrown into, and the box its marker covers.
 */
const ACCENT = '--editor-accent'
/** KineticText's marker box around the accent, in the headline's px (em is the headline's). */
const MARKER = {
  left: `(anchor(${ACCENT} left) - 0.12em)`,
  middle: `(anchor(${ACCENT} center) + 0.03em)`,
  width: `(anchor-size(${ACCENT} width) + 0.24em)`,
  height: `(anchor-size(${ACCENT} height) - 0.18em)`,
}

/** The stamp on "card" as the lens sees it on the second click: where the chip lifts from. */
type ChipFrom = { x: number; y: number; w: number; h: number; font: number }
const CHIP_FROM: ChipFrom = (() => {
  const lens = lensAt(LIFT)
  const a = project(lens, CARD_GAP.x - 1, CARD_GAP.y + 3)
  const b = project(lens, CARD_GAP.x + CARD_GAP.w + 1, CARD_GAP.y + CARD_GAP.h - 2)
  const c = project(lens, centre(CARD_GAP).x, centre(CARD_GAP).y)
  return {
    x: c.x - HEADLINE.x,
    y: c.y - HEADLINE.y,
    w: Math.abs(b.x - a.x),
    h: Math.abs(b.y - a.y),
    font: ANSWER_PX * c.k,
  }
})()
/** Lifted, the chip is this much closer to the lens. */
const LIFTED = 1.3
/** Its trail in flight: where it was this many ms ago. */
const TRAIL = [12, 24, 36, 48, 60, 72]
const CHIP_W = CHIP_FROM.w * LIFTED

/** A length between a number of px (amount 0) and an anchored CSS length (amount 1). */
function toward(anchored: string, px: number, amount: number): string {
  if (amount >= 0.9999) return `calc(${anchored})`
  if (amount <= 0.0001) return `${px.toFixed(2)}px`
  return `calc(${anchored} * ${amount.toFixed(4)} + ${(px * (1 - amount)).toFixed(2)}px)`
}

/**
 * The chip's box at `t`, in the headline's px: lifted off the page, thrown up — rising
 * first, sliding across late, so it arcs in any language — landed on the blank's left end,
 * then swept across it.
 */
function chipAt(t: number) {
  const lift = spring(t - LIFT, { stiffness: 600, damping: 30 })
  const u = clamp((t - LAUNCH) / (LAND - LAUNCH))
  const landed = t >= LAND
  const grown = CHIP_FROM.w * (1 + (LIFTED - 1) * lift)
  const tall = CHIP_FROM.h * (1 + (LIFTED - 1) * lift)
  const settle = clamp((u - 0.55) / 0.45)
  const basis = landed ? CHIP_W : grown

  const x = toward(
    `(anchor(${ACCENT} left) - 0.12em + ${(CHIP_W / 2).toFixed(2)}px)`,
    CHIP_FROM.x,
    u * u * (3 - 2 * u),
  )
  const y = toward(MARKER.middle, CHIP_FROM.y - 16 * lift, u ** 1.7)
  const width = landed
    ? toward(MARKER.width, CHIP_W, progress(t, LAND, SWEEP, ease.outExpo))
    : `${grown.toFixed(2)}px`
  const height = toward(MARKER.height, tall, settle)

  return {
    u,
    lift,
    landed,
    style: {
      left: `calc(${x} - ${(basis / 2).toFixed(2)}px)`,
      top: `calc(${y} - ${height} / 2)`,
      width,
      height,
    },
  }
}

/** The headline's blank: an orange line where the accent will be, like a gap in a lesson. */
function Blank({ at }: { at: number }) {
  const { local } = useShot()
  const draw = progress(local, at, 420, ease.outExpo)
  const gone = progress(local, LAND, 220, ease.outCubic)
  if (draw <= 0.001 || gone >= 0.999) return null
  // It waits with a slow breath.
  const breathe = 0.5 + 0.5 * Math.sin(((local - at) / 1000) * Math.PI * 2 * 1.4)

  return (
    <span
      aria-hidden
      style={{
        position: 'absolute',
        left: `anchor(${ACCENT} left)`,
        width: `anchor-size(${ACCENT} width)`,
        top: `calc(anchor(${ACCENT} bottom) - 0.06em)`,
        height: '0.065em',
        borderRadius: 999,
        background: BRAND,
        boxShadow: `0 0 ${(10 + 10 * breathe).toFixed(1)}px rgb(255 79 1 / ${(0.45 + 0.25 * breathe).toFixed(3)})`,
        transformOrigin: 'left center',
        transform: `scaleX(${draw})`,
        opacity: 1 - gone,
      }}
    />
  )
}

/**
 * "card" leaves the page as an orange chip, flies up into the blank and becomes the accent
 * word's marker: the gap the teacher made is the word on screen.
 */
function MarkerChip() {
  const { local } = useShot()
  if (local < LIFT) return null

  const chip = chipAt(local)
  const elapsed = local - LAND
  const flying = chip.u > 0 && !chip.landed
  // Speed: the chip is drawn out along its climb, and squashes as it lands.
  const speed = flying ? chip.u ** 0.7 * (1 - clamp((chip.u - 0.55) / 0.45)) : 0
  const squash = chip.landed
    ? interpolate(elapsed, [0, 45, 300], [0, 1, 0], [ease.outCubic, ease.inOutCubic])
    : 0
  const sx = (1 - 0.18 * speed) * (1 + 0.05 * squash)
  const sy = (1 + 0.5 * speed) * (1 - 0.16 * squash)
  const word = 1 - clamp((chip.u - 0.05) / 0.35)
  // On the held beats the marker breathes with the gaps on the page.
  const pulse = TICKS.reduce(
    (most, at) =>
      local < at ? most : Math.max(most, progress(local, at, 40) * Math.exp(-(local - at) / 260)),
    0,
  )
  const glow = chip.landed
    ? 0.55 * (1 - progress(elapsed, 0, 500, ease.outCubic)) + 0.35 * pulse
    : 0.6

  return (
    <>
      {/* The trail: where the chip just was. */}
      {flying
        ? TRAIL.map((behind, index) => {
            const ghost = chipAt(local - behind)
            if (ghost.u <= 0 || ghost.landed) return null
            return (
              <span
                key={behind}
                aria-hidden
                style={{
                  position: 'absolute',
                  ...ghost.style,
                  borderRadius: '0.14em',
                  background: BRAND,
                  opacity: 0.4 * (1 - index / TRAIL.length),
                  transform: `scale(${(1 - 0.18 * speed).toFixed(3)}, ${(1 + 0.6 * speed).toFixed(3)})`,
                }}
              />
            )
          })
        : null}

      <span
        aria-hidden
        style={{
          position: 'absolute',
          ...chip.style,
          borderRadius: '0.14em',
          background: chip.landed ? BRAND : `linear-gradient(180deg, #ff7a3a, ${BRAND} 62%)`,
          boxShadow: [
            `0 0 ${(16 + 40 * glow).toFixed(1)}px ${(2 + 6 * glow).toFixed(1)}px rgb(255 79 1 / ${(0.7 * glow).toFixed(3)})`,
            chip.landed
              ? '0 10px 30px -14px rgb(0 0 0 / 0.5)'
              : `0 ${(6 + 30 * chip.lift).toFixed(1)}px ${(12 + 36 * chip.lift).toFixed(1)}px -8px rgb(0 0 0 / 0.55)`,
          ].join(', '),
          transform: `scale(${sx.toFixed(4)}, ${sy.toFixed(4)})`,
          transformOrigin: chip.landed ? `${(CHIP_W / 2).toFixed(1)}px 50%` : 'center',
        }}
      >
        {word > 0.01 ? (
          <span
            style={{
              position: 'absolute',
              inset: 0,
              display: 'grid',
              placeItems: 'center',
              color: 'white',
              fontSize: CHIP_FROM.font * (1 + (LIFTED - 1) * chip.lift),
              fontWeight: 500,
              letterSpacing: 0,
              lineHeight: 1,
              opacity: word,
            }}
          >
            {GAP_WORDS[1]}
          </span>
        ) : null}
        {chip.landed && elapsed < 180 ? (
          <span
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 'inherit',
              background: '#fff3ea',
              opacity: 0.55 * (1 - progress(elapsed, 0, 180, ease.outCubic)),
            }}
          />
        ) : null}
      </span>

      {chip.landed ? (
        <Landing
          x={`calc(${chip.style.left} + ${(CHIP_W / 2).toFixed(2)}px)`}
          top={chip.style.top}
          height={chip.style.height}
        />
      ) : null}
    </>
  )
}

/** Where the chip hits the blank: a ring and a spray of sparks along the line. */
function Landing({ x, top, height }: { x: string; top: string; height: string }) {
  const { local } = useShot()
  const elapsed = local - LAND
  if (elapsed < 0 || elapsed > 620) return null

  const ring = progress(elapsed, 0, 520, ease.outCubic)
  const r = mix(30, 190, ring)

  return (
    <span
      aria-hidden
      style={{
        position: 'absolute',
        left: x,
        top: `calc(${top} + ${height} / 2)`,
        width: 0,
        height: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          left: -r,
          top: -r,
          width: r * 2,
          height: r * 2,
          borderRadius: '50%',
          border: `3px solid ${BRAND}`,
          opacity: interpolate(ring, [0, 0.1, 1], [0, 0.95, 0]),
        }}
      />
      {Array.from({ length: 16 }, (_, index) => {
        const [r1, r2, r3] = randoms(4100 + index, 3) as [number, number, number]
        // Mostly along the line, a few up and down.
        const side = index % 2 === 0 ? 0 : 180
        const angle = rad(side + (r1 - 0.5) * 110)
        const life = mix(320, 560, r3)
        if (elapsed > life) return null
        const travel = mix(110, 300, r2) * (1 - Math.exp(-elapsed / 120))
        const size = mix(4, 8, r3)
        return (
          <span
            key={index}
            style={{
              position: 'absolute',
              left: Math.cos(angle) * travel - size * 1.6,
              top: Math.sin(angle) * travel - size / 2,
              width: size * 3.2,
              height: size,
              borderRadius: 999,
              background: index % 3 === 0 ? '#ffc39e' : BRAND,
              boxShadow: `0 0 ${size * 1.6}px ${BRAND}`,
              opacity: 1 - ease.inCubic(clamp(elapsed / life)),
              transform: `rotate(${((angle * 180) / Math.PI).toFixed(1)}deg)`,
            }}
          />
        )
      })}
    </span>
  )
}

/**
 * The headline is cut to the clicks: the words up to the dash slam in with the first click,
 * the rest rise while the lens travels and leave a blank where the accent goes; the second
 * click throws the chip into it and its marker sweeps the word in. Any language: the
 * dictionary decides the words, the anchor finds them.
 */
function Headline({ text }: { text: string }) {
  const { local } = useShot()
  const words = parseAccents(text)
  const first = words.findIndex((word) => word.accent)
  let last = first
  while (first >= 0 && words[last + 1]?.accent) last++
  const dashAt = words.findIndex((word) => /^[—–-]+$/.test(word.word))
  const leadEnd = dashAt >= 0 && (first < 0 || dashAt < first) ? dashAt : 0

  let middle = 0
  const timing = words.map((word, index) => {
    if (word.accent) return { at: LAND + (index - first) * 60, from: STAMP, duration: 240 }
    if (index <= leadEnd) return { at: CLICK_HAVE + index * 70, from: SLAM, duration: 380 }
    return { at: MIDDLE_AT + middle++ * 90, from: RISE, duration: 520 }
  })
  const blankAt = Math.max(1700, MIDDLE_AT + middle * 90 + 120)

  // The marker sweeps the accent in: the word shows only where the marker has passed.
  const sweep = progress(local, LAND, SWEEP, ease.outExpo)
  const reveal =
    sweep >= 0.999
      ? undefined
      : `inset(-40% calc(${((1 - sweep) * 100).toFixed(3)}% - ${((1 - sweep) * CHIP_W).toFixed(2)}px + ${(0.12 - 0.24 * sweep).toFixed(4)}em) -40% -20%)`
  const bump = 0.03 * kick(local - LAND)

  const wordAt = (index: number) => {
    const { at, from, duration } = timing[index]!
    return <KineticText text={words[index]!.word} at={at} from={from} duration={duration} />
  }

  return (
    <div
      className="text-balance"
      style={{
        position: 'absolute',
        left: HEADLINE.x,
        right: HEADLINE.x,
        top: HEADLINE.y,
        textAlign: 'center',
        fontSize: 92,
        fontWeight: 600,
        lineHeight: 1.06,
        letterSpacing: '-0.035em',
        transform: bump > 0.001 ? `scale(${1 + bump})` : undefined,
        transformOrigin: '50% 75%',
      }}
    >
      {/* Drawn first, so the words sit on them. */}
      {first >= 0 ? (
        <>
          <Blank at={blankAt} />
          <MarkerChip />
        </>
      ) : null}

      {words.map((word, index) => {
        if (word.accent && index !== first) return null
        const space = index > 0 ? ' ' : null

        if (index === first) {
          return (
            <Fragment key={index}>
              {space}
              {/* The margin cancels the marker's bleed, so the word keeps its spaces. */}
              <span
                style={{
                  display: 'inline-block',
                  margin: '0 0.12em',
                  anchorName: ACCENT,
                  clipPath: reveal,
                }}
              >
                {words.slice(first, last + 1).map((_, offset) => (
                  <Fragment key={offset}>
                    {offset > 0 ? ' ' : null}
                    {wordAt(first + offset)}
                  </Fragment>
                ))}
              </span>
            </Fragment>
          )
        }

        return (
          <Fragment key={index}>
            {space}
            {wordAt(index)}
          </Fragment>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------------------------ */
/* The shot                                                                             */
/* ------------------------------------------------------------------------------------ */

const IRIS = { x: 540, y: 760 }
const IRIS_RADIUS = Math.hypot(Math.max(IRIS.x, WIDTH - IRIS.x), Math.max(IRIS.y, HEIGHT - IRIS.y))

/** Outside the loupe the outgoing shot sinks into shadow while the loupe grows. */
function IrisScrim({ iris }: { iris: number }) {
  const { local } = useShot()
  if (iris >= 1) return null
  const r = IRIS_RADIUS * iris
  const dim = progress(local, -340, 280, ease.outCubic)
  if (dim <= 0.001) return null

  return (
    <div
      aria-hidden
      style={{
        ...FULL,
        opacity: dim,
        background: `radial-gradient(circle at ${IRIS.x}px ${IRIS.y}px, transparent ${r.toFixed(1)}px, rgb(11 9 8 / 0.55) ${(r + 80).toFixed(1)}px)`,
      }}
    />
  )
}

/**
 * The macro look: only the line being edited is sharp and lit; the far page and the near
 * one go soft and sink into shadow, following the line as the camera moves.
 */
function Macro({ focus, amount }: { focus: number; amount: number }) {
  const far = focus - 80
  const near = focus + 110

  return (
    <>
      <div
        style={{
          ...FULL,
          height: far,
          opacity: amount,
          backdropFilter: 'blur(5px)',
          maskImage: `linear-gradient(to bottom, black 0px, black ${Math.max(0, far - 260).toFixed(0)}px, transparent ${far.toFixed(0)}px)`,
        }}
      />
      <div
        style={{
          ...FULL,
          top: near,
          height: HEIGHT - near,
          opacity: amount,
          backdropFilter: 'blur(7px)',
          maskImage: 'linear-gradient(to bottom, transparent 0px, black 230px)',
        }}
      />
      <div
        style={{
          ...FULL,
          opacity: amount,
          background: [
            `linear-gradient(to bottom, rgb(11 9 8 / 0.8) 0px, rgb(11 9 8 / 0.5) ${(focus - 440).toFixed(0)}px, transparent ${(focus - 270).toFixed(0)}px)`,
            'linear-gradient(to top, rgb(11 9 8 / 0.9) 0px, rgb(11 9 8 / 0.45) 210px, transparent 420px)',
            `radial-gradient(ellipse 76% 46% at 50% ${focus.toFixed(0)}px, transparent 42%, rgb(11 9 8 / 0.55) 100%)`,
          ].join(', '),
        }}
      />
    </>
  )
}

/** The directional blur of the whip: vertical, as strong as the frame is fast. */
function WhipBlur({ smear }: { smear: number }) {
  if (smear <= 0.4) return null

  return (
    <svg aria-hidden width={0} height={0} style={{ position: 'absolute' }}>
      <defs>
        <filter id="editor-whip" x="0" y="-20%" width="100%" height="140%">
          <feGaussianBlur stdDeviation={`0 ${smear.toFixed(2)}`} />
        </filter>
      </defs>
    </svg>
  )
}

export function Shot({ copy }: { copy: FilmCopy }) {
  const { local } = useShot()

  const iris = progress(local, -400, 650, ease.inOutCubic)
  // The exit is a vertical whip: up and away, smeared along its travel, gone as the live
  // room rises into its place.
  const shift = whipAt(local)
  const smear = clamp(Math.abs(shift - whipAt(local - FRAME)) / 10, 0, 30)
  const fade = 1 - progress(local, EXIT + 300, 80)
  if (iris <= 0 || fade <= 0.001) return null

  const lens = lensAt(local)
  const have = project(lens, centre(HAVE_GAP).x, centre(HAVE_GAP).y)
  const card = project(lens, centre(CARD_GAP).x, centre(CARD_GAP).y)

  // The camera answers each click: a punch toward the gap and a short shake.
  const second = local >= CLICK_CARD
  const hit = second ? card : have
  const punch = kick(local - (second ? CLICK_CARD : CLICK_HAVE)) * (second ? 0.075 : 0.035)
  const [jx = 0.5, jy = 0.5] = randoms(frameOf(local) * 31 + 7, 2)
  const shake = punch * (second ? 120 : 80)

  const macro = 1 - progress(local, 2060, 500, ease.inOutCubic)
  // A focus pull as the iris opens: sharp on the near page first, racking up to the line.
  const rack = 170 * (1 - progress(local, -250, 650, ease.inOutCubic))
  const centreOfPage = project(lens, 260, 238)
  // The status's own "saved" leaves as the callout lifts off it.
  const lifted = progress(local, SAVED, 300, ease.outCubic)
  const css = [
    // The filmed scene draws its own small arrow; this shot points with its own.
    '[data-editor-shot] [data-promo-scene] > [aria-hidden] { display: none !important; }',
    lifted > 0 ? `${STATUS_SELECTOR} { opacity: ${(1 - lifted).toFixed(3)}; }` : '',
  ].join('\n')

  return (
    <div data-editor-shot className="absolute inset-0">
      <style>{css}</style>
      <WhipBlur smear={smear} />
      <IrisScrim iris={iris} />

      <div
        className="absolute inset-0"
        style={{
          opacity: fade,
          transform: shift < -0.5 ? `translateY(${shift.toFixed(1)}px)` : undefined,
          filter: smear > 0.4 ? 'url(#editor-whip)' : undefined,
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            clipPath:
              iris < 1 ? `circle(${IRIS_RADIUS * iris}px at ${IRIS.x}px ${IRIS.y}px)` : undefined,
          }}
        >
          {/* Inside the iris the film's ground covers the outgoing shot until it is gone. */}
          {local < 420 ? <Backdrop /> : null}
          <Dust count={16} seed={33} opacity={0.35} />
          <Glow x={centreOfPage.x} y={centreOfPage.y + 40} size={1300} opacity={0.3} />

          <div
            className="absolute inset-0"
            style={{
              transformOrigin: `${hit.x}px ${hit.y}px`,
              transform:
                punch > 0.001
                  ? `translate(${(jx - 0.5) * shake}px, ${(jy - 0.5) * shake}px) scale(${1 + punch})`
                  : undefined,
            }}
          >
            <Space depth={DEPTH}>
              <Page lens={lens}>
                <div style={{ position: 'absolute', left: CROP.x, top: CROP.y }}>
                  <UiCard width={CROP.width} height={CROP.height} radius={24}>
                    <Replica scene="editor" ms={sceneMs(local)} copy={copy.promo} crop={CROP} />
                  </UiCard>
                </div>
                <PagePop at={CLICK_HAVE} gap={HAVE_GAP} />
                <PagePop at={CLICK_CARD} gap={CARD_GAP} stamp={false} big />
                <SavedGlow />
                <GapTick at={TICKS[0]} gap={HAVE_GAP} />
                <GapTick at={TICKS[1]} gap={CARD_GAP} />
              </Page>
            </Space>

            <ScreenPop at={CLICK_HAVE} x={have.x} y={have.y} seed={301} />
            <ScreenPop at={CLICK_CARD} x={card.x} y={card.y} seed={302} big />
            <Pointer lens={lens} />
          </div>

          {macro > 0.001 ? <Macro focus={lens.fy + rack} amount={macro} /> : null}
        </div>

        {iris > 0 && iris < 1 ? (
          <span
            aria-hidden
            style={{
              position: 'absolute',
              left: IRIS.x - IRIS_RADIUS * iris,
              top: IRIS.y - IRIS_RADIUS * iris,
              width: IRIS_RADIUS * iris * 2,
              height: IRIS_RADIUS * iris * 2,
              borderRadius: '50%',
              border: `3px solid ${BRAND}`,
              boxShadow: '0 0 28px 6px rgb(255 79 1 / 0.5), inset 0 0 28px 6px rgb(255 79 1 / 0.4)',
              opacity: interpolate(iris, [0, 0.08, 0.75, 1], [0, 1, 0.7, 0]),
            }}
          />
        ) : null}

        <Flash at={CLICK_CARD} rise={40} fall={320} color="#ffd9c4" peak={0.14} />
        <SavedPill lens={lens} label={copy.promo.scenes.editor.status.saved} />
        <Headline text={copy.film.headlines.editor} />
      </div>
    </div>
  )
}
