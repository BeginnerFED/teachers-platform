'use client'

import { cn } from '@/lib/utils'
import { useAt, useScene } from '../../engine/clock'
import { EXIT_LEAD_MS } from '../../engine/motion'
import { LEAVING } from '../../engine/scene-frame'

/**
 * The promise, in the poster's own type: where the loop starts again, and the frame an
 * idle tab comes to rest on. The first pass skips it, because the server's poster has
 * just said it.
 */
export function IntroScene({ copy }: { copy: { title: string; line: string } }) {
  const { clock } = useScene()
  const leaving = useAt(clock.duration - EXIT_LEAD_MS)

  return (
    <div
      data-promo-scene
      className={cn(
        'absolute inset-0 flex flex-col justify-center px-10 pb-16',
        leaving && LEAVING,
      )}
    >
      <div className="flex max-w-[23rem] flex-col gap-3">
        <p className="font-heading animate-rise-in text-balance text-[1.75rem] leading-snug">
          {copy.title}
        </p>
        <p
          className="animate-rise-in text-foreground/70 text-sm"
          style={{ animationDelay: '60ms' }}
        >
          {copy.line}
        </p>
      </div>
    </div>
  )
}
