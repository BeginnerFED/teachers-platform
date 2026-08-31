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
  const [active, setActive] = useState(sections[0]?.id ?? '')

  useEffect(() => {
    function sync() {
      // The last heading to have passed under the header is the one being read. Walking
      // the list rather than watching intersections keeps the final section reachable:
      // a short card at the bottom of the page may never cross the middle of the screen.
      let current = sections[0]?.id ?? ''

      for (const section of sections) {
        const element = document.getElementById(section.id)
        if (element && element.getBoundingClientRect().top <= HEADER_OFFSET) {
          current = section.id
        }
      }

      const scroller = document.scrollingElement ?? document.documentElement
      const atBottom = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 4
      if (atBottom) current = sections[sections.length - 1]?.id ?? current

      setActive(current)
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
      className="sticky top-20 hidden h-fit w-44 shrink-0 lg:block"
    >
      <ul className="border-border flex flex-col border-l">
        {sections.map((section) => (
          <li key={section.id} className="-ml-px">
            <a
              href={`#${section.id}`}
              onClick={(event) => go(event, section.id)}
              aria-current={active === section.id ? 'true' : undefined}
              className={cn(
                'text-muted-foreground hover:text-foreground block border-l-2 border-transparent py-1.5 pl-4 text-sm transition-colors',
                active === section.id && 'border-primary text-foreground font-medium',
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
