'use client'

import { BellIcon } from 'lucide-react'
import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'
import { BRAND } from '../time'

/**
 * The schedule shot's pieces, drawn at film scale. Pure pictures: every number that moves
 * them comes in through props, worked out from the shot's clock in schedule.tsx.
 */

export type Person = 'olya' | 'maksym' | 'iryna' | 'dmytro' | 'anna'

/** The tints the week grid gives each student (the schedule scene's own buckets). */
export const TINT: Record<Person, string> = {
  olya: 'bg-sky-100 text-sky-800',
  maksym: 'bg-violet-100 text-violet-800',
  iryna: 'bg-emerald-100 text-emerald-800',
  dmytro: 'bg-amber-100 text-amber-800',
  anna: 'bg-rose-100 text-rose-800',
}

/** Each student's colour at full strength: the ring a face sends out as it lands. */
export const PRESENCE: Record<Person, string> = {
  olya: '#0ea5e9',
  maksym: '#8b5cf6',
  iryna: '#10b981',
  dmytro: '#f59e0b',
  anna: '#f43f5e',
}

/** A lesson on the grid: the student's initials in their tint, outlined at half strength. */
export function Face({
  initials,
  person,
  size,
  style,
}: {
  initials: string
  person: Person
  size: number
  style?: CSSProperties
}) {
  return (
    <span
      className={cn('flex items-center justify-center rounded-full font-semibold', TINT[person])}
      style={{
        width: size,
        height: size,
        fontSize: size * (10 / 28),
        lineHeight: 1,
        borderStyle: 'solid',
        borderWidth: Math.max(1, size / 28),
        borderColor: 'color-mix(in oklab, currentColor 50%, transparent)',
        ...style,
      }}
    >
      {initials}
    </span>
  )
}

/**
 * The Sonner toast's measures (components/ui/sonner.tsx), scaled up for the frame. With the
 * depth it stands at, its words land at 28px and over on screen.
 */
const F = 2.2

/**
 * The reminder as the product's Toaster draws it — popover surface, the kind as its title,
 * the lesson as its description, the small dark action — scaled so every word reads.
 */
export function Reminder({
  title,
  description,
  action,
  style,
}: {
  title: string
  description: string
  action: string
  style?: CSSProperties
}) {
  return (
    <div
      className="bg-popover text-popover-foreground flex items-center border"
      style={{
        width: 356 * F,
        gap: 6 * F,
        borderRadius: 10 * F,
        padding: 16 * F,
        fontSize: 13 * F,
        boxShadow: [
          '0 1px 0 rgb(255 255 255 / 0.6) inset',
          '0 46px 90px -24px rgb(0 0 0 / 0.65)',
          '0 18px 36px -18px rgb(0 0 0 / 0.5)',
        ].join(', '),
        ...style,
      }}
    >
      <div className="flex min-w-0 flex-1 flex-col" style={{ gap: 2 * F }}>
        <p className="font-medium" style={{ lineHeight: 1.5 }}>
          {title}
        </p>
        <p style={{ lineHeight: 1.4, color: '#3f3f3f' }}>{description}</p>
      </div>
      <span
        className="bg-popover-foreground text-popover flex shrink-0 items-center font-medium"
        style={{ height: 24 * F, padding: `0 ${8 * F}px`, borderRadius: 4 * F, fontSize: 12 * F }}
      >
        {action}
      </span>
    </div>
  )
}

/** lucide's bell (the product's icon set), as a shape to fill. */
const BELL_BODY =
  'M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326'

/**
 * The bell as an object: lucide's outline filled with the brand's own gradient, lit from the
 * top left, hung from its knob. `swing` turns it on that knob; the clapper lags behind.
 */
export function Bell({
  size,
  swing,
  clapper,
  glow,
}: {
  size: number
  swing: number
  clapper: number
  glow: number
}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        transform: `rotate(${swing}deg)`,
        transformOrigin: '50% 6.5%',
        filter: `drop-shadow(0 ${size * 0.07}px ${size * 0.09}px rgb(0 0 0 / 0.5)) drop-shadow(0 0 ${size * (0.08 + 0.2 * glow)}px rgb(255 96 20 / ${0.35 + 0.45 * glow}))`,
      }}
    >
      <svg viewBox="0 0 24 24" width={size} height={size} style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id="schedule-bell-body" x1="0.12" y1="0.05" x2="0.88" y2="0.95">
            <stop offset="0" stopColor="#ffb98a" />
            <stop offset="0.42" stopColor="#ff6419" />
            <stop offset="1" stopColor="#c73200" />
          </linearGradient>
          <radialGradient id="schedule-bell-shine" cx="0.34" cy="0.3" r="0.42">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.8" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="schedule-bell-lip" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#d93f00" />
            <stop offset="0.38" stopColor="#ffa36b" />
            <stop offset="1" stopColor="#a82a00" />
          </linearGradient>
        </defs>
        <g transform={`rotate(${clapper} 12 14.5)`}>
          <circle cx="12" cy="19.3" r="2" fill="#ffd9bf" />
          <circle cx="11.4" cy="18.7" r="0.7" fill="#ffffff" opacity="0.8" />
        </g>
        <circle
          cx="12"
          cy="1.55"
          r="1.15"
          fill="none"
          stroke="url(#schedule-bell-lip)"
          strokeWidth="0.75"
        />
        <path d={BELL_BODY} fill="url(#schedule-bell-body)" />
        <path d={BELL_BODY} fill="url(#schedule-bell-shine)" />
        <rect
          x="3.3"
          y="15.35"
          width="17.4"
          height="1.65"
          rx="0.82"
          fill="url(#schedule-bell-lip)"
        />
      </svg>
    </div>
  )
}

/**
 * A clock of the hour before the lesson, as a gauge: sixty ticks, the hour mark at the top,
 * and the last quarter — the fifteen minutes the reminder gives — drawn in the brand colour
 * from the top back to 9 o'clock. Angles are degrees clockwise from 12.
 */
export function Dial({
  r,
  reveal,
  arc,
  flare,
  satellite,
  pulse = 0,
}: {
  r: number
  /** 0–1: how far round the clock the ticks have drawn. */
  reveal: number
  /** 0–1: how much of the quarter the orange arc covers, from 12 back towards 9. */
  arc: number
  /** 0–1: the strike's light. */
  flare: number
  /** Where the small light on the outer track is, in degrees. */
  satellite: number
  /** 0–1: a ring leaving the arc's end — the reminder's moment — on a beat. 0 draws none. */
  pulse?: number
}) {
  const box = 2 * (r + 44)
  const c = box / 2
  const at = (deg: number, radius: number) => {
    const a = ((deg - 90) * Math.PI) / 180
    return { x: c + radius * Math.cos(a), y: c + radius * Math.sin(a) }
  }

  const start = at(0, r)
  const end = at(-90 * arc, r)
  const arcPath = arc > 0.002 ? `M ${start.x} ${start.y} A ${r} ${r} 0 0 0 ${end.x} ${end.y}` : null
  const sat = at(satellite, r + 30)
  const track = 2 * Math.PI * (r + 30)

  return (
    <svg
      width={box}
      height={box}
      viewBox={`0 0 ${box} ${box}`}
      style={{ overflow: 'visible', display: 'block' }}
    >
      <defs>
        <radialGradient id="schedule-dial-face" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.07" />
          <stop offset="0.72" stopColor="#ffffff" stopOpacity="0.025" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <filter id="schedule-dial-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
      </defs>
      <circle cx={c} cy={c} r={r - 30} fill="url(#schedule-dial-face)" />
      <circle
        cx={c}
        cy={c}
        r={r + 30}
        fill="none"
        stroke="white"
        strokeOpacity={0.09}
        strokeWidth={1.5}
      />
      <circle
        cx={c}
        cy={c}
        r={r}
        fill="none"
        stroke="white"
        strokeOpacity={0.22 + 0.3 * flare}
        strokeWidth={2}
        strokeDasharray={`${2 * Math.PI * r * reveal} ${2 * Math.PI * r}`}
        transform={`rotate(-90 ${c} ${c})`}
      />
      {Array.from({ length: 60 }, (_, index) => {
        if (index / 60 > reveal) return null
        const major = index % 5 === 0
        const inQuarter = index >= 45 || index === 0
        const lit = inQuarter && arc >= (index === 0 ? 0 : (60 - index) / 15)
        const a = at(index * 6, r - (major ? 24 : 12))
        const b = at(index * 6, r - 6)
        return (
          <line
            key={index}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke={lit ? BRAND : 'white'}
            strokeOpacity={lit ? 1 : (major ? 0.55 : 0.24) + 0.3 * flare}
            strokeWidth={major ? 3.5 : 2}
            strokeLinecap="round"
          />
        )
      })}
      {arcPath ? (
        <>
          <path
            d={arcPath}
            fill="none"
            stroke={BRAND}
            strokeOpacity={0.55 + 0.35 * flare}
            strokeWidth={22 + 14 * flare}
            strokeLinecap="round"
            filter="url(#schedule-dial-glow)"
          />
          <path
            d={arcPath}
            fill="none"
            stroke={BRAND}
            strokeWidth={9 + 4 * flare}
            strokeLinecap="round"
          />
          {pulse > 0 && pulse < 1 ? (
            <circle
              cx={end.x}
              cy={end.y}
              r={12 + 40 * pulse}
              fill="none"
              stroke={BRAND}
              strokeWidth={3}
              strokeOpacity={1 - pulse}
            />
          ) : null}
          <circle
            cx={end.x}
            cy={end.y}
            r={9 + 3 * flare}
            fill="white"
            stroke={BRAND}
            strokeWidth={4}
          />
        </>
      ) : null}
      <circle
        cx={c}
        cy={c}
        r={r + 30}
        fill="none"
        stroke="#ffb58a"
        strokeOpacity={0.35}
        strokeWidth={2}
        strokeLinecap="round"
        strokeDasharray={`${track * 0.09} ${track}`}
        transform={`rotate(${satellite - 90 - 32.4} ${c} ${c})`}
      />
      <circle
        cx={sat.x}
        cy={sat.y}
        r={4}
        fill="#ffd9c4"
        style={{ filter: 'drop-shadow(0 0 6px #ff9a5c)' }}
      />
    </svg>
  )
}

/** The small brand badge a face wears once its owner has been reminded too. */
export function BellBadge({ size }: { size: number }) {
  return (
    <span
      className="flex items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(145deg, #ff7a33, ${BRAND} 50%, #e22f00)`,
        boxShadow: `0 0 0 4px #0b0908, 0 6px 18px rgb(255 79 1 / 0.55)`,
      }}
    >
      <BellIcon
        color="white"
        strokeWidth={2.4}
        style={{ width: size * 0.56, height: size * 0.56 }}
      />
    </span>
  )
}
