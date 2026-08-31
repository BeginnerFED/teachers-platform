'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

export type SettingsSection = { id: string; label: string }

/** Clears the sticky header, and matches the scroll-mt the sections carry. */
const HEADER_OFFSET = 96

export type LastChange = {
  label: string
  /** Null before anybody has saved anything. */
  by: string | null
  at: string
}

/**
 * A rail beside the cards rather than a second set of pages.
 *
 * The space to the left of a reading column has to be worth something or it reads as a
 * mistake, and on a page of five sections the useful thing to put there is a way to reach
 * the fifth one without scrolling past four. Everything stays on one URL — this is a
 * shortcut through the page, not navigation away from it.
 *
 * The line down its left fills as the page scrolls, which is the one piece of state a
 * settings page has that nothing else was showing: how much of it is left. Deliberately
 * quieter than the app sidebar's active row otherwise — two highlights competing in the
 * same brand tint would each make the other harder to find.
 */
export function SettingsNav({
  sections,
  lastChange,
}: {
  sections: SettingsSection[]
  lastChange: LastChange
}) {
  const [active, setActive] = useState<string[]>([])
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    let frame = 0

    function measure() {
      const boxes = sections
        .map((section) => ({
          id: section.id,
          rect: document.getElementById(section.id)?.getBoundingClientRect(),
        }))
        .filter((box): box is { id: string; rect: DOMRect } => Boolean(box.rect))

      if (boxes.length === 0) return

      const crossing = boxes.filter(
        (box) => box.rect.top <= HEADER_OFFSET && box.rect.bottom > HEADER_OFFSET,
      )

      if (crossing.length > 0) {
        setActive(crossing.map((box) => box.id))
      } else {
        // Nothing under the line: either above the first card, or past a last one too
        // short to reach it. Fall back to the row that most recently went by, ties
        // included, which is what keeps the final section reachable on a page barely
        // taller than the window.
        const passed = boxes.filter((box) => box.rect.top <= HEADER_OFFSET)
        const line = passed.length > 0 ? Math.max(...passed.map((box) => box.rect.top)) : null

        setActive(
          line === null
            ? boxes.filter((box) => Math.abs(box.rect.top - boxes[0].rect.top) < 4).map((b) => b.id)
            : passed.filter((box) => Math.abs(box.rect.top - line) < 4).map((box) => box.id),
        )
      }

      const scroller = document.scrollingElement ?? document.documentElement
      const travel = scroller.scrollHeight - scroller.clientHeight

      // A page that does not scroll is a page you have already seen all of.
      setProgress(travel > 0 ? Math.min(1, Math.max(0, scroller.scrollTop / travel)) : 1)
    }

    // Coalesced into a frame: reading five bounding boxes on every scroll event is how a
    // rail like this ends up being the reason a page feels heavy.
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
    <nav aria-label={sections[0]?.label} className="sticky top-20 hidden h-fit w-52 shrink-0 lg:block">
      <div className="relative">
        <span aria-hidden className="bg-border absolute inset-y-0 left-0 w-0.5 rounded-full" />

        {/* No transition on the height: this follows the scrollbar, and easing it would
            make the line lag behind the thing it is reporting on. */}
        <span
          aria-hidden
          className="bg-primary absolute top-0 left-0 w-0.5 rounded-full"
          style={{ height: `${progress * 100}%` }}
        />

        {/* The padding lines the first entry up with the title of the first card rather
            than with the top edge of its box. */}
        <ul className="flex flex-col pt-3">
          {sections.map((section, index) => {
            const current = active.includes(section.id)

            return (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  onClick={(event) => go(event, section.id)}
                  aria-current={current ? 'true' : undefined}
                  className={cn(
                    'group flex items-baseline gap-2.5 py-2 pl-4 text-sm transition-colors duration-200',
                    current
                      ? 'text-foreground font-medium'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <span
                    className={cn(
                      'font-mono text-[0.6875rem] tabular-nums transition-colors duration-200',
                      current ? 'text-primary' : 'text-muted-foreground/50',
                    )}
                  >
                    {String(index + 1).padStart(2, '0')}
                  </span>

                  <span
                    className={cn(
                      'motion-safe:transition-transform motion-safe:duration-200',
                      current ? 'translate-x-0.5' : 'group-hover:translate-x-0.5',
                    )}
                  >
                    {section.label}
                  </span>
                </a>
              </li>
            )
          })}
        </ul>
      </div>

      {/* The settings already carried who last touched them and when; nothing was showing
          it. It belongs here rather than repeated across five cards, since it is one fact
          about the page rather than one about any card on it. */}
      <div className="mt-6 border-t pt-4 pl-4">
        <p className="text-muted-foreground text-xs">{lastChange.label}</p>
        {lastChange.by ? <p className="mt-1 truncate text-sm font-medium">{lastChange.by}</p> : null}
        <p className="text-muted-foreground mt-0.5 text-xs tabular-nums">{lastChange.at}</p>
      </div>
    </nav>
  )
}
