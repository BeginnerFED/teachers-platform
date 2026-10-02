'use client'

import type { CSSProperties, ReactNode } from 'react'

/**
 * The product's own white surface, lit for a dark stage: the card radius and border the
 * app uses, with a deep soft shadow so it floats.
 */
export function UiCard({
  width,
  height,
  children,
  radius = 28,
  padding = 0,
  style,
}: {
  width: number
  height: number
  children?: ReactNode
  radius?: number
  padding?: number
  style?: CSSProperties
}) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: radius,
        padding,
        overflow: 'hidden',
        background: 'white',
        color: '#171717',
        boxShadow: [
          '0 1px 0 rgb(255 255 255 / 0.6) inset',
          '0 40px 80px -20px rgb(0 0 0 / 0.55)',
          '0 18px 36px -18px rgb(0 0 0 / 0.5)',
          '0 0 0 1px rgb(255 255 255 / 0.08)',
        ].join(', '),
        ...style,
      }}
    >
      {children}
    </div>
  )
}

/**
 * A browser window around a product screen: traffic lights and an address pill. For the
 * shots that say "this is the real app".
 */
export function AppWindow({
  width,
  height,
  url = 'teachers-platform.app',
  children,
  style,
}: {
  width: number
  height: number
  url?: string
  children?: ReactNode
  style?: CSSProperties
}) {
  return (
    <UiCard width={width} height={height} radius={22} style={style}>
      <div
        style={{
          height: 44,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 16px',
          background: '#f6f5f4',
          borderBottom: '1px solid #ebe9e7',
        }}
      >
        {['#ff5f57', '#febc2e', '#28c840'].map((color) => (
          <span
            key={color}
            style={{ width: 12, height: 12, borderRadius: 99, background: color }}
          />
        ))}
        <span
          style={{
            margin: '0 auto',
            padding: '5px 18px',
            borderRadius: 99,
            background: 'white',
            border: '1px solid #ebe9e7',
            fontSize: 13,
            color: '#737373',
          }}
        >
          {url}
        </span>
      </div>
      <div style={{ position: 'relative', height: height - 44, overflow: 'hidden' }}>
        {children}
      </div>
    </UiCard>
  )
}
