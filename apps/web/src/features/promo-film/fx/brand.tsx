'use client'

import { GraduationCapIcon } from 'lucide-react'
import type { CSSProperties } from 'react'
import { BRAND } from '../time'

/**
 * The product's mark — the graduation cap on a rounded square of the brand colour, as in
 * the sign-in page's corner — at any size.
 */
export function LogoMark({
  size = 96,
  glow = 0,
  style,
}: {
  size?: number
  glow?: number
  style?: CSSProperties
}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.26,
        background: `linear-gradient(145deg, #ff7a33, ${BRAND} 45%, #e22f00)`,
        display: 'grid',
        placeItems: 'center',
        boxShadow: [
          `0 ${size * 0.08}px ${size * 0.3}px rgb(255 79 1 / ${0.35 + glow * 0.4})`,
          `0 0 ${size * glow}px rgb(255 120 40 / ${0.6 * glow})`,
          'inset 0 1px 0 rgb(255 255 255 / 0.35)',
        ].join(', '),
        ...style,
      }}
    >
      <GraduationCapIcon
        color="white"
        strokeWidth={2}
        style={{ width: size * 0.56, height: size * 0.56 }}
      />
    </div>
  )
}

/** "Teachers Platform" in the product's type, letter by letter if given a reveal. */
export function Wordmark({
  name,
  size = 64,
  reveal = 1,
  style,
}: {
  name: string
  size?: number
  /** 0–1: how much of the name has arrived, letter by letter. */
  reveal?: number
  style?: CSSProperties
}) {
  const letters = [...name]
  const shown = reveal * letters.length

  return (
    <div
      style={{
        fontSize: size,
        fontWeight: 650,
        letterSpacing: '-0.035em',
        color: 'white',
        whiteSpace: 'nowrap',
        lineHeight: 1,
        ...style,
      }}
    >
      {letters.map((letter, index) => {
        const amount = Math.min(1, Math.max(0, shown - index))
        return (
          <span
            key={index}
            style={{
              display: 'inline-block',
              whiteSpace: 'pre',
              opacity: amount,
              transform: `translateY(${(1 - amount) * size * 0.45}px)`,
              filter: amount < 1 ? `blur(${(1 - amount) * 8}px)` : undefined,
            }}
          >
            {letter}
          </span>
        )
      })}
    </div>
  )
}
