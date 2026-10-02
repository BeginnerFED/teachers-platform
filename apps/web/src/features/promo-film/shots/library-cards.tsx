'use client'

import type { CSSProperties } from 'react'
import { clamp, mix } from '../time'

/**
 * The library shot's lesson cards: MaterialCard as the product draws it — the title, then
 * one quiet line with the level chip and "N кроки · ≈ M хв" — at film size.
 */

/** The CEFR levels, nearest shelf to farthest: the road from A1 to C2. */
export const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const
export type ShelfLevel = (typeof LEVELS)[number]

/**
 * What each shelf holds. Lesson content is English on the platform, so the titles are
 * data, not copy; the sign-in tour's own shelf is among them.
 */
export const TITLES: Record<ShelfLevel, readonly string[]> = {
  A1: [
    'Greetings and introductions',
    'Numbers, dates and times',
    'My family and friends',
    'Ordering a coffee',
    'Days of the week',
    'Colours and clothes',
    'Rooms in my home',
    'My daily routine',
    'At the supermarket',
  ],
  A2: [
    'Asking for directions in town',
    'Shopping for clothes and sizes',
    'Past Simple: last weekend',
    'At the train station',
    'Weather and seasons',
    'Plans with going to',
    'Hobbies and free time',
    'Describing people',
    'Booking a hotel room',
  ],
  B1: [
    'Present Perfect: life experiences',
    'Small talk with colleagues',
    'Making polite complaints',
    'Ordering food at a restaurant',
    'Giving advice with should',
    'Travel plans and bookings',
    'Used to: life then and now',
    'Making phone calls at work',
    'At the doctor’s: health problems',
  ],
  B2: [
    'Phrasal verbs with get and take',
    'Second conditional: what if?',
    'Job interview questions',
    'Reported speech in the news',
    'The passive in everyday English',
    'Debating pros and cons',
    'Writing a formal email',
    'Environment and climate',
    'Narrative tenses in stories',
  ],
  C1: [
    'Persuasive presentations',
    'Negotiating a deal',
    'Inversion for emphasis',
    'Hedging in academic writing',
    'Mixed conditionals',
    'Leading a meeting',
    'Cleft sentences for focus',
    'Collocations for essays',
    'Speculating about the past',
  ],
  C2: [
    'Idioms about time and money',
    'Irony and understatement',
    'Advanced word formation',
    'Literary devices in fiction',
    'The rhetoric of great speeches',
    'Register: formal and informal',
    'Euphemism and tact',
    'Nuances of modal verbs',
    'Humour across cultures',
  ],
}

export const CARD_W = 344
export const CARD_H = 152

export const MONO = 'var(--font-geist-mono), ui-monospace, monospace'

type Rgba = readonly [number, number, number, number]

/** A colour between two, channel by channel. */
function between(from: Rgba, to: Rgba, amount: number): string {
  const a = clamp(amount)
  return `rgb(${mix(from[0], to[0], a)} ${mix(from[1], to[1], a)} ${mix(from[2], to[2], a)} / ${mix(from[3], to[3], a)})`
}

/** Dark glass (the shelf before its lights come on) → the product's white card. */
const TONES = {
  surface: [
    [255, 255, 255, 0.05],
    [255, 255, 255, 1],
  ],
  border: [
    [255, 255, 255, 0.11],
    [229, 229, 229, 0.7],
  ],
  title: [
    [255, 255, 255, 0.4],
    [23, 23, 23, 1],
  ],
  meta: [
    [255, 255, 255, 0.27],
    [115, 115, 115, 1],
  ],
  chip: [
    [255, 255, 255, 0.08],
    [255, 79, 1, 0.12],
  ],
  chipText: [
    [255, 255, 255, 0.5],
    [226, 47, 0, 1],
  ],
} as const satisfies Record<string, readonly [Rgba, Rgba]>

const tone = (name: keyof typeof TONES, light: number) =>
  between(TONES[name][0], TONES[name][1], light)

/**
 * One lesson card. `light` 0 is a ghost of itself in dark glass; 1 is the product's white
 * card. `glow` (0–1) is the warm flash it gives off as its light comes on.
 */
export function LessonCard({
  title,
  level,
  meta,
  light,
  glow = 0,
  style,
}: {
  title: string
  level: string
  meta: string
  light: number
  glow?: number
  style?: CSSProperties
}) {
  const shadows = [
    light > 0.5 ? `0 26px 52px -22px rgb(0 0 0 / ${0.75 * light})` : '',
    glow > 0.01 ? `0 0 ${64 * glow}px ${6 * glow}px rgb(255 79 1 / ${0.6 * glow})` : '',
  ].filter(Boolean)

  return (
    <div
      style={{
        width: CARD_W,
        height: CARD_H,
        boxSizing: 'border-box',
        borderRadius: 26,
        padding: '24px 28px 22px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        background: tone('surface', light),
        border: `1.5px solid ${tone('border', light)}`,
        boxShadow: shadows.length ? shadows.join(', ') : undefined,
        ...style,
      }}
    >
      <div
        style={{
          fontSize: 29,
          fontWeight: 500,
          lineHeight: 1.22,
          letterSpacing: '-0.012em',
          color: tone('title', light),
          display: '-webkit-box',
          WebkitBoxOrient: 'vertical',
          WebkitLineClamp: 2,
          overflow: 'hidden',
        }}
      >
        {title}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          fontSize: 20,
          whiteSpace: 'nowrap',
          color: tone('meta', light),
        }}
      >
        <span
          style={{
            fontFamily: MONO,
            fontSize: 19,
            fontWeight: 500,
            lineHeight: '28px',
            padding: '0 12px',
            borderRadius: 999,
            background: tone('chip', light),
            color: tone('chipText', light),
          }}
        >
          {level}
        </span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{meta}</span>
      </div>
    </div>
  )
}
