'use client'

import { CheckIcon } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { UiCard } from '../fx/surface'
import { BRAND, clamp, INK } from '../time'

/**
 * The pieces the homework shot is built from: the lesson card as the library draws it, the
 * PDF it replaces, a student's disc and the tick that says their copy arrived — plus the
 * curved paths the copies fly along. The shot places, scales and turns them.
 */

export type Point = { x: number; y: number }

/**
 * A cubic Bézier, walked by distance rather than by its parameter: `at(0.5)` is halfway
 * along the curve, the same halfway an SVG dash measures — so a copy flying along it and
 * the trail drawn behind it stay together.
 */
export type FlightPath = { d: string; length: number; at: (fraction: number) => Point }

export function flightPath(p0: Point, p1: Point, p2: Point, p3: Point, samples = 120): FlightPath {
  const point = (t: number): Point => {
    const u = 1 - t
    const a = u * u * u
    const b = 3 * u * u * t
    const c = 3 * u * t * t
    const e = t * t * t
    return {
      x: a * p0.x + b * p1.x + c * p2.x + e * p3.x,
      y: a * p0.y + b * p1.y + c * p2.y + e * p3.y,
    }
  }

  const lengths = [0]
  let previous = p0
  for (let index = 1; index <= samples; index++) {
    const next = point(index / samples)
    lengths.push(lengths[index - 1]! + Math.hypot(next.x - previous.x, next.y - previous.y))
    previous = next
  }
  const length = lengths[samples]!

  const at = (fraction: number): Point => {
    const target = clamp(fraction) * length
    let low = 0
    let high = samples
    while (high - low > 1) {
      const middle = (low + high) >> 1
      if (lengths[middle]! < target) low = middle
      else high = middle
    }
    const span = lengths[high]! - lengths[low]!
    const t = (low + (span > 0 ? (target - lengths[low]!) / span : 0)) / samples
    return point(t)
  }

  return { d: `M ${p0.x} ${p0.y} C ${p1.x} ${p1.y}, ${p2.x} ${p2.y}, ${p3.x} ${p3.y}`, length, at }
}

/** How far along a path it first leaves a rectangle (centre, half sizes): where a link shows. */
export function leavesAt(
  path: FlightPath,
  center: Point,
  halfWidth: number,
  halfHeight: number,
): number {
  for (let step = 0; step <= 200; step++) {
    const fraction = step / 200
    const point = path.at(fraction)
    if (Math.abs(point.x - center.x) > halfWidth || Math.abs(point.y - center.y) > halfHeight)
      return fraction
  }
  return 1
}

/** MaterialCard's own size in the library grid; `unit` films it larger, laid out at that size. */
export const CARD_W = 216
export const CARD_H = 106

/**
 * MaterialCard (material-card.tsx): the title, then one quiet line — the level chip and
 * "4 кроки · ≈ 25 хв". Laid out at `unit` times its size rather than scaled, so the type
 * stays sharp on camera. `stamp` sits where the card keeps room for its menu: a copy
 * carries its student's initials there.
 */
export function LessonCard({
  title,
  level,
  meta,
  unit = 1,
  stamp,
  glow,
}: {
  title: string
  level: string
  meta: string
  unit?: number
  stamp?: ReactNode
  /** A coloured edge and halo, for a copy in flight. */
  glow?: { color: string; amount: number }
}) {
  const u = unit
  const halo = glow !== undefined && glow.amount > 0.01
  return (
    <UiCard
      width={CARD_W * u}
      height={CARD_H * u}
      radius={16 * u}
      style={{
        position: 'relative',
        padding: 16 * u,
        display: 'flex',
        flexDirection: 'column',
        gap: 12 * u,
        border: `${u}px solid rgb(229 229 229 / 0.7)`,
        boxShadow: [
          `inset 0 ${u}px 0 rgb(255 255 255 / 0.7)`,
          `0 ${18 * u}px ${34 * u}px ${-10 * u}px rgb(0 0 0 / 0.6)`,
          `0 ${6 * u}px ${14 * u}px ${-6 * u}px rgb(0 0 0 / 0.45)`,
          halo ? `0 0 0 ${2 * u * glow.amount}px ${glow.color}` : '',
          halo ? `0 0 ${26 * u * glow.amount}px ${glow.color}` : '',
        ]
          .filter(Boolean)
          .join(', '),
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 8 * u,
        }}
      >
        <h3
          className="text-balance"
          style={{
            margin: 0,
            fontSize: 15 * u,
            fontWeight: 500,
            lineHeight: 1.375,
            letterSpacing: '-0.005em',
          }}
        >
          {title}
        </h3>
        <div
          style={{
            width: 28 * u,
            height: 28 * u,
            marginTop: -4 * u,
            marginRight: -4 * u,
            flexShrink: 0,
            display: 'grid',
            placeItems: 'center',
          }}
        >
          {stamp}
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8 * u,
          fontSize: 12 * u,
          lineHeight: `${16 * u}px`,
          color: '#737373',
        }}
      >
        <span
          style={{
            background: '#f4f4f5',
            color: 'rgb(23 23 23 / 0.8)',
            borderRadius: 999,
            padding: `${2 * u}px ${8 * u}px`,
            fontFamily: 'var(--font-mono), ui-monospace, monospace',
            fontSize: 11 * u,
            fontWeight: 500,
            lineHeight: `${16 * u}px`,
          }}
        >
          {level}
        </span>
        <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{meta}</span>
      </div>
    </UiCard>
  )
}

/** A student's initials on their colour, small enough to stamp a card. */
export function Stamp({
  label,
  color,
  unit = 1,
  opacity = 1,
}: {
  label: string
  color: string
  unit?: number
  opacity?: number
}) {
  if (opacity <= 0.01) return null
  return (
    <span
      style={{
        width: 24 * unit,
        height: 24 * unit,
        borderRadius: 999,
        background: color,
        color: 'white',
        fontSize: 9.5 * unit,
        fontWeight: 650,
        letterSpacing: '-0.01em',
        display: 'grid',
        placeItems: 'center',
        opacity,
        boxShadow: `0 0 0 ${2 * unit}px white`,
      }}
    >
      {label}
    </span>
  )
}

export const PDF_W = 170
export const PDF_H = 214
const FOLD = 46
const PAGE_CLIP = `polygon(0 0, ${PDF_W - FOLD}px 0, ${PDF_W}px ${FOLD}px, ${PDF_W}px ${PDF_H}px, 0 ${PDF_H}px)`

/** The page the lesson used to be: a PDF with its red badge and a file name under it. */
export function PdfDoc({ name, style }: { name?: string; style?: CSSProperties }) {
  return (
    <div style={{ position: 'relative', width: PDF_W, height: PDF_H, ...style }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 16,
          background: 'linear-gradient(160deg, #fbf9f7, #ece7e2)',
          clipPath: PAGE_CLIP,
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 22,
            top: 32,
            width: 74,
            height: 12,
            borderRadius: 6,
            background: '#bdb4ab',
          }}
        />
        {[0.78, 0.9, 0.62, 0.84, 0.5].map((width, index) => (
          <div
            key={index}
            style={{
              position: 'absolute',
              left: 22,
              top: 66 + index * 20,
              width: (PDF_W - 44) * width,
              height: 8,
              borderRadius: 4,
              background: '#d9d2cb',
            }}
          />
        ))}
      </div>
      <div
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          width: FOLD,
          height: FOLD,
          borderBottomLeftRadius: 10,
          background: 'linear-gradient(to top right, #d3cac1 50%, transparent 50%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: -18,
          bottom: 30,
          padding: '6px 14px',
          borderRadius: 10,
          background: 'linear-gradient(160deg, #f0443b, #d42a22)',
          color: 'white',
          fontSize: 30,
          fontWeight: 800,
          letterSpacing: '0.02em',
          lineHeight: 1.1,
          boxShadow: '0 10px 22px -8px rgb(212 42 34 / 0.75)',
        }}
      >
        PDF
      </div>
      {name ? (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: PDF_H + 20,
            transform: 'translateX(-50%)',
            whiteSpace: 'nowrap',
            fontFamily: 'var(--font-mono), ui-monospace, monospace',
            fontSize: 21,
            color: 'rgb(255 255 255 / 0.5)',
          }}
        >
          {name}
        </div>
      ) : null}
    </div>
  )
}

/** The silhouette of the page, for the colour ghosts of a glitch. */
export function PdfGhost({ color, style }: { color: string; style?: CSSProperties }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: PDF_W,
        height: PDF_H,
        borderRadius: 16,
        background: color,
        mixBlendMode: 'screen',
        clipPath: PAGE_CLIP,
        ...style,
      }}
    />
  )
}

/** The orange stroke that crosses the PDF out, drawn from its top-left corner. */
export function Strike({ amount }: { amount: number }) {
  if (amount <= 0.001) return null
  const from = { x: -24, y: 10 }
  const to = { x: PDF_W + 22, y: PDF_H - 6 }
  const length = Math.hypot(to.x - from.x, to.y - from.y)
  const angle = (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI
  return (
    <div
      style={{
        position: 'absolute',
        left: from.x,
        top: from.y - 8,
        width: length * amount,
        height: 16,
        borderRadius: 8,
        background: `linear-gradient(90deg, #ff8a4c, ${BRAND} 35%)`,
        transform: `rotate(${angle}deg)`,
        transformOrigin: '0 50%',
        boxShadow: `0 0 26px rgb(255 79 1 / 0.9), 0 0 0 3px ${INK}`,
      }}
    />
  )
}

export type StudentLook = { color: string; light: string; dark: string }

/** A student as a round disc of their colour with their initials: the class's faces. */
export function StudentDisc({
  size,
  look,
  label,
  lit,
  flash,
}: {
  size: number
  look: StudentLook
  label: string
  /** 0 while waiting (muted), 1 once their copy has arrived. */
  lit: number
  /** A white flash over the disc, 0–1, at the moment of arrival. */
  flash: number
}) {
  return (
    <div
      style={{
        position: 'relative',
        width: size,
        height: size,
        borderRadius: '50%',
        background: `radial-gradient(circle at 32% 26%, ${look.light} 0%, ${look.color} 52%, ${look.dark} 100%)`,
        display: 'grid',
        placeItems: 'center',
        color: 'white',
        fontSize: size * 0.36,
        fontWeight: 650,
        letterSpacing: '-0.02em',
        filter:
          lit < 0.99
            ? `saturate(${0.25 + 0.75 * lit}) brightness(${0.62 + 0.38 * lit})`
            : undefined,
        boxShadow: [
          `0 0 0 ${size * 0.035}px rgb(255 255 255 / ${0.1 + 0.12 * lit})`,
          `0 ${size * 0.16}px ${size * 0.34}px -${size * 0.1}px rgb(0 0 0 / 0.75)`,
          'inset 0 2px 0 rgb(255 255 255 / 0.35)',
          lit > 0.01 ? `0 0 ${size * 0.55 * lit}px ${look.color}` : '',
        ]
          .filter(Boolean)
          .join(', '),
      }}
    >
      {label}
      {flash > 0.01 ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background: 'white',
            opacity: flash,
          }}
        />
      ) : null}
    </div>
  )
}

/** The emerald tick that lands on a student once their copy is theirs. */
export function CheckBadge({ size }: { size: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'linear-gradient(145deg, #34d399, #10b981 60%, #059669)',
        display: 'grid',
        placeItems: 'center',
        boxShadow: `0 0 0 ${size * 0.11}px ${INK}, 0 ${size * 0.14}px ${size * 0.34}px rgb(0 0 0 / 0.55), 0 0 ${size * 0.5}px rgb(16 185 129 / 0.55)`,
      }}
    >
      <CheckIcon
        color="white"
        strokeWidth={3.4}
        style={{ width: size * 0.56, height: size * 0.56 }}
      />
    </div>
  )
}
