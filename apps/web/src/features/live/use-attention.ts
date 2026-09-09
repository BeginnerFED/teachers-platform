'use client'

import { useEffect, useRef, type RefObject } from 'react'
import type { LiveFocus, LiveSelection } from '@tp/shared'

/** The controls in a block, in the order they appear — how a box is named across screens. */
export const UNIT_SELECTOR = 'input, textarea, [role="radio"], [role="checkbox"], button'

/** How often "still typing" is said. */
const TYPING_EVERY_MS = 700

/** The element a node is, or sits in. */
const elementOf = (node: Node | null): HTMLElement | null =>
  node instanceof HTMLElement ? node : (node?.parentElement ?? null)

/** The block an element sits in, if it sits in one inside the lesson. */
export function blockOf(node: Node | null, surface: HTMLElement): HTMLElement | null {
  const element = node instanceof HTMLElement ? node : node?.parentElement
  const block = element?.closest<HTMLElement>('[data-block-id]') ?? null

  return block && surface.contains(block) ? block : null
}

/**
 * Where this person's attention is, told to the room: the text they select, the box they
 * are in, the block they touched, and whether they are typing. Everything is expressed
 * against the block's DOM — text offsets, control order — because every screen draws the
 * same block, so the same words mean the same place everywhere.
 */
export function useAttention(
  surface: RefObject<HTMLElement | null>,
  stepId: string,
  send: {
    selection: (selection: LiveSelection | null) => void
    focus: (focus: LiveFocus | null) => void
  },
) {
  const latest = useRef({ stepId, send })
  useEffect(() => {
    latest.current = { stepId, send }
  }, [stepId, send])

  // What was last said, so that turning the page — which fires no blur for a box that
  // simply unmounts — still takes the focus and the selection down.
  const said = useRef({ focus: false, selection: false })
  useEffect(() => {
    const { send: tell } = latest.current
    if (said.current.focus) {
      said.current.focus = false
      tell.focus(null)
    }
    if (said.current.selection) {
      said.current.selection = false
      tell.selection(null)
    }
  }, [stepId])

  useEffect(() => {
    const root = surface.current
    if (!root) return

    let typingSaidAt = 0

    const onSelection = () => {
      const { stepId: step, send: tell } = latest.current
      const selection = document.getSelection()
      const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null

      if (!selection || !range || selection.isCollapsed) {
        if (said.current.selection) tell.selection(null)
        said.current.selection = false
        return
      }

      const block = blockOf(range.startContainer, root)
      // A selection across blocks is nobody's business; one inside a block is shown.
      if (!block || block !== blockOf(range.endContainer, root)) {
        if (said.current.selection) tell.selection(null)
        said.current.selection = false
        return
      }

      // Measured inside the smallest element holding the whole selection — a paragraph,
      // usually — so the block's labels and buttons, which read differently in another
      // language, do not shift the count.
      const common = elementOf(range.commonAncestorContainer)
      const holder = common && block.contains(common) ? common : block
      const element = holder === block ? -1 : [...block.querySelectorAll('*')].indexOf(holder)
      const before = document.createRange()
      before.selectNodeContents(holder)
      before.setEnd(range.startContainer, range.startOffset)
      const start = before.toString().length
      const end = start + range.toString().length
      if (end === start) return

      said.current.selection = true
      tell.selection({ stepId: step, blockId: block.dataset.blockId ?? '', element, start, end })
    }

    const unitOf = (target: EventTarget | null, block: HTMLElement) => {
      if (!(target instanceof Element)) return null
      const control = target.closest(UNIT_SELECTOR)
      if (!control) return null
      const index = [...block.querySelectorAll(UNIT_SELECTOR)].indexOf(control)

      return index === -1 ? null : index
    }

    const onFocusIn = (event: FocusEvent) => {
      const { stepId: step, send: tell } = latest.current
      const block = blockOf(event.target as Node, root)
      if (!block) return

      said.current.focus = true
      tell.focus({
        stepId: step,
        blockId: block.dataset.blockId ?? '',
        unit: unitOf(event.target, block),
        kind: 'focus',
      })
    }

    const onFocusOut = (event: FocusEvent) => {
      // Moving between boxes sends the next focus; leaving the lesson sends nothing.
      if (event.relatedTarget && root.contains(event.relatedTarget as Node)) return
      said.current.focus = false
      latest.current.send.focus(null)
    }

    const onPointerDown = (event: PointerEvent) => {
      const { stepId: step, send: tell } = latest.current
      const block = blockOf(event.target as Node, root)
      if (!block) return
      // A box that is about to take focus says so itself, with more precision.
      if (event.target instanceof Element && event.target.closest(UNIT_SELECTOR)) return

      said.current.focus = true
      tell.focus({ stepId: step, blockId: block.dataset.blockId ?? '', unit: null, kind: 'touch' })
    }

    const onInput = (event: Event) => {
      const now = Date.now()
      if (now - typingSaidAt < TYPING_EVERY_MS) return
      const { stepId: step, send: tell } = latest.current
      const block = blockOf(event.target as Node, root)
      if (!block) return

      typingSaidAt = now
      tell.focus({
        stepId: step,
        blockId: block.dataset.blockId ?? '',
        unit: unitOf(event.target, block),
        kind: 'typing',
      })
    }

    document.addEventListener('selectionchange', onSelection)
    root.addEventListener('focusin', onFocusIn)
    root.addEventListener('focusout', onFocusOut)
    root.addEventListener('pointerdown', onPointerDown)
    root.addEventListener('input', onInput)

    return () => {
      document.removeEventListener('selectionchange', onSelection)
      root.removeEventListener('focusin', onFocusIn)
      root.removeEventListener('focusout', onFocusOut)
      root.removeEventListener('pointerdown', onPointerDown)
      root.removeEventListener('input', onInput)
    }
  }, [surface])
}
