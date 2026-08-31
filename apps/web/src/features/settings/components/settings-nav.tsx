'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type SettingsSection = { id: string; label: string }

/** Clears the sticky header, and matches the scroll-mt the sections carry. */
const HEADER_OFFSET = 96

/** What the word is made of before you have reached it. */
const UNREACHED = 'color-mix(in oklab, var(--muted-foreground) 35%, transparent)'

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

/**
 * The section index, set vertically beside the cards.
 *
 * The space to the left of a reading column has to be worth something or it reads as a
 * mistake. Turned on their side the labels occupy the height of the column rather than a
 * line of it, and each one fills with the brand colour as its card passes under the
 * reading line — so how far through the page you are is legible at a glance, without a
 * separate progress bar to say it.
 *
 * Everything stays on one URL: these are anchors, a shortcut through the page rather than
 * navigation away from it.
 */
export function SettingsNav({
  sections,
  footer,
}: {
  sections: SettingsSection[]
  /** Whatever is worth saying about the page as a whole. Optional, and page-specific. */
  footer?: ReactNode
}) {
  const [filled, setFilled] = useState<Record<string, number>>({})

  useEffect(() => {
    let frame = 0

    function measure() {
      const next: Record<string, number> = {}

      for (const section of sections) {
        const rect = document.getElementById(section.id)?.getBoundingClientRect()
        if (!rect) continue

        // How far the reading line has travelled through this card. Above it the word is
        // empty, below it full, and in between it fills at the rate you scroll.
        next[section.id] =
          rect.height > 0 ? clamp01((HEADER_OFFSET - rect.top) / rect.height) : 0
      }

      setFilled(next)
    }

    // Coalesced into a frame: reading a bounding box per section on every scroll event is
    // how a rail like this ends up being the reason a page feels heavy.
    function schedule() {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measure)
    }

    measure()

    // Captured on the document, because scroll does not bubble and the page may end up
    // scrolling an inner element rather than the window.
    document.addEventListener('scroll', schedule, { capture: true, passive: true })
    window.addEventListener('resize', schedule, { passive: true })

    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('scroll', schedule, { capture: true })
      window.removeEventListener('resize', schedule)
    }
  }, [sections])

  function go(event: React.MouseEvent<HTMLAnchorElement>, id: string) {
    const element = document.getElementById(id)
    if (!element) return

    event.preventDefault()

    // The fill needs no animation of its own: it follows the scroll, and the scroll here
    // is already smooth.
    element.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth',
      block: 'start',
    })

    // Replace rather than push, so the back button still leaves the page rather than
    // stepping back through five headings.
    history.replaceState(null, '', `#${id}`)
  }

  return (
    <nav
      aria-label={sections[0]?.label}
      className="sticky top-20 hidden h-fit w-52 shrink-0 xl:block"
    >
      <ul className="flex items-start gap-1">
        {sections.map((section) => {
          const progress = filled[section.id] ?? 0
          const current = progress > 0 && progress < 1

          return (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                onClick={(event) => go(event, section.id)}
                aria-current={current ? 'true' : undefined}
                className="group block px-1 py-1"
              >
                <span
                  className={cn(
                    'block text-xl font-semibold tracking-tight [writing-mode:vertical-rl]',
                    'motion-safe:transition-transform motion-safe:duration-200',
                    'group-hover:-translate-y-0.5',
                  )}
                  style={{
                    // Two flat halves of a gradient twice the height of the text, slid up
                    // as the section fills. Written this way rather than by moving the
                    // colour stops because a background position can be transitioned and
                    // a gradient stop cannot -- and because it is one paint either way.
                    backgroundImage: `linear-gradient(to bottom, var(--primary) 0 50%, ${UNREACHED} 50% 100%)`,
                    backgroundSize: '100% 200%',
                    backgroundPositionY: `${(1 - progress) * 100}%`,
                    WebkitBackgroundClip: 'text',
                    backgroundClip: 'text',
                    color: 'transparent',
                  }}
                >
                  {section.label}
                </span>
              </a>
            </li>
          )
        })}
      </ul>

      {footer ? <div className="mt-8 border-t pt-4">{footer}</div> : null}
    </nav>
  )
}
