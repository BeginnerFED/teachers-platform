'use client'

import { Fragment, useLayoutEffect, useRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { useAt, useScene } from './clock'
import { COLUMN_WIDTH, EASE, EXIT_LEAD_MS, staggered, stageRect } from './motion'

/** When the parts of a scene's opening arrive, in ms from the scene's start. */
export type FrameTiming = {
  /** The statement leaves the middle of the stage for the title slot. */
  glideAt?: number
  /** The plain sentence under the title rises. */
  lineAt?: number
  /** The product fragment rises under the caption. */
  fragmentAt?: number
}

/**
 * The statement holds just long enough to be read, then everything else follows on: no
 * frame shows the statement alone for more than about 0.7 s.
 */
export const DEFAULT_TIMING = { glideAt: 520, lineAt: 640, fragmentAt: 700 } as const

/** How a scene leaves: everything together, up 4px and out, faster than it came. */
export const LEAVING =
  'animate-out fade-out-0 slide-out-to-top-1 fill-mode-forwards duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]'

/** How long the statement takes to settle into the title slot: the house ceiling. */
const GLIDE_MS = 300

/** The statement is the title, drawn larger — never by more than this. */
const STATEMENT_SCALE = 1.2

/** Where the statement's middle sits while it is a statement: a little above centre. */
const STATEMENT_MIDDLE = 292

/**
 * Every feature scene opens the same way, like the pages of the product itself.
 *
 * 1. The title arrives in the middle of the stage as a statement, word by word.
 * 2. It settles into the page-title slot — the size and place of every page title.
 * 3. One plain sentence rises under it, then the product fragment under that.
 * 4. Near its end the whole scene leaves together.
 *
 * Only the fragment (`children`) is the scene's own. It is mounted when it arrives, so
 * its own entrances start then; everything inside it reads the same clock.
 */
export function SceneFrame({
  title,
  line,
  timing,
  className,
  overlay,
  children,
}: {
  title: string
  line: string
  timing?: FrameTiming
  className?: string
  /**
   * Drawn over the whole stage rather than inside the fragment: pointers and cursors,
   * whose positions are stage coordinates.
   */
  overlay?: ReactNode
  children: ReactNode
}) {
  const { clock, mode, bare } = useScene()
  const still = mode === 'still'
  const glideAt = timing?.glideAt ?? DEFAULT_TIMING.glideAt
  const lineAt = timing?.lineAt ?? DEFAULT_TIMING.lineAt
  const fragmentAt = timing?.fragmentAt ?? DEFAULT_TIMING.fragmentAt

  const lineIn = useAt(lineAt)
  const fragmentIn = useAt(fragmentAt)
  const leaving = useAt(clock.duration - EXIT_LEAD_MS)

  const titleRef = useRef<HTMLHeadingElement>(null)

  // The statement pose is a transform on the title in its final place, held until the
  // glide begins. Set before the first paint, so the title never flashes in its slot.
  useLayoutEffect(() => {
    const element = titleRef.current
    if (!element || still) return

    const rect = stageRect(element)
    if (!rect || rect.width === 0) return

    const scale = Math.min(STATEMENT_SCALE, COLUMN_WIDTH / rect.width)
    const shift = STATEMENT_MIDDLE - rect.y - (rect.height * scale) / 2

    const glide = element.animate(
      [{ transform: `translate(0, ${shift}px) scale(${scale})` }, { transform: 'none' }],
      { delay: glideAt, duration: GLIDE_MS, easing: EASE, fill: 'backwards' },
    )

    return () => glide.cancel()
  }, [glideAt, still])

  const words = title.split(' ')

  // Filmed rather than shown on the sign-in page: the product fragment alone, with its own
  // pointers, and no caption — the film writes its own words around it.
  if (bare) {
    return (
      <div data-promo-scene className={cn('absolute inset-0 px-10 pt-10', className)}>
        <div className="relative h-full">
          {fragmentIn ? <div className="h-full">{children}</div> : null}
        </div>
        {overlay}
      </div>
    )
  }

  return (
    <div
      data-promo-scene
      className={cn(
        'absolute inset-0 flex flex-col gap-8 px-10 pt-10',
        leaving && LEAVING,
        className,
      )}
    >
      <header className="flex flex-col gap-1.5">
        <h2
          ref={titleRef}
          className="text-foreground w-fit max-w-full origin-top-left text-balance text-2xl/8 font-semibold tracking-tight"
        >
          {words.map((word, index) => (
            <Fragment key={index}>
              {index > 0 ? ' ' : null}
              <span className="animate-rise-in inline-block" style={staggered(index)}>
                {word}
              </span>
            </Fragment>
          ))}
        </h2>
        <p
          className={cn(
            'text-foreground/70 text-pretty text-sm',
            lineIn ? 'animate-rise-in' : 'invisible',
          )}
        >
          {line}
        </p>
      </header>

      <div className="relative min-h-0 flex-1">
        {fragmentIn ? <div className="animate-rise-in h-full">{children}</div> : null}
      </div>

      {overlay}
    </div>
  )
}
