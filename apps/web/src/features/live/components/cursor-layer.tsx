'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { MousePointer2Icon } from 'lucide-react'
import type { RemoteCursor } from '../use-live-room'
import { colorFor } from './presence-overlay'

/**
 * Ahead of the paint in the browser, and out of the way on the server, which has no
 * layout to be ahead of and says as much if you ask it for one.
 */
const useBeforePaint = typeof window === 'undefined' ? useEffect : useLayoutEffect

/**
 * Everyone else's pointer, over the lesson, in their colour.
 *
 * A pointer moves ten or twenty times a second per person. The board those people share
 * is held at the top of this page, so putting pointers in it too would re-render the
 * whole lesson a hundred times a second in a room of six — while nobody types. So React
 * draws one arrow per person and nothing more: where each arrow is gets written straight
 * to its element as the messages land, and the page above it never hears about it.
 */
export function CursorLayer({
  watch,
  stepId,
}: {
  /** Hear about every pointer in the room, and stop hearing when this goes away. */
  watch: (listener: (cursors: Map<string, RemoteCursor>) => void) => () => void
  stepId: string
}) {
  // Who has a pointer at all — which changes when somebody joins, leaves or stops moving,
  // and not while they move.
  const [people, setPeople] = useState<{ id: string; name: string }[]>([])
  const arrows = useRef(new Map<string, HTMLDivElement>())
  const cursors = useRef<Map<string, RemoteCursor>>(new Map())
  const step = useRef(stepId)

  const place = useCallback(() => {
    for (const [id, arrow] of arrows.current) {
      const cursor = cursors.current.get(id)

      // Placed even while hidden, so an arrow shown again is already where its person is
      // rather than gliding there from wherever it was last seen.
      if (cursor) {
        arrow.style.left = `${cursor.x * 100}%`
        arrow.style.top = `${cursor.y * 100}%`
      }

      arrow.style.visibility = cursor && cursor.stepId === step.current ? 'visible' : 'hidden'
    }
  }, [])

  // A pointer belongs to the page somebody is on; on another page it is not drawn. Before
  // the browser paints, not after: the arrows are placed from the ref callbacks during the
  // same commit that turns the page, and a step read a moment too late leaves somebody
  // else's pointer over a page they are not on for a frame.
  useBeforePaint(() => {
    step.current = stepId
    place()
  }, [stepId, place])

  useEffect(
    () =>
      watch((next) => {
        cursors.current = next
        const now = [...next.values()].map((cursor) => ({ id: cursor.id, name: cursor.name }))

        setPeople((current) =>
          current.length === now.length &&
          current.every((person, index) => person.id === now[index]?.id)
            ? current
            : now,
        )
        place()
      }),
    [watch, place],
  )

  // An arrow React has only just made has nowhere to be until it is placed.
  useEffect(place, [people, place])

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {people.map((person) => {
        const color = colorFor(person.id)

        return (
          <div
            key={person.id}
            ref={(element) => {
              if (element) arrows.current.set(person.id, element)
              else arrows.current.delete(person.id)
              place()
            }}
            className="invisible absolute transition-[left,top] duration-100 ease-linear will-change-[left,top]"
          >
            <MousePointer2Icon
              className="size-4 -rotate-12 drop-shadow-sm"
              style={{ color, fill: color }}
            />
            <span
              className="ml-3 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium text-white shadow-sm"
              style={{ backgroundColor: color }}
            >
              {person.name}
            </span>
          </div>
        )
      })}
    </div>
  )
}
