'use client'

import type { CSSProperties } from 'react'
import type { Cue } from '../audio/cues'
import type { FilmCopy } from '../copy'
import { Burst, Dust, Ring, whip } from '../fx/effects'
import { Camera, Space } from '../fx/space'
import { KineticText, parseAccents } from '../fx/text'
import {
  BRAND,
  bezier,
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
import { CARD_H, CARD_W, LessonCard, LEVELS, MONO, TITLES } from './library-cards'

/**
 * Chapter 01 — the library.
 *
 * A field of real lesson cards lies dark on the floor, one row per level, A1 nearest and
 * C2 farthest: the road a learner travels. It rushes in out of the turn's zoom-through
 * and lands on the downbeat. Then the lights come on, one level a beat and then a half
 * beat, faster into the bar: the row's pill pops, a light runs down its foot and its cards
 * stand up behind it in a wave, each flashing hot as it catches the light. All the while
 * the camera cranes up and swings round the field, so the rows slide past each other and
 * the far ones open up — and come into focus — as the light climbs to them. On the bar
 * the whole field takes the light at once — a surge across every card, the strips at
 * full, the pills again, a jolt — and the headline's accent fills. Exit: a whip pan left.
 *
 * Beats, shot-local ms:
 *   −260        the field rushes in from the middle of the frame, its row lines burning
 *      0        it lands on the downbeat with a little weight; the headline comes in
 *    500…2500   A1, A2, B1, B2 a beat apart, C1 and C2 on the half beats
 *   2500→3000   the camera pulls back and up to the whole field
 *   3000        every level lit: the field-wide surge, the jolt, the accent fills
 *   3300        a breath to the right…
 *   3620        …and the whip left, fastest as the next chapter whips in
 */

/** The levels light a beat apart, then on the half beat, rushing into the bar. */
const LIT_AT = [500, 1000, 1500, 2000, 2250, 2500] as const
/** Every level lit: the whole field takes the light, on the bar. */
const ALL_LIT = 3000
const ARRIVE_AT = -300
const ARRIVE_MS = 320
const WHIP_AT = 3620
const WHIP_MS = 300
const GONE_AT = WHIP_AT + WHIP_MS
/** The cards of a row stand up this many ms apart as the light runs down it. */
const WAVE = 80
/** When the accent statement slams in, letter by letter. */
const SLAM_AT = 160

/** When the bar's surge of light reaches a card: up the road and down each row. */
const sweepAt = (row: number, slot: number) => ALL_LIT + row * 42 + slot * 30

/** A major scale up the road: the light climbs and so does the sound. */
const SCALE = [0, 2, 4, 5, 7, 9] as const

export const cues: readonly Cue[] = [
  // The arrival rides the turn's own zoom-through whoosh, which runs to the downbeat.
  { at: 0, kind: 'thud', gain: 0.85 },
  { at: SLAM_AT + 40, kind: 'impact', gain: 0.55 },
  ...LIT_AT.map((at, row) => ({
    at,
    kind: 'pop' as const,
    gain: 0.5 + row * 0.04,
    pitch: SCALE[row] ?? 0,
    pan: -0.35 + row * 0.05,
  })),
  { at: 2000, kind: 'riser', duration: ALL_LIT - 2000, gain: 0.4 },
  { at: ALL_LIT, kind: 'impact', gain: 0.8 },
  { at: ALL_LIT + 40, kind: 'sparkle', gain: 0.55 },
  { at: WHIP_AT, kind: 'whoosh', duration: 380, gain: 0.8, pan: -0.6 },
]

/** The camera's lens: CSS perspective, in px. */
const LENS = 1200

/**
 * The floor, in its own flat pixels from the A1 row's foot at the pill end. Rows run `ROW`
 * apart into the distance; on each the level pill stands at the near-left end and the
 * cards follow it to the right.
 */
const FLOOR = { cx: 540, cy: 1110 }
/** The middle of the field, in floor px: the point the camera swings round. */
const PIVOT = { x: 520, y: -560 }
const ROW = 220
const PITCH_X = CARD_W + 26
const PER_ROW = 8
const PILL = { x: -375, width: 150, height: 92 }
const FIRST_CARD = PILL.x + PILL.width / 2 + 30 + CARD_W / 2
/** The light strip along each row's foot, from the pill out past the last card. */
const STRIP = { from: PILL.x + PILL.width / 2 + 12, length: PER_ROW * PITCH_X + 300 }
/** Standing cards lean toward the camera by this much, whatever its angle. */
const LEAN = 24
/**
 * Each row starts this far right of the one in front: the road climbs to the right, and
 * seen at a slant the pills still stand in a column.
 */
const SKEW = 46

/** The headline block's top edge, and its two sizes. */
const HEADLINE = { top: 156, plain: 88, accent: 144 }

/** Where the camera stands: the floor's tilt and swing (deg) and its shift (px). */
type Pose = { tilt: number; yaw: number; x: number; y: number; z: number }

/** Landing: low and close on the near rows, looking down them at a slant. */
const START: Pose = { tilt: 62, yaw: 40, x: -335, y: 251, z: -620 }
/** On the bar: higher and further back, the whole lit field in view. */
const HERO: Pose = { tilt: 40, yaw: 28, x: -337, y: 288, z: -938 }
/** The crane: gentle off the landing, gathering pace, braking onto the bar. */
const CRANE = bezier(0.45, 0, 0.2, 1)

/** 0 → 1 as the field rushes in, braking onto the downbeat. */
function flight(local: number): number {
  return progress(local, ARRIVE_AT, ARRIVE_MS, ease.outCubic)
}

/** The landing's weight: a small push past the mark and back, after the downbeat. */
function landing(local: number): number {
  if (local <= 0) return 0
  return Math.exp(-local / 150) * Math.sin((Math.PI * local) / 230)
}

function poseAt(local: number): Pose {
  const crane = CRANE(clamp(local / ALL_LIT))
  // After the bar the camera keeps drifting, slower: a held frame is still video.
  const hold = progress(local, ALL_LIT, 1000)
  const tilt = mix(START.tilt, HERO.tilt, crane) - 1.5 * hold
  const yaw = mix(START.yaw, HERO.yaw, crane) - 2.5 * hold
  const x = mix(START.x, HERO.x, crane)
  const y = mix(START.y, HERO.y, crane)
  const z = mix(START.z, HERO.z, crane) - 50 * hold

  // Far off, the field is a speck in the middle of the frame, where the zoom-through
  // converges. It closes in at a steady pace (in scale, which is what the eye reads),
  // swinging round and levelling out as it comes, and pushes a little past on landing.
  const away = 1 - flight(local)
  const scale = Math.exp(Math.log(0.1) * away) * (1 + 0.05 * landing(local))
  return {
    tilt: tilt + 8 * away,
    yaw: yaw + 14 * away,
    x: mix(x, -PIVOT.x, away),
    y: mix(y, 675 - FLOOR.cy - PIVOT.y, away),
    z: z + (LENS - z) * (1 - 1 / scale),
  }
}

/**
 * How soft a row is, in px of blur. The lens racks focus up the road with the light: the
 * rows still dark beyond the lit one sit out of focus and sharpen as their turn comes.
 */
function softness(row: number, local: number): number {
  const focus = LIT_AT.slice(1).reduce(
    (sum, at) => sum + progress(local, at - 80, 280, ease.inOutCubic),
    0,
  )
  return clamp((row - focus - 0.4) * 1.1, 0, 2.2) * progress(local, 0, 300)
}

export function Shot({ copy }: { copy: FilmCopy }) {
  const { local } = useShot()
  if (local < ARRIVE_AT || local >= GONE_AT) return null

  const library = copy.promo.scenes.library
  const metas = [...library.shelf, ...library.picked].map((card) => card.meta)

  const punch = interpolate(
    local,
    [ALL_LIT, ALL_LIT + 60, ALL_LIT + 520],
    [0, 1, 0],
    [ease.outCubic, ease.inOutCubic],
  )
  const pulse = Math.max(...LIT_AT.map((at) => interpolate(local - at, [0, 60, 520], [0, 1, 0])))
  // The light climbs the road and the sky over it warms as it goes.
  const climb = interpolate(
    local,
    [...LIT_AT],
    LIT_AT.map((_, row) => row / (LEVELS.length - 1)),
    ease.inOutCubic,
  )

  // The jolt of the bar: a short, hard shake that dies away.
  const jolt = local >= ALL_LIT && local < ALL_LIT + 150 ? 5 * (1 - (local - ALL_LIT) / 150) : 0
  const [r1 = 0.5, r2 = 0.5] = randoms(frameOf(local) * 31 + 17, 2)
  const shake = { x: (r1 - 0.5) * 2 * jolt, y: (r2 - 0.5) * 2 * jolt }

  // Out: a breath to the right, then the whip — accelerating as the next chapter whips in
  // across it. The camera pans inside the frame, so the rows run on into view instead of
  // the field sliding out as a slab; the field runs on past the right edge, so the pan is
  // long enough to clear it.
  const windup = 24 * progress(local, 3300, 300, ease.inOutCubic)
  const whipping = progress(local, WHIP_AT, WHIP_MS, ease.inCubic)
  const shift = windup - 1800 * whipping
  const smear = local >= WHIP_AT ? clamp(Math.abs(shift) / 30, 0, 26) : 0
  const exit = local >= WHIP_AT ? whip(shift) : { transform: `translateX(${windup}px)` }
  const zoom = 1 + 0.05 * punch + 0.006 * pulse
  // While the field rushes in it smears only at the very end, where it is big and fast.
  const rushBlur = 4 * interpolate(local, [-150, -90, 0], [0, 1, 0])

  // Keeps the corners clear for the HUD.
  const mask =
    'linear-gradient(to bottom, transparent 0px, #000 140px, #000 1180px, transparent 1320px)'
  const bloom = interpolate(
    local,
    [ALL_LIT - 20, ALL_LIT + 80, ALL_LIT + 760],
    [0, 1, 0],
    [ease.outCubic, ease.inOutCubic],
  )

  return (
    <div
      className="absolute inset-0"
      // In fast, and out under the last of the whip's smear rather than all at once.
      style={{
        opacity:
          progress(local, ARRIVE_AT, 50) * (1 - progress(local, GONE_AT - 90, 90, ease.inCubic)),
      }}
    >
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          ...exit,
          background: `radial-gradient(70% 24% at 50% ${mix(70, 36, climb)}%, rgb(255 79 1 / ${0.16 + 0.08 * pulse + 0.16 * bloom}), transparent 70%)`,
        }}
      />
      <div className="absolute inset-0" style={{ maskImage: mask, WebkitMaskImage: mask }}>
        <Camera
          zoom={zoom}
          x={-shift / zoom + Math.sin(local / 1300) * 6 + shake.x}
          y={-10 * landing(local) + Math.cos(local / 1700) * 5 + shake.y}
          roll={mix(-0.5, 0.4, progress(local, 0, WHIP_AT, ease.inOutCubic)) - 2 * whipping}
          blur={rushBlur + smear}
        >
          <Space depth={LENS}>
            <Field metas={metas} pose={poseAt(local)} />
          </Space>
          {bloom > 0.001 ? (
            <div
              aria-hidden
              className="absolute inset-0"
              style={{
                opacity: bloom,
                mixBlendMode: 'screen',
                background:
                  'radial-gradient(62% 32% at 46% 64%, rgb(255 150 90 / 0.42), transparent 72%)',
              }}
            />
          ) : null}
          <Dust count={18} seed={14} opacity={0.35} />
        </Camera>
      </div>

      <Headline
        text={copy.film.headlines.library}
        style={{
          ...exit,
          transform: `${exit.transform ?? ''} translate(${shake.x * 0.6}px, ${shake.y * 0.6}px)`,
        }}
      />
    </div>
  )
}

/** The rows of cards on the floor, standing up lit one level at a time. */
function Field({ metas, pose }: { metas: readonly string[]; pose: Pose }) {
  const { local } = useShot()
  const fly = flight(local)
  // Flown in along the floor, like the lights of a runway coming up under the camera.
  const travel = -700 * (1 - fly)
  // Far off only the burning row lines show; the pills and cards come out of the dark
  // as the field nears.
  const shown = clamp((fly - 0.35) / 0.3)
  const stand = pose.tilt + LEAN

  return (
    <div
      style={{
        position: 'absolute',
        left: FLOOR.cx,
        top: FLOOR.cy,
        width: 0,
        height: 0,
        transformStyle: 'preserve-3d',
        transformOrigin: `${PIVOT.x}px ${PIVOT.y}px`,
        transform: `translate3d(${pose.x}px, ${pose.y}px, ${pose.z}px) rotateY(${pose.yaw}deg) rotateX(${pose.tilt}deg)`,
      }}
    >
      {LEVELS.map((level, row) => {
        const hinge = -row * ROW + travel
        const litAt = LIT_AT[row] ?? 0
        const soft = softness(row, local)

        return (
          <div
            key={level}
            style={{
              position: 'absolute',
              left: row * SKEW,
              top: 0,
              transformStyle: 'preserve-3d',
            }}
          >
            <RowLight hinge={hinge} at={litAt} row={row} far={clamp((1 - fly) / 0.6)} />
            {shown > 0
              ? TITLES[level]
                  .slice(0, PER_ROW)
                  .map((title, slot) => (
                    <FieldCard
                      key={slot}
                      row={row}
                      slot={slot}
                      level={level}
                      title={title}
                      meta={metas[(row * 5 + slot * 3) % metas.length] ?? ''}
                      litAt={litAt}
                      hinge={hinge}
                      stand={stand}
                      shown={shown}
                      soft={soft}
                    />
                  ))
              : null}
            {shown > 0 ? (
              <LevelPill
                level={level}
                at={litAt}
                again={sweepAt(row, 0)}
                hinge={hinge}
                stand={stand}
                shown={shown}
                soft={soft}
                seed={40 + row}
              />
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

/** The look of a card as its light comes on: hot white running to orange, `alpha` strong. */
function hotFace(alpha: number): string {
  return `linear-gradient(165deg, rgb(255 244 236 / ${alpha}) 0%, rgb(255 214 187 / ${alpha}) 52%, rgb(255 163 108 / ${alpha}) 100%)`
}

/** A band of light across a card face, `at` 0 → 1 from its left edge to its right. */
function glintBand(at: number): string {
  const p = mix(-25, 125, at)
  return `linear-gradient(105deg, rgb(255 120 50 / 0) ${p - 24}%, rgb(255 120 50 / 0.55) ${p - 7}%, rgb(255 246 238 / 0.95) ${p}%, rgb(255 120 50 / 0.55) ${p + 7}%, rgb(255 120 50 / 0) ${p + 24}%)`
}

/**
 * One lesson card on the floor. When the light running down its row reaches it, it
 * springs up to face the camera, flashing hot as it catches the light; on the bar the
 * field-wide surge washes over it and a band of light glints across it.
 */
function FieldCard({
  row,
  slot,
  level,
  title,
  meta,
  litAt,
  hinge,
  stand,
  shown,
  soft,
}: {
  row: number
  slot: number
  level: string
  title: string
  meta: string
  litAt: number
  hinge: number
  stand: number
  shown: number
  soft: number
}) {
  const { local } = useShot()
  const centre = FIRST_CARD + slot * PITCH_X
  const since = local - (litAt + 40 + slot * WAVE)
  const angle = stand * spring(since, { stiffness: 210, damping: 19 })
  const light = clamp((since - 25) / 75)
  // Hot at once, so the card never shows a grey half-lit frame, then cooling to white.
  const hot =
    since > 0 ? interpolate(since, [0, 25, 260], [0, 1, 0], [ease.outCubic, ease.inOutCubic]) : 0

  const swept = local - sweepAt(row, slot)
  const sweeping = swept > 0 && swept < 400
  const surge =
    swept > 0 ? interpolate(swept, [0, 50, 420], [0, 1, 0], [ease.outCubic, ease.inOutCubic]) : 0
  const glint =
    swept > 0 ? interpolate(swept, [0, 110, 640], [0, 1, 0], [ease.outCubic, ease.inOutCubic]) : 0
  const glow = since > 0 ? Math.max(interpolate(since, [0, 30, 650], [0, 1, 0]), glint) : 0
  const heat = Math.max(hot, 0.5 * surge)
  // Far down the row the cards sink into the dark, until the whole field takes the light.
  const depth = mix(1, 0.42, clamp((centre - 600) / 1900))
  const opacity = shown * mix(depth, 1, 0.75 * progress(swept, 0, 220, ease.outCubic))

  return (
    <div
      style={{
        position: 'absolute',
        left: centre - CARD_W / 2,
        top: hinge - CARD_H,
        width: CARD_W,
        height: CARD_H,
        transformOrigin: '50% 100%',
        transform: `rotateX(${-angle}deg)`,
        opacity,
        filter: soft > 0.05 ? `blur(${soft}px)` : undefined,
      }}
    >
      <LessonCard title={title} level={level} meta={meta} light={light} glow={glow} />
      {heat > 0.01 || sweeping ? (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 26,
            background: [sweeping ? glintBand(swept / 380) : '', hotFace(heat)]
              .filter(Boolean)
              .join(', '),
          }}
        />
      ) : null}
    </div>
  )
}

/**
 * Lying on the floor along the row's foot: a line that burns while the field flies in,
 * like a runway's lights seen from the air, flares as it touches down and settles faint.
 * When the row lights, a hot head of light runs down it ahead of the standing cards,
 * drawing a strip of brand light behind it, and a warm pool spreads on the floor in front.
 */
function RowLight({
  hinge,
  at,
  row,
  far,
}: {
  hinge: number
  at: number
  row: number
  far: number
}) {
  const { local } = useShot()
  // The head of the light, in floor px: it reaches each card as that card stands.
  const run = (local - at - 40) / WAVE
  const head = FIRST_CARD - CARD_W / 2 + run * PITCH_X
  const draw = clamp((head - STRIP.from) / STRIP.length)
  const flare = interpolate(local - at, [0, 120, 900], [0, 1, 0.4], ease.outCubic)
  const hit = interpolate(local - sweepAt(row, 0), [0, 120, 1100], [0, 1, 0.5], ease.outCubic)
  const glow = Math.max(flare, hit)
  const burn =
    local < 0
      ? 1
      : interpolate(local, [0, 60, 460 + row * 45], [1, 1, 0], [ease.linear, ease.inOutCubic])
  // The touchdown: every line flares at once before it settles.
  const kick = interpolate(local, [-40, 20, 260], [0, 1, 0], [ease.outCubic, ease.inOutCubic])
  const heat = run >= 0 ? 1 - clamp((run - PER_ROW + 1) / 1.5) : 0

  return (
    <>
      {glow > 0.01 ? (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: STRIP.from - 300,
            top: hinge - 40,
            width: STRIP.length + 300,
            height: 360,
            background: `radial-gradient(closest-side at 36% 42%, rgb(255 79 1 / ${0.5 * glow}), rgb(255 79 1 / ${0.18 * glow}) 55%, transparent)`,
          }}
        />
      ) : null}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: STRIP.from,
          top: hinge - 3 - 3 * burn - 4 * kick - 65 * far,
          width: STRIP.length,
          height: 6 + 6 * burn + 8 * kick + 130 * far,
          borderRadius: 40,
          background: `linear-gradient(to right, rgb(255 246 238 / ${0.14 + 0.8 * burn}), rgb(255 236 222 / ${0.05 + 0.5 * burn + 0.3 * kick}) 62%, transparent)`,
          boxShadow:
            burn > 0.02
              ? `0 0 ${24 + 50 * far + 40 * kick}px ${5 + 24 * far + 10 * kick}px rgb(255 214 190 / ${Math.min(1, (0.5 + 0.45 * far + 0.4 * kick) * burn)})`
              : undefined,
        }}
      />
      {draw > 0 ? (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: STRIP.from,
            top: hinge - 4,
            width: draw * STRIP.length,
            height: 8,
            borderRadius: 4,
            backgroundImage: `linear-gradient(to right, #ffb58a, ${BRAND} 9%, rgb(255 79 1 / 0.6) 55%, rgb(255 79 1 / 0.22))`,
            backgroundSize: `${STRIP.length}px 100%`,
            boxShadow: `0 0 ${18 + 30 * glow}px ${4 + 7 * glow}px rgb(255 79 1 / ${0.35 + 0.4 * glow})`,
          }}
        />
      ) : null}
      {heat > 0.01 ? (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: head - 150,
            top: hinge - 24,
            width: 300,
            height: 48,
            opacity: heat,
            background:
              'radial-gradient(closest-side, #ffffff 0%, #ffe2cf 30%, rgb(255 120 50 / 0.75) 62%, rgb(255 79 1 / 0))',
          }}
        />
      ) : null}
    </>
  )
}

/** A quick swell and settle, `since` ms after a pop. */
function popScale(since: number, size: number): number {
  return (
    1 +
    size *
      interpolate(
        since,
        [0, 90, 230, 340],
        [0, 1, -0.14, 0],
        [ease.outCubic, ease.inOutCubic, ease.outCubic],
      )
  )
}

/** The row's level, standing at its near end; it pops orange when the row lights. */
function LevelPill({
  level,
  at,
  again,
  hinge,
  stand,
  shown,
  soft,
  seed,
}: {
  level: string
  at: number
  again: number
  hinge: number
  stand: number
  shown: number
  soft: number
  seed: number
}) {
  const { local } = useShot()
  const lit = local >= at
  const scale = lit
    ? local >= again
      ? popScale(local - again, 0.18)
      : popScale(local - at, 0.22)
    : 1
  const hit = interpolate(local - again, [0, 80, 700], [0, 1, 0])

  return (
    <div
      style={{
        position: 'absolute',
        left: PILL.x - PILL.width / 2,
        top: hinge - PILL.height,
        width: PILL.width,
        height: PILL.height,
        opacity: shown,
        filter: soft > 0.05 ? `blur(${soft}px)` : undefined,
        transformOrigin: '50% 100%',
        // Stood up like the cards, and lifted so its middle is level with theirs.
        transform: `rotateX(${-stand}deg) translateY(${-(CARD_H - PILL.height) / 2}px) scale(${scale})`,
      }}
    >
      <Ring
        at={at}
        x={PILL.width / 2}
        y={PILL.height / 2}
        from={50}
        to={170}
        duration={560}
        width={3}
      />
      <Ring
        at={again}
        x={PILL.width / 2}
        y={PILL.height / 2}
        from={50}
        to={160}
        duration={520}
        width={3}
        color="#ffb58a"
      />
      <Burst
        at={at}
        x={PILL.width / 2}
        y={PILL.height / 2}
        count={14}
        seed={seed}
        speed={[200, 480]}
        size={[3, 7]}
        life={[320, 640]}
        gravity={160}
        shape="spark"
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 999,
          display: 'grid',
          placeItems: 'center',
          fontFamily: MONO,
          fontSize: 46,
          fontWeight: 600,
          letterSpacing: '0.02em',
          background: lit
            ? `linear-gradient(145deg, #ff7a33, ${BRAND} 50%, #e22f00)`
            : 'rgb(22 18 15 / 0.94)',
          color: lit ? 'white' : 'rgb(255 255 255 / 0.6)',
          border: `1.5px solid ${lit ? 'rgb(255 255 255 / 0.28)' : 'rgb(255 255 255 / 0.18)'}`,
          boxShadow: lit
            ? `0 0 ${46 + 40 * hit}px rgb(255 79 1 / ${0.55 + 0.35 * hit}), 0 14px 30px -12px rgb(0 0 0 / 0.7)`
            : '0 14px 30px -12px rgb(0 0 0 / 0.7)',
        }}
      >
        {level}
      </div>
    </div>
  )
}

/** The headline's words, gathered into lines: the plain run and the accented run. */
function headlineLines(text: string): { text: string; accent: boolean }[] {
  const lines: { text: string; accent: boolean }[] = []
  for (const { word, accent } of parseAccents(text)) {
    const last = lines[lines.length - 1]
    if (last && last.accent === accent) last.text += ` ${word}`
    else lines.push({ text: word, accent })
  }
  return lines
}

function lineHeight(accent: boolean): number {
  return accent ? Math.round(HEADLINE.accent * 1.02) : Math.round(HEADLINE.plain * 1.06)
}

/**
 * "Готові уроки A1–C2": the plain words as a headline, the accent as a statement under
 * it — or over it, as the dictionary's word order has it. The plain words rise on the
 * downbeat and the accent slams in just after, in either order. When every level is lit,
 * the accent fills with the brand colour.
 */
function Headline({ text, style }: { text: string; style?: CSSProperties }) {
  const lines = headlineLines(text)

  return (
    <div
      style={{
        position: 'absolute',
        left: 90,
        width: 900,
        top: HEADLINE.top,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        ...style,
      }}
    >
      {lines.map((line, index) =>
        line.accent ? (
          <AccentLine key={index} text={line.text} at={SLAM_AT} />
        ) : (
          <div
            key={index}
            style={{
              fontSize: HEADLINE.plain,
              height: lineHeight(false),
              lineHeight: `${lineHeight(false)}px`,
              fontWeight: 650,
              letterSpacing: '-0.035em',
              whiteSpace: 'nowrap',
              textShadow: '0 6px 40px rgb(0 0 0 / 0.55)',
            }}
          >
            <KineticText
              text={line.text}
              at={0}
              stagger={90}
              duration={560}
              from={{ y: 70, blur: 14, opacity: 0 }}
            />
          </div>
        ),
      )}
    </div>
  )
}

/** Sparks thrown from one end of the accent as it fills. */
function EndSparks({ side, at, seed }: { side: 'left' | 'right'; at: number; seed: number }) {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        left: side === 'left' ? '-0.12em' : 'calc(100% + 0.12em)',
        top: '55%',
        width: 0,
        height: 0,
      }}
    >
      <Burst
        at={at}
        x={0}
        y={0}
        count={16}
        seed={seed}
        speed={[320, 820]}
        size={[3, 7]}
        life={[420, 820]}
        gravity={420}
        spread={80}
        direction={side === 'left' ? -150 : -30}
        shape="spark"
      />
    </div>
  )
}

/** The accent: slams in letter by letter, glowing; fills orange once every level is lit. */
function AccentLine({ text, at }: { text: string; at: number }) {
  const { local } = useShot()
  const fill = progress(local, ALL_LIT, 460, ease.outExpo)
  const word = (
    <KineticText
      text={text}
      at={at}
      by="char"
      stagger={42}
      duration={600}
      from={{ scale: 1.6, blur: 22, opacity: 0, y: 12 }}
    />
  )

  return (
    <div
      style={{
        position: 'relative',
        height: lineHeight(true),
        lineHeight: `${lineHeight(true)}px`,
        fontSize: HEADLINE.accent,
        fontWeight: 700,
        letterSpacing: '-0.025em',
        whiteSpace: 'nowrap',
      }}
    >
      {fill > 0 ? (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            left: '-0.12em',
            right: '-0.12em',
            top: '0.1em',
            bottom: '0.06em',
            background: BRAND,
            borderRadius: '0.14em',
            transformOrigin: 'left center',
            transform: `scaleX(${fill})`,
            boxShadow: `0 0 ${80 * fill}px rgb(255 79 1 / ${0.45 * fill})`,
          }}
        />
      ) : null}
      <span
        style={{ position: 'relative', color: BRAND, textShadow: '0 0 60px rgb(255 79 1 / 0.45)' }}
      >
        {word}
      </span>
      {fill > 0 ? (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            color: 'white',
            clipPath: `inset(0 ${(1 - fill) * 100}% 0 0)`,
          }}
        >
          {word}
        </span>
      ) : null}
      <EndSparks side="left" at={ALL_LIT} seed={61} />
      <EndSparks side="right" at={ALL_LIT + 130} seed={62} />
    </div>
  )
}
