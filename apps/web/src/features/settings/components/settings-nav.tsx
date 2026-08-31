'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

export type SettingsSection = { id: string; label: string }

/** Clears the sticky header, and matches the scroll-mt the sections carry. */
const HEADER_OFFSET = 96

/**
 * A rail beside the cards rather than a second set of pages.
 *
 * The space to the left of a reading column has to be worth something or it reads as a
 * mistake, and on a page of five sections the useful thing to put there is a way to reach
 * the fifth one without scrolling past four. Everything stays on one URL — this is a
 * shortcut through the page, not navigation away from it.
 *
 * Deliberately quieter than the app sidebar's active row: two highlights competing in the
 * same brand tint would each make the other harder to find.
 */
export function SettingsNav({ sections }: { sections: SettingsSection[] }) {
  const [active, setActive] = useState<string[]>([])

  useEffect(() => {
    function sync() {
      const boxes = sections
        .map((section) => ({
          id: section.id,
          rect: document.getElementById(section.id)?.getBoundingClientRect(),
        }))
        .filter((box): box is { id: string; rect: DOMRect } => Boolean(box.rect))

      // Once the cards pair off two to a row, "which section am I in" stops having one
      // answer: two of them start at the same height and end at roughly the same one. So
      // the rail marks the row rather than picking a winner — otherwise the card that
      // happened to come second in the markup could never be current at all.
      const crossing = boxes.filter(
        (box) => box.rect.top <= HEADER_OFFSET && box.rect.bottom > HEADER_OFFSET,
      )

      if (crossing.length > 0) {
        setActive(crossing.map((box) => box.id))
        return
      }

      // Nothing under the line: either above the first card, or past a last one too short
      // to reach it. Fall back to the row that most recently went by, ties included, which
      // is also what keeps the final section reachable on a page barely taller than the
      // window.
      const passed = boxes.filter((box) => box.rect.top <= HEADER_OFFSET)
      const line = passed.length > 0 ? Math.max(...passed.map((box) => box.rect.top)) : null

      setActive(
        line === null
          ? boxes.filter((box) => Math.abs(box.rect.top - boxes[0].rect.top) < 4).map((b) => b.id)
          : passed.filter((box) => Math.abs(box.rect.top - line) < 4).map((box) => box.id),
      )
    }

    sync()

    // Captured on the document, because scroll does not bubble and the page may end up
    // scrolling an inner element rather than the window.
    document.addEventListener('scroll', sync, { capture: true, passive: true })
    window.addEventListener('resize', sync, { passive: true })

    return () => {
      document.removeEventListener('scroll', sync, { capture: true })
      window.removeEventListener('resize', sync)
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
    <nav
      aria-label={sections[0]?.label}
      className="sticky top-20 hidden h-fit w-40 shrink-0 lg:block"
    >
      {/* The padding lines the first entry up with the title of the first card rather than
          with the top edge of its box. */}
      <ul className="border-border flex flex-col border-l pt-3.5">
        {sections.map((section) => (
          <li key={section.id} className="-ml-px">
            <a
              href={`#${section.id}`}
              onClick={(event) => go(event, section.id)}
              aria-current={active.includes(section.id) ? 'true' : undefined}
              className={cn(
                'text-muted-foreground hover:text-foreground block border-l-2 border-transparent py-1.5 pl-4 text-sm transition-colors',
                active.includes(section.id) && 'border-primary text-foreground font-medium',
              )}
            >
              {section.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
