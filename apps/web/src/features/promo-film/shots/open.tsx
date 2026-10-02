'use client'

import type { Cue } from '../audio/cues'
import type { FilmCopy } from '../copy'
import { Glow } from '../fx/backdrop'
import { LogoMark } from '../fx/brand'
import { Burst, Dust, Ring } from '../fx/effects'
import { Camera } from '../fx/space'
import {
  BRAND,
  clamp,
  ease,
  HEIGHT,
  INK,
  mix,
  progress,
  randoms,
  spring,
  useShot,
  WIDTH,
} from '../time'
import { CENTRE, Ember, EMBER_REST, Gloss, LightFlash, pulseAt, Rays, shake } from './open-fx'

/**
 * Open (0–4 s). Darkness and one ember — the same ember the film ends on. It catches on
 * the off-beat, then pulses on every beat with a ring while three orbits gather round it
 * and motes of light fall in. It squeezes, and on the downbeat of the second bar bursts
 * into the mark: sparks thrown at the lens, rays, the orbits blown out as tilted
 * shockwaves, a white-hot flash, the world's light coming up. The mark snaps aside and
 * pulls the name out from behind it, an orange line draws under it, and after a beat at
 * rest the lockup whips up out of the frame, clearing it for the problem's first word.
 */

const BOOM = 2000
/** The boom's light leads its sound by a frame, so the first white frame is the downbeat. */
const HIT = BOOM - 20
const BEATS = [500, 1000, 1500] as const

/** The lockup, measured in the film's own Inter: the name is 558 px wide at 72 px. */
const MARK = 124
const GAP = 30
const NAME_SIZE = 72
const NAME_WIDTH_PER_LETTER = 558 / 17
const LINE_Y = CENTRE.y + NAME_SIZE / 2 + 22
const SLIDE = { at: 2250, duration: 420 } as const
/** The name unrolls from behind the mark as it slides: at rest by ~2.6 s. */
const LETTERS = { at: 2180, stagger: 14, duration: 340 } as const
/** Out: a small wind-up, then a vertical whip clear of the frame by 3.9 s. */
const EXIT = { at: 3600, duration: 300, wind: 120, travel: 860 } as const

const ORBITS = [
  { r: 150, tilt: 72, angle: 26, speed: 2.6, at: 500, phase: 0.4 },
  { r: 212, tilt: 76, angle: -40, speed: -2.1, at: 1000, phase: 2.3 },
  { r: 276, tilt: 68, angle: 82, speed: 1.7, at: 1500, phase: 4.1 },
] as const

export const cues: readonly Cue[] = [
  { at: 250, kind: 'pop', gain: 0.3, pitch: -7 },
  { at: 500, kind: 'thud', gain: 0.42 },
  { at: 1000, kind: 'thud', gain: 0.5, pitch: 1 },
  { at: 1000, kind: 'riser', gain: 0.5, duration: 1000 },
  { at: 1500, kind: 'thud', gain: 0.6, pitch: 2 },
  { at: 1720, kind: 'suck', gain: 0.5, duration: 280 },
  { at: BOOM, kind: 'impact', gain: 1 },
  { at: BOOM + 30, kind: 'sparkle', gain: 0.55 },
  { at: SLIDE.at, kind: 'whoosh', gain: 0.35, pan: -0.3, duration: 400 },
  { at: 3000, kind: 'chime', gain: 0.35, pan: 0.25 },
  { at: EXIT.at + 40, kind: 'whoosh', gain: 0.55, duration: 300 },
]

/** Three tilted orbits round the ember, each with a light riding it; blown out at the boom. */
function Orbits() {
  const { local } = useShot()
  if (local < 400 || local > BOOM + 760) return null

  const { x: cx, y: cy } = CENTRE
  const collapse = progress(local, 1720, 280, ease.inCubic)
  const blast = progress(local, BOOM, 720, ease.outExpo)
  const before = local < BOOM

  return (
    <svg
      aria-hidden
      width={WIDTH}
      height={HEIGHT}
      style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}
    >
      {ORBITS.map((orbit, index) => {
        const appear = progress(local, orbit.at, 560, ease.outExpo)
        if (appear <= 0) return null

        const r = before
          ? orbit.r * mix(0.5, 1, appear) * (1 - 0.9 * collapse)
          : orbit.r * mix(0.1, 3.6 + index * 0.6, blast)
        const ry = r * Math.cos((orbit.tilt * Math.PI) / 180)
        const opacity = before ? appear * (1 - 0.5 * collapse) : 0.95 * (1 - blast)
        if (opacity <= 0.01) return null

        const angle = orbit.angle + (local / 1000) * 10 * Math.sign(orbit.speed)
        const stroke = before ? 1.5 : mix(3.4, 0.6, blast)
        const t = Math.max(0, local - orbit.at) / 1000
        const phi = orbit.phase + orbit.speed * (t + 0.8 * t * t)
        const dir = Math.sign(orbit.speed)

        return (
          <g key={index} transform={`rotate(${angle} ${cx} ${cy})`} opacity={opacity}>
            <path
              d={`M ${cx - r} ${cy} A ${r} ${ry} 0 0 1 ${cx + r} ${cy}`}
              fill="none"
              stroke="rgb(255 196 160 / 0.2)"
              strokeWidth={stroke}
            />
            <path
              d={`M ${cx + r} ${cy} A ${r} ${ry} 0 0 1 ${cx - r} ${cy}`}
              fill="none"
              stroke={before ? 'rgb(255 196 160 / 0.5)' : 'rgb(255 150 90 / 0.85)'}
              strokeWidth={stroke}
            />
            {before
              ? [0, 1, 2, 3, 4, 5].map((k) => {
                  const a = phi - k * 0.13 * dir
                  const front = Math.sin(a)
                  const size =
                    (k === 0 ? 3.8 : 2.8 - k * 0.38) * (1 + 0.35 * front) * (1 - 0.7 * collapse)
                  if (size <= 0.2) return null
                  return (
                    <circle
                      key={k}
                      cx={cx + r * Math.cos(a)}
                      cy={cy + ry * Math.sin(a)}
                      r={size}
                      fill={k === 0 ? '#fff4ec' : BRAND}
                      opacity={(k === 0 ? 1 : 0.75 - k * 0.12) * (0.55 + (0.45 * (front + 1)) / 2)}
                    />
                  )
                })
              : null}
          </g>
        )
      })}
    </svg>
  )
}

/** Motes of light spiralling into the ember, faster and denser toward the squeeze. */
function Motes() {
  const { local } = useShot()
  if (local < 650 || local > BOOM) return null

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {Array.from({ length: 34 }, (_, index) => {
        const [r1, r2, r3, r4, r5, r6] = randoms(4100 + index, 6) as [
          number,
          number,
          number,
          number,
          number,
          number,
        ]
        const arrive = mix(1150, 1990, Math.sqrt(r1))
        const travel = mix(650, 1050, r2)
        const p = (local - (arrive - travel)) / travel
        if (p <= 0 || p >= 1) return null

        const theta = r3 * Math.PI * 2
        const radius = mix(300, 720, r4)
        const spin = mix(0.9, 1.8, r5) * (r6 > 0.5 ? 1 : -1)
        const place = (q: number) => {
          const pull = ease.inCubic(q)
          return {
            x: CENTRE.x + Math.cos(theta + spin * pull) * radius * (1 - pull),
            y: CENTRE.y + Math.sin(theta + spin * pull) * radius * (1 - pull),
          }
        }
        const now = place(p)
        const prev = place(Math.max(0, p - 0.04))
        const dx = now.x - prev.x
        const dy = now.y - prev.y
        const long = Math.max(3, Math.hypot(dx, dy) * 1.5)

        return (
          <span
            key={index}
            style={{
              position: 'absolute',
              left: now.x - long,
              top: now.y - 1.25,
              width: long,
              height: 2.5,
              borderRadius: 99,
              background: 'linear-gradient(90deg, transparent, #ffc8a4)',
              opacity: clamp(p * 4) * (1 - clamp((p - 0.88) / 0.12)) * 0.85,
              transform: `rotate(${(Math.atan2(dy, dx) * 180) / Math.PI}deg)`,
              transformOrigin: '100% 50%',
            }}
          />
        )
      })}
    </div>
  )
}

/**
 * Sparks thrown in 3D at the lens: each flies on its own seeded heading, some toward the
 * camera, so they grow and streak as they come. Each is a streak of light, white at the head
 * and fading along its tail; its glow follows its own alpha, so a tail never reads as a
 * hollow rod, and near the lens a spark grows longer, not fatter.
 */
function LensSparks({
  at,
  x,
  y,
  count,
  seed,
  speed,
  life,
  size = [2.5, 5],
  colors = ['#ffffff', '#ffd2b0', BRAND],
  depth = 1000,
  gravity = 160,
  drag = 2.6,
  stretch = 1,
  maxThick = 7,
}: {
  at: number
  x: number
  y: number
  count: number
  seed: number
  speed: [number, number]
  life: [number, number]
  size?: [number, number]
  colors?: string[]
  depth?: number
  gravity?: number
  drag?: number
  stretch?: number
  maxThick?: number
}) {
  const { local } = useShot()
  const elapsed = local - at
  if (elapsed < 0 || elapsed > life[1]) return null

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {Array.from({ length: count }, (_, index) => {
        const [r1, r2, r3, r4, r5, r6] = randoms(seed * 7919 + index * 31, 6) as [
          number,
          number,
          number,
          number,
          number,
          number,
        ]
        const lifetime = mix(life[0], life[1], r4)
        if (elapsed > lifetime) return null

        const theta = r1 * Math.PI * 2
        const dz = mix(-0.45, 0.85, r2)
        const planar = Math.sqrt(1 - dz * dz)
        const velocity = mix(speed[0], speed[1], r3)

        const place = (ms: number) => {
          const s = Math.max(0, ms) / 1000
          const travelled = (velocity * (1 - Math.exp(-drag * s))) / drag
          const px = Math.cos(theta) * planar * travelled
          const py = Math.sin(theta) * planar * travelled + 0.5 * gravity * s * s
          const pz = dz * travelled
          const k = depth / Math.max(depth - pz, depth * 0.2)
          return { sx: x + px * k, sy: y + py * k, k }
        }

        const now = place(elapsed)
        const before = place(elapsed - 40)
        const dx = now.sx - before.sx
        const dy = now.sy - before.sy
        const thick = Math.min(maxThick, mix(size[0], size[1], r5) * now.k)
        const long = Math.max(thick, Math.hypot(dx, dy) * 1.3 * stretch)
        const fade = 1 - ease.inCubic(clamp(elapsed / lifetime))
        const color = colors[Math.floor(r6 * colors.length)] ?? BRAND
        const heading = (Math.atan2(dy, dx) * 180) / Math.PI

        return (
          <span
            key={index}
            style={{
              position: 'absolute',
              left: now.sx - long,
              top: now.sy - thick / 2,
              width: long,
              height: thick,
              borderRadius: 999,
              opacity: fade,
              background: `linear-gradient(90deg, rgb(255 255 255 / 0), ${color} 62%, #ffffff)`,
              transform: `rotate(${heading}deg)`,
              transformOrigin: '100% 50%',
              filter: `drop-shadow(0 0 ${(thick * 1.4).toFixed(1)}px ${color})`,
            }}
          />
        )
      })}
    </div>
  )
}

/** An anamorphic streak across the frame at the boom: the lens catching the light. */
function Streak({ at }: { at: number }) {
  const { local } = useShot()
  const p = progress(local, at, 700, ease.outCubic)
  if (local < at || p >= 1) return null
  const width = 1500 * ease.outExpo(clamp((local - at) / 240))
  const fade = 1 - p

  return (
    <>
      <span
        aria-hidden
        style={{
          position: 'absolute',
          left: CENTRE.x - width * 0.6,
          top: CENTRE.y - 46,
          width: width * 1.2,
          height: 92,
          opacity: fade * 0.9,
          background: 'radial-gradient(50% 50% at 50% 50%, rgb(255 110 30 / 0.5), transparent)',
        }}
      />
      <span
        aria-hidden
        style={{
          position: 'absolute',
          left: CENTRE.x - width / 2,
          top: CENTRE.y - 1.5,
          width,
          height: 3,
          opacity: fade,
          background:
            'linear-gradient(90deg, transparent, rgb(255 190 150 / 0.85) 28%, #ffffff 50%, rgb(255 190 150 / 0.85) 72%, transparent)',
        }}
      />
    </>
  )
}

/** The name, letter by letter, each rising out of a blur; never shown left of the mark. */
function Name({ text, left, clipLeft }: { text: string; left: number; clipLeft: number }) {
  const { local } = useShot()

  return (
    <div
      style={{
        position: 'absolute',
        left,
        top: CENTRE.y - NAME_SIZE / 2,
        fontSize: NAME_SIZE,
        fontWeight: 650,
        letterSpacing: '-0.035em',
        lineHeight: 1,
        whiteSpace: 'nowrap',
        color: 'white',
        clipPath: clipLeft > 0 ? `inset(-60px -60px -60px ${clipLeft}px)` : undefined,
      }}
    >
      {[...text].map((letter, index) => {
        const p = progress(
          local,
          LETTERS.at + index * LETTERS.stagger,
          LETTERS.duration,
          ease.outExpo,
        )
        return (
          <span
            key={index}
            style={{
              display: 'inline-block',
              whiteSpace: 'pre',
              opacity: clamp(p * 1.5),
              transform: p < 1 ? `translateY(${(1 - p) * NAME_SIZE * 0.5}px)` : undefined,
              filter: p < 0.97 ? `blur(${(1 - p) * 9}px)` : undefined,
            }}
          >
            {letter}
          </span>
        )
      })}
    </div>
  )
}

/** Where the lockup is, vertically, in its exit: a small wind-up, then the whip. */
function exitShift(local: number): number {
  const wind = progress(local, EXIT.at - EXIT.wind, EXIT.wind, ease.inOutCubic)
  const whipped = ease.inExpo(clamp((local - EXIT.at) / EXIT.duration))
  return mix(12 * wind, -EXIT.travel, whipped)
}

/** The mark bursting out of the ember, then the lockup it makes with the name. */
function Lockup({ name }: { name: string }) {
  const { local } = useShot()
  if (local < HIT || local > EXIT.at + EXIT.duration + 20) return null

  const nameWidth = NAME_WIDTH_PER_LETTER * [...name].length
  const left = CENTRE.x - (MARK + GAP + nameWidth) / 2
  const nameLeft = left + MARK + GAP

  const s = spring(local - HIT, { stiffness: 300, damping: 22 })
  const scale = mix(0.12, 1, s)
  const slide = progress(local, SLIDE.at, SLIDE.duration, ease.house)
  const markX = mix(CENTRE.x, left + MARK / 2, slide)
  const settle = progress(local, BOOM, 2200, ease.inOutCubic)
  const flare = 1 - progress(local, BOOM, 700, ease.outCubic)
  const draw = progress(local, 2520, 480, ease.inOutCubic)

  // The exit is a vertical whip: no fade, no focus pull — a smear along the path, as long as
  // the distance the lockup travels in a frame, and a slight stretch with the speed.
  const shift = exitShift(local)
  const speed = Math.abs(shift - exitShift(local - 1000 / 30))
  const smear = Math.min(110, speed * 0.32)
  const stretch = 1 + Math.min(0.22, speed / 1600)

  return (
    <div
      className="absolute inset-0"
      style={{
        transform: `translateY(${shift}px) scaleY(${stretch})`,
        transformOrigin: `${CENTRE.x}px ${CENTRE.y}px`,
        filter: smear > 0.4 ? 'url(#open-whip)' : undefined,
      }}
    >
      {smear > 0.4 ? (
        <svg aria-hidden width={0} height={0} style={{ position: 'absolute' }}>
          <filter
            id="open-whip"
            x="-10%"
            y="-80%"
            width="120%"
            height="260%"
            colorInterpolationFilters="sRGB"
          >
            <feGaussianBlur stdDeviation={`0 ${smear.toFixed(1)}`} />
          </filter>
        </svg>
      ) : null}
      <Glow
        x={markX}
        y={CENTRE.y}
        size={mix(520, 760, flare) * (1 + 0.05 * Math.sin(local / 260))}
        opacity={mix(0.34, 0.7, flare) * progress(local, HIT, 50)}
      />
      <div
        className="absolute inset-0"
        style={{
          transform: `perspective(1500px) rotateY(${mix(9, -4, settle)}deg) rotateX(${mix(8, 2, settle)}deg)`,
          transformOrigin: `${CENTRE.x}px ${CENTRE.y}px`,
        }}
      >
        <Name text={name} left={nameLeft} clipLeft={markX + (MARK / 2) * scale + 2 - nameLeft} />
        {draw > 0 ? (
          <span
            aria-hidden
            style={{
              position: 'absolute',
              left: nameLeft,
              top: LINE_Y - 1.5,
              width: nameWidth * draw,
              height: 3,
              borderRadius: 99,
              background: `linear-gradient(90deg, rgb(255 79 1 / 0.25), ${BRAND} 45%, #ff9a5c)`,
              boxShadow: '0 0 14px rgb(255 79 1 / 0.65)',
            }}
          />
        ) : null}
        {draw > 0 && draw < 1 ? (
          <Ember x={nameLeft + nameWidth * draw} y={LINE_Y} size={7} glow={70} heat={1} />
        ) : null}
        <Burst
          at={3000}
          x={nameLeft + nameWidth}
          y={LINE_Y}
          count={10}
          seed={8}
          speed={[90, 280]}
          size={[2, 4]}
          life={[300, 650]}
          gravity={60}
        />
        <div
          style={{
            position: 'absolute',
            left: markX - MARK / 2,
            top: CENTRE.y - MARK / 2,
            width: MARK,
            height: MARK,
            transform: `scale(${scale}) rotate(${mix(-24, 0, s)}deg)`,
          }}
        >
          <LogoMark size={MARK} glow={mix(0.25, 1.1, flare)} />
          <Gloss
            size={MARK}
            radius={MARK * 0.26}
            amount={progress(local, 2160, 480, ease.inOutCubic)}
          />
        </div>
      </div>
    </div>
  )
}

export function Shot({ copy }: { copy: FilmCopy }) {
  const { local } = useShot()
  if (local < 0 || local > 4300) return null

  // The ember: at rest (the loop's frame), caught at 250, swelling on each beat, its halo
  // spreading as the charge builds, squeezed before the boom.
  const ignite = clamp(progress(local, 250, 380, ease.outBack), 0, 1.06)
  const pulse = Math.max(...BEATS.map((at) => pulseAt(local, at)))
  const charge = progress(local, 500, 1300, ease.inOutCubic)
  const squeeze = progress(local, 1720, 280, ease.inCubic)

  // Camera: a slow creep in through the build, the squeeze's lean, the boom's snap and jolt.
  const jolt = shake(local, BOOM, 220, 6, 3)
  const zoom =
    mix(0.95, 1, progress(local, 0, 1700, ease.inOutCubic)) *
    (1 +
      0.05 * progress(local, 1650, 350, ease.inCubic) -
      0.05 * progress(local, BOOM, 380, ease.outExpo) +
      0.025 * progress(local, 2300, 2000, ease.inOutCubic))
  const scrim = 1 - progress(local, BOOM + 30, 500, ease.outCubic)
  const dust = 0.4 * progress(local, BOOM, 700) * (1 - progress(local, 3600, 400))

  return (
    <>
      {scrim > 0.001 ? (
        <div className="absolute inset-0" style={{ background: INK, opacity: scrim }} />
      ) : null}
      <Camera zoom={zoom} x={-jolt.x} y={-jolt.y}>
        <Rays
          x={CENTRE.x}
          y={CENTRE.y}
          size={1500 * mix(0.55, 1.15, progress(local, HIT, 800, ease.outExpo))}
          turn={local * 0.012}
          opacity={
            0.55 * progress(local, HIT, 40) * (1 - progress(local, BOOM + 60, 760, ease.outCubic))
          }
        />
        <Orbits />
        <Motes />
        <Ring at={250} x={CENTRE.x} y={CENTRE.y} from={6} to={80} duration={620} width={1.5} />
        <Ring at={500} x={CENTRE.x} y={CENTRE.y} from={8} to={190} duration={900} width={2} />
        <Ring at={1000} x={CENTRE.x} y={CENTRE.y} from={8} to={270} duration={950} width={2} />
        <Ring at={1500} x={CENTRE.x} y={CENTRE.y} from={8} to={360} duration={1000} width={2.5} />
        <Ring at={HIT} x={CENTRE.x} y={CENTRE.y} from={40} to={700} duration={900} width={5} />
        <Ring
          at={BOOM + 50}
          x={CENTRE.x}
          y={CENTRE.y}
          from={20}
          to={460}
          duration={560}
          width={2}
          color="#ffffff"
        />
        <Burst
          at={HIT}
          x={CENTRE.x}
          y={CENTRE.y}
          count={22}
          seed={5}
          speed={[180, 620]}
          size={[3, 7]}
          life={[900, 1700]}
          gravity={300}
        />
        <LensSparks
          at={HIT}
          x={CENTRE.x}
          y={CENTRE.y}
          count={40}
          seed={3}
          speed={[1300, 2900]}
          life={[380, 900]}
          drag={1.7}
          stretch={1.5}
        />
        <Streak at={HIT} />
        <Lockup name={copy.appName} />
      </Camera>
      {/* Outside the camera, so frame 0 is exactly the ember the film ends on. */}
      {local < BOOM + 34 ? (
        <Ember
          size={mix(EMBER_REST.size, 15, ignite) * (1 + 0.55 * pulse) * (1 - 0.45 * squeeze)}
          glow={
            mix(EMBER_REST.glow, 250, ignite) *
            mix(1, 1.7, charge) *
            (1 + 0.7 * pulse) *
            (1 - 0.6 * squeeze)
          }
          heat={clamp(mix(EMBER_REST.heat, 1, ignite))}
        />
      ) : null}
      {dust > 0.01 ? <Dust count={18} seed={11} opacity={dust} /> : null}
      <LightFlash at={HIT} x={CENTRE.x} y={CENTRE.y} rise={34} fall={460} peak={0.95} />
    </>
  )
}
