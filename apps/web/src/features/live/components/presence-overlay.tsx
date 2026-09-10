'use client'

import { useEffect, useRef, type RefObject } from 'react'
import type { LivePresence } from '@tp/shared'
import { elementAt } from '../anchor'
import { unitsOf } from '../use-attention'
import type { RemoteFocus, RemoteSelection } from '../use-live-room'

/** Eight colours that tell people apart and stay legible on white; one per person, by id. */
export const PALETTE = [
  '#f97316',
  '#0ea5e9',
  '#22c55e',
  '#a855f7',
  '#ec4899',
  '#eab308',
  '#14b8a6',
  '#ef4444',
]

export function paletteIndex(id: string): number {
  let hash = 0
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return hash % PALETTE.length
}

export function colorFor(id: string): string {
  return PALETTE[paletteIndex(id)] ?? PALETTE[0]!
}

/** Somebody who has typed this recently is typing. */
const TYPING_MS = 1_500

/** The text node and offset that a character offset into an element lands on. */
function place(root: HTMLElement, offset: number): { node: Node; offset: number } | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let remaining = offset
  let node = walker.nextNode()
  let last: Node | null = null

  while (node) {
    const length = node.textContent?.length ?? 0
    if (remaining <= length) return { node, offset: remaining }
    remaining -= length
    last = node
    node = walker.nextNode()
  }

  return last ? { node: last, offset: last.textContent?.length ?? 0 } : null
}

/** Whether this browser can paint a selection made elsewhere. */
const canHighlight = () =>
  typeof CSS !== 'undefined' && 'highlights' in CSS && typeof Highlight !== 'undefined'

/**
 * The others over the lesson: what they have selected, painted in their colour with the
 * browser's own highlight registry; the box or block they are in, outlined in their
 * colour with their name on it. All of it is measured against the lesson's DOM and drawn
 * by hand, outside React's render — these are annotations on the page, not the page.
 */
export function PresenceOverlay({
  surface,
  stepId,
  people,
  selections,
  focuses,
  meId,
  typingLabel,
}: {
  surface: RefObject<HTMLElement | null>
  stepId: string
  people: Record<string, LivePresence>
  selections: Record<string, RemoteSelection>
  focuses: Record<string, RemoteFocus>
  meId: string
  typingLabel: string
}) {
  const layer = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = surface.current
    const overlay = layer.current
    if (!root || !overlay) return

    const draw = () => {
      const bounds = root.getBoundingClientRect()
      overlay.replaceChildren()

      /* ------------------------------------------------------------ selections --- */
      if (canHighlight()) {
        for (const name of [...CSS.highlights.keys()]) {
          if (name.startsWith('live-')) CSS.highlights.delete(name)
        }
      }

      for (const selection of Object.values(selections)) {
        if (selection.id === meId || selection.stepId !== stepId) continue
        const block = root.querySelector<HTMLElement>(
          `[data-block-id="${CSS.escape(selection.blockId)}"]`,
        )
        if (!block) continue

        // A piece the words of which this screen does not have is not drawn: better a
        // selection missing than one over the wrong words.
        let last: DOMRect | undefined
        for (const part of selection.parts) {
          const holder = elementAt(block, part)
          if (!holder) continue

          const from = place(holder, part.start)
          const to = place(holder, part.end)
          if (!from || !to) continue

          const range = document.createRange()
          try {
            range.setStart(from.node, from.offset)
            range.setEnd(to.node, to.offset)
          } catch {
            continue
          }

          if (canHighlight()) {
            const name = `live-${paletteIndex(selection.id)}`
            const highlight = CSS.highlights.get(name) ?? new Highlight()
            highlight.add(range)
            CSS.highlights.set(name, highlight)
          }

          const rects = range.getClientRects()
          last = rects[rects.length - 1] ?? last
        }

        // The name, at the end of what they selected.
        const person = people[selection.id]
        if (last && person) {
          overlay.appendChild(
            tag(
              person.name,
              colorFor(selection.id),
              last.right - bounds.left,
              last.top - bounds.top,
            ),
          )
        }
      }

      /* --------------------------------------------------------------- focuses --- */
      const now = Date.now()
      for (const focus of Object.values(focuses)) {
        if (focus.id === meId || focus.stepId !== stepId) continue
        const block = root.querySelector<HTMLElement>(
          `[data-block-id="${CSS.escape(focus.blockId)}"]`,
        )
        if (!block) continue

        const target = focus.unit === null ? block : (unitsOf(block)[focus.unit] ?? block)
        const rect = target.getBoundingClientRect()
        const person = people[focus.id]
        if (!person) continue

        const color = colorFor(focus.id)
        const typing = focus.typingAt !== undefined && now - focus.typingAt < TYPING_MS
        const box = document.createElement('div')
        box.className = 'absolute rounded-md transition-opacity'
        box.style.left = `${rect.left - bounds.left - 3}px`
        box.style.top = `${rect.top - bounds.top - 3}px`
        box.style.width = `${rect.width + 6}px`
        box.style.height = `${rect.height + 6}px`
        box.style.border = `2px solid ${color}`
        box.style.opacity = focus.kind === 'touch' ? '0.6' : '1'
        overlay.appendChild(box)
        overlay.appendChild(
          tag(
            typing ? `${person.name} ${typingLabel}` : person.name,
            color,
            rect.right - bounds.left,
            rect.top - bounds.top - 3,
            'end',
          ),
        )
      }
    }

    draw()
    const observer = new ResizeObserver(draw)
    observer.observe(root)
    window.addEventListener('resize', draw)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', draw)
      overlay.replaceChildren()
      if (canHighlight()) {
        for (const name of [...CSS.highlights.keys()]) {
          if (name.startsWith('live-')) CSS.highlights.delete(name)
        }
      }
    }
  }, [surface, stepId, people, selections, focuses, meId, typingLabel])

  return (
    <div
      ref={layer}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-10 overflow-visible"
    />
  )
}

/** A name in a coloured pill, its corner at a point. */
function tag(text: string, color: string, x: number, y: number, align: 'start' | 'end' = 'start') {
  const element = document.createElement('span')
  element.textContent = text
  element.className =
    'absolute inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium text-white shadow-sm'
  element.style.backgroundColor = color
  element.style.top = `${y - 22}px`
  element.style.left = `${x}px`
  // Hung from its right edge when it sits at the end of something.
  if (align === 'end') element.style.transform = 'translateX(-100%)'

  return element
}
