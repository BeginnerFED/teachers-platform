'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

export type SettingsSection = { id: string; label: string }

/** Clears the sticky header, and matches the scroll-mt the sections carry. */
const HEADER_OFFSET = 96

/** What a letter is made of before you have reached it. */
const UNREACHED = 'color-mix(in oklab, var(--muted-foreground) 28%, transparent)'

/** Tall enough for the longest word this page has, with room above and below it. */
const WINDOW_HEIGHT = 384

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

/**
 * The section index, set as a column of letters beside the cards.
 *
 * A row of five words in a column of empty space was never going to earn that space.
 * Stacked a letter to a line the current section becomes a tall graphic mark rather than a
 * label, and it fills with the brand colour a letter at a time as its card passes under
 * the reading line — so how far through a section you are is legible from the word itself,
 * with no progress bar to say it separately. Crossing into the next section slides the
 * strip up and brings the following word in from below.
 *
 * Everything stays on one URL: these are anchors, a shortcut through the page rather than
 * navigation away from it.
 */
export function SettingsNav({
  sections,
  locale,
  footer,
}: {
  sections: SettingsSection[]
  /** Casing is language-specific — Turkish alone would turn "i" into the wrong letter. */
  locale: string
  /** Whatever is worth saying about the page as a whole. Optional, and page-specific. */
  footer?: ReactNode
}) {
  const [filled, setFilled] = useState<number[]>(() => sections.map(() => 0))
  const [current, setCurrent] = useState(0)
  const [offset, setOffset] = useState(0)

  const items = useRef<(HTMLLIElement | null)[]>([])
  const centers = useRef<number[]>([])

  const recenter = useCallback((index: number) => {
    const center = centers.current[index]
    if (center === undefined) return

    setOffset(WINDOW_HEIGHT / 2 - center)
  }, [])

  // Measured from the rendered elements rather than computed from letter counts, so a
  // font that loads late or a longer translation cannot leave the strip parked half a
  // word off. An effect rather than a layout effect: this component is server-rendered,
  // and the first placement arriving a frame late simply slides into position.
  useEffect(() => {
    function measure() {
      centers.current = items.current.map((item) =>
        item ? item.offsetTop + item.offsetHeight / 2 : 0,
      )
      recenter(current)
    }

    measure()

    const observer = new ResizeObserver(measure)
    for (const item of items.current) if (item) observer.observe(item)

    return () => observer.disconnect()
  }, [sections, current, recenter])

  useEffect(() => {
    let frame = 0

    function measure() {
      const progress = sections.map((section) => {
        const rect = document.getElementById(section.id)?.getBoundingClientRect()
        if (!rect || rect.height <= 0) return 0

        // How far the reading line has travelled through this card. Above it the word is
        // empty, below it full, and in between it fills at the rate you scroll.
        return clamp01((HEADER_OFFSET - rect.top) / rect.height)
      })

      setFilled(progress)

      // The sum runs 0 to n and only ever climbs, because the cards are stacked and each
      // one fills before the next begins. Its whole part is therefore the section being
      // read, with none of the tie-breaking that comparing edges would need.
      const total = progress.reduce((sum, value) => sum + value, 0)
      const index = Math.min(sections.length - 1, Math.max(0, Math.floor(total)))

      setCurrent(index)
      recenter(index)
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
  }, [sections, recenter])

  function go(event: React.MouseEvent<HTMLAnchorElement>, id: string) {
    const element = document.getElementById(id)
    if (!element) return

    event.preventDefault()

    // Neither the fill nor the slide needs an animation of its own: both follow the
    // scroll, and the scroll here is already smooth.
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
      className="sticky top-20 hidden h-fit w-32 shrink-0 xl:block"
    >
      <div
        className="relative overflow-hidden"
        style={{
          height: WINDOW_HEIGHT,
          // The words above and below the current one dissolve rather than being cut off,
          // which is what makes the strip read as continuing past the frame.
          maskImage: 'linear-gradient(to bottom, transparent, black 20%, black 80%, transparent)',
          WebkitMaskImage:
            'linear-gradient(to bottom, transparent, black 20%, black 80%, transparent)',
        }}
      >
        <ul
          className="absolute inset-x-0 top-0 flex flex-col items-center gap-12 will-change-transform motion-safe:transition-transform motion-safe:duration-500 motion-safe:ease-out"
          style={{ transform: `translateY(${offset}px)` }}
        >
          {sections.map((section, index) => (
            <li
              key={section.id}
              ref={(node) => {
                items.current[index] = node
              }}
            >
              <a href={`#${section.id}`} onClick={(event) => go(event, section.id)} className="block">
                {/* The letters are decoration; the word is what gets announced. Read out
                    one character at a time it would be nonsense. */}
                <span className="sr-only">{section.label}</span>

                <span
                  aria-hidden
                  className="flex w-8 flex-col items-center text-lg leading-[1.25] font-semibold"
                  style={{
                    // Two flat halves of a gradient twice the height of the word, slid up
                    // as the section fills. Written this way rather than by moving the
                    // colour stops because a background position can be transitioned and a
                    // gradient stop cannot -- and because it is one paint either way.
                    backgroundImage: `linear-gradient(to bottom, var(--primary) 0 50%, ${UNREACHED} 50% 100%)`,
                    backgroundSize: '100% 200%',
                    backgroundPositionY: `${(1 - (filled[index] ?? 0)) * 100}%`,
                    WebkitBackgroundClip: 'text',
                    backgroundClip: 'text',
                    color: 'transparent',
                  }}
                >
                  {Array.from(section.label.toLocaleUpperCase(locale)).map((letter, position) => (
                    <span key={position}>{letter}</span>
                  ))}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>

      {footer ? <div className="mt-6 border-t pt-4">{footer}</div> : null}
    </nav>
  )
}
