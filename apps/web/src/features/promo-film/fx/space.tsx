'use client'

import type { CSSProperties, ReactNode } from 'react'
import { HEIGHT, WIDTH } from '../time'

export type Transform3D = {
  x?: number
  y?: number
  z?: number
  rotateX?: number
  rotateY?: number
  rotateZ?: number
  scale?: number
}

/** A CSS transform string for a pose in 3D space; units are px and degrees. */
export function transform3d({
  x = 0,
  y = 0,
  z = 0,
  rotateX = 0,
  rotateY = 0,
  rotateZ = 0,
  scale = 1,
}: Transform3D): string {
  return `translate3d(${x}px, ${y}px, ${z}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) rotateZ(${rotateZ}deg) scale(${scale})`
}

/**
 * A 3D space the size of the frame. Children positioned inside it can be moved and turned
 * in depth with `Layer`; `depth` is the CSS perspective, smaller is more dramatic.
 */
export function Space({
  depth = 1800,
  originX = WIDTH / 2,
  originY = HEIGHT / 2,
  children,
  style,
}: {
  depth?: number
  originX?: number
  originY?: number
  children: ReactNode
  style?: CSSProperties
}) {
  return (
    <div
      className="absolute inset-0"
      style={{
        perspective: depth,
        perspectiveOrigin: `${originX}px ${originY}px`,
        transformStyle: 'preserve-3d',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

/**
 * Something placed in the frame: centred on (cx, cy) unless `anchor` says otherwise, then
 * moved and turned by `pose`. Keeps 3D for its children so layers can nest.
 */
export function Layer({
  cx = WIDTH / 2,
  cy = HEIGHT / 2,
  width,
  height,
  pose,
  opacity = 1,
  origin = 'center',
  flat = false,
  children,
  className,
  style,
}: {
  cx?: number
  cy?: number
  width: number
  height: number
  pose?: Transform3D
  opacity?: number
  origin?: string
  /** Render without preserve-3d, e.g. when applying a filter that would flatten it anyway. */
  flat?: boolean
  children?: ReactNode
  className?: string
  style?: CSSProperties
}) {
  if (opacity <= 0.001) return null

  return (
    <div
      className={className}
      style={{
        position: 'absolute',
        left: cx - width / 2,
        top: cy - height / 2,
        width,
        height,
        opacity,
        transform: pose ? transform3d(pose) : undefined,
        transformOrigin: origin,
        transformStyle: flat ? undefined : 'preserve-3d',
        backfaceVisibility: 'hidden',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

/**
 * The camera: moves the whole world. `zoom` > 1 pushes in, `x`/`y` pan (in world px, so a
 * pan of 100 moves the world 100px the other way), `roll` tilts the horizon.
 */
export function Camera({
  zoom = 1,
  x = 0,
  y = 0,
  roll = 0,
  blur = 0,
  children,
}: {
  zoom?: number
  x?: number
  y?: number
  roll?: number
  blur?: number
  children: ReactNode
}) {
  return (
    <div
      className="absolute inset-0"
      style={{
        transform: `translate(${WIDTH / 2}px, ${HEIGHT / 2}px) rotate(${roll}deg) scale(${zoom}) translate(${-WIDTH / 2 - x}px, ${-HEIGHT / 2 - y}px)`,
        transformOrigin: '0 0',
        filter: blur > 0.05 ? `blur(${blur}px)` : undefined,
        transformStyle: 'preserve-3d',
      }}
    >
      {children}
    </div>
  )
}
