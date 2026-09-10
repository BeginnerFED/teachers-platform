'use client'

import type { LiveSelectionPart } from '@tp/shared'
import { SELECTION_PARTS_MAX } from '@tp/shared'
import { hashString } from '@/lib/random'

/**
 * How a piece of text is named across screens.
 *
 * Not by where its element sits in the page: the frame around a lesson — labels, buttons,
 * hints — is written in the reader's language, and a screen may draw a control another
 * screen does not, so counting elements or characters from the top of a block puts the
 * same words in two different places. The lesson's own words, on the other hand, read the
 * same everywhere. So an element is named by a fingerprint of the text it holds, and a
 * piece of a selection is an offset into that text.
 *
 * When the fingerprint matches nothing — because the selection ran over something one
 * screen has and another has not — nothing is drawn, which is the right way to be wrong.
 */

/** Elements that belong to one browser rather than to the lesson. */
const SKIP = '[data-live-skip]'

/** The elements of a block whose own text is exactly this. */
function matching(block: HTMLElement, key: number, len: number): HTMLElement[] {
  const found: HTMLElement[] = []

  for (const element of block.querySelectorAll<HTMLElement>('*')) {
    const text = element.textContent ?? ''
    if (text.length === len && hashString(text) === key) found.push(element)
  }

  return found
}

/** How much of an element's text comes before one of the nodes inside it. */
function textBefore(node: Node, element: HTMLElement): number {
  const range = document.createRange()
  range.selectNodeContents(element)
  range.setEnd(node, 0)

  return range.toString().length
}

/** Names an element by its text, or nothing if it holds none. */
export function anchorOf(
  block: HTMLElement,
  element: HTMLElement,
): Pick<LiveSelectionPart, 'key' | 'len' | 'nth'> | null {
  const text = element.textContent ?? ''
  if (text.length === 0) return null

  const key = hashString(text)
  const nth = matching(block, key, text.length).indexOf(element)

  return nth === -1 ? null : { key, len: text.length, nth }
}

/** Finds the element a piece of a selection was written against, if this screen has it. */
export function elementAt(
  block: HTMLElement,
  part: Pick<LiveSelectionPart, 'key' | 'len' | 'nth'>,
): HTMLElement | null {
  return matching(block, part.key, part.len)[part.nth] ?? null
}

/**
 * A selection, cut into one piece per element it runs through. A selection that runs from
 * a question into an answer is two pieces, each measured against its own text, so both
 * land where they belong on every screen.
 */
export function partsOf(range: Range, block: HTMLElement): LiveSelectionPart[] {
  const spans = new Map<HTMLElement, { start: number; end: number }>()
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT)

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent ?? ''
    const element = node.parentElement
    if (text.length === 0 || !element || element.closest(SKIP)) continue

    let inside: boolean
    try {
      // Wholly before the selection, or wholly after it, is no part of it.
      inside = range.comparePoint(node, 0) <= 0 && range.comparePoint(node, text.length) >= 0
    } catch {
      continue
    }
    if (!inside) continue

    const from = node === range.startContainer ? Math.min(range.startOffset, text.length) : 0
    const to = node === range.endContainer ? Math.min(range.endOffset, text.length) : text.length
    if (to <= from) continue

    const before = textBefore(node, element)
    const span = spans.get(element)
    if (span) {
      span.start = Math.min(span.start, before + from)
      span.end = Math.max(span.end, before + to)
    } else {
      spans.set(element, { start: before + from, end: before + to })
    }
  }

  const parts: LiveSelectionPart[] = []
  for (const [element, span] of spans) {
    const anchor = anchorOf(block, element)
    if (anchor) parts.push({ ...anchor, ...span })
    if (parts.length === SELECTION_PARTS_MAX) break
  }

  return parts
}
