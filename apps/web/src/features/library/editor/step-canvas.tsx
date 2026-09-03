'use client'

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useEffect, useRef, useState } from 'react'
import { GripVerticalIcon, TriangleAlertIcon, Undo2Icon } from 'lucide-react'
import { isCompleteBlock, type BlockDraft, type BlockType, type MaterialStep } from '@tp/shared'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { Messages } from '@/messages'
import { newBlockDraft, uid } from './block-defaults'
import { BlockEditor } from './block-editor'
import { BlockFrame } from './block-frame'
import { BlockPalette } from './block-palette'
import type { SaveStatus } from './use-autosave'

const HISTORY_LIMIT = 40
/** Keystrokes closer together than this are one edit to undo, not forty. */
const TYPING_BURST_MS = 1500

/**
 * One step: its title, its blocks in order, and the palette to add another. What you
 * build here is what a student gets, block for block, top to bottom.
 *
 * Blocks are dragged by their handle and nowhere else. A pointer that goes down on an
 * input is typing, not dragging, and the distance constraint on the sensor is the second
 * guard: a click that does not travel is a click.
 *
 * Undo keeps snapshots of the block list: one per structural change, and one per burst of
 * typing. Inside a field the browser's own undo applies; ours takes over the moment the
 * cursor leaves it — "put back the block I just deleted" is what people reach for.
 */
export function StepCanvas({
  step,
  status,
  otherSteps,
  onChange,
  onMoveBlock,
  t,
}: {
  step: MaterialStep
  status: SaveStatus
  /** The lesson's other steps, as places a block can be moved to. */
  otherSteps: { id: string; title: string | null }[]
  onChange: (patch: { title?: string | null; blocks?: BlockDraft[] }) => void
  onMoveBlock: (blockId: string, toStepId: string) => void
  t: Messages
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const blocks = step.blocks

  const history = useRef<BlockDraft[][]>([])
  // A burst of typing is open from its first keystroke until a pause; the snapshot is
  // taken at the first keystroke only. A timer, not a clock read: the lint for pure
  // rendering cannot tell an event handler from render, and it does not need to.
  const burstOpen = useRef(false)
  const burstTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [canUndo, setCanUndo] = useState(false)

  useEffect(() => () => clearTimeout(burstTimer.current ?? undefined), [])

  const record = (snapshot: BlockDraft[]) => {
    history.current = [...history.current.slice(-(HISTORY_LIMIT - 1)), snapshot]
    setCanUndo(true)
  }

  const closeBurst = () => {
    burstOpen.current = false
    clearTimeout(burstTimer.current ?? undefined)
  }

  /** A structural change: always its own undo step. */
  const commit = (next: BlockDraft[]) => {
    record(blocks)
    closeBurst()
    onChange({ blocks: next })
  }

  /** A field edit: one undo step per burst of typing. */
  const patchBlock = (id: string, patch: Record<string, unknown>) => {
    if (!burstOpen.current) {
      record(blocks)
      burstOpen.current = true
    }

    clearTimeout(burstTimer.current ?? undefined)
    burstTimer.current = setTimeout(() => {
      burstOpen.current = false
    }, TYPING_BURST_MS)

    onChange({ blocks: blocks.map((block) => (block.id === id ? { ...block, ...patch } : block)) })
  }

  const undo = () => {
    const previous = history.current.pop()
    setCanUndo(history.current.length > 0)
    closeBurst()
    if (previous) onChange({ blocks: previous })
  }

  // Ctrl/Cmd+Z anywhere on the page that is not a text field. Inside one, the browser's
  // own undo is the right undo.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.shiftKey || event.key.toLowerCase() !== 'z')
        return

      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, [contenteditable="true"]')) return

      event.preventDefault()
      undo()
    }

    window.addEventListener('keydown', onKey)

    return () => window.removeEventListener('keydown', onKey)
  })

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return

    const from = blocks.findIndex((block) => block.id === active.id)
    const to = blocks.findIndex((block) => block.id === over.id)
    if (from === -1 || to === -1) return

    commit(arrayMove(blocks, from, to))
  }

  const add = (type: BlockType) => commit([...blocks, newBlockDraft(type)])

  const duplicate = (block: BlockDraft) => {
    // A deep copy under a new id. The ids inside — options, pairs, gaps — only have to be
    // unique within their block, so they travel unchanged.
    const copy = { ...structuredClone(block), id: uid() }
    const at = blocks.findIndex((b) => b.id === block.id)

    commit([...blocks.slice(0, at + 1), copy, ...blocks.slice(at + 1)])
  }

  return (
    // As wide as the player draws a step, and no wider: what is built here at this width
    // is what the student gets at this width.
    <div className="flex w-full min-w-0 max-w-3xl flex-col gap-5">
      <div className="flex items-center gap-3">
        <input
          value={step.title ?? ''}
          onChange={(event) => onChange({ title: event.target.value || null })}
          placeholder={t.library.editor.stepTitlePlaceholder}
          aria-label={t.library.editor.stepTitlePlaceholder}
          maxLength={200}
          className="hover:bg-muted/50 focus:bg-muted/50 focus:ring-ring/40 -mx-2 min-w-0 flex-1 rounded-md px-2 py-1 text-lg font-medium outline-none transition-colors focus:ring-2"
        />

        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!canUndo}
          onClick={undo}
          title={`${t.library.editor.undo} (Ctrl+Z)`}
          className="text-muted-foreground h-7 gap-1.5 px-2 text-xs"
        >
          <Undo2Icon className="size-3.5" />
          {t.library.editor.undo}
        </Button>

        <SaveIndicator status={status} t={t} />
      </div>

      {status === 'conflict' ? (
        <div className="border-destructive/40 bg-destructive/5 text-destructive flex items-start gap-2 rounded-md border p-3 text-sm">
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
          {t.library.editor.status.conflict}
        </div>
      ) : null}

      {blocks.length === 0 ? (
        // The palette is the empty page's only content. A message that says "add a block"
        // above a button that says "add a block" is the same thing said twice.
        <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed px-6 py-12 text-center">
          <p className="text-muted-foreground text-sm">{t.library.editor.emptyCanvas}</p>
          <BlockPalette onPick={add} t={t} />
        </div>
      ) : (
        <DndContext
          id={`blocks-${step.id}`}
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={blocks.map((block) => block.id)}
            strategy={verticalListSortingStrategy}
          >
            {/* The player's own spacing between blocks, plus a gutter on the left for the
                drag handle to live in without pushing the content out of line. */}
            <div className="flex flex-col gap-5 pl-6">
              {blocks.map((block) => (
                <SortableBlock
                  key={block.id}
                  block={block}
                  moveTargets={otherSteps}
                  onChange={(patch) => patchBlock(block.id, patch)}
                  onDelete={() => commit(blocks.filter((b) => b.id !== block.id))}
                  onDuplicate={() => duplicate(block)}
                  onMove={(stepId) => {
                    record(blocks)
                    onMoveBlock(block.id, stepId)
                  }}
                  t={t}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {blocks.length > 0 ? (
        <div>
          <BlockPalette onPick={add} t={t} />
        </div>
      ) : null}
    </div>
  )
}

function SortableBlock({
  block,
  moveTargets,
  onChange,
  onDelete,
  onDuplicate,
  onMove,
  t,
}: {
  block: BlockDraft
  moveTargets: { id: string; title: string | null }[]
  onChange: (patch: Record<string, unknown>) => void
  onDelete: () => void
  onDuplicate: () => void
  onMove: (stepId: string) => void
  t: Messages
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && 'relative z-10 opacity-80 shadow-lg')}
    >
      <BlockFrame
        draft={block}
        complete={isCompleteBlock(block)}
        moveTargets={moveTargets}
        onDelete={onDelete}
        onDuplicate={onDuplicate}
        onMove={onMove}
        onPoints={(points) => onChange({ points })}
        t={t}
        handle={
          // In the margin, out of the content's way, and only there when the block is
          // hovered — the way a document editor shows its handle, not a form's.
          <button
            type="button"
            ref={setActivatorNodeRef}
            aria-label={t.library.editor.dragHandle}
            {...attributes}
            {...listeners}
            className="text-muted-foreground hover:text-foreground absolute -left-4 top-2.5 cursor-grab touch-none rounded p-1 opacity-0 transition-opacity focus-visible:opacity-100 active:cursor-grabbing group-hover/block:opacity-100 max-sm:opacity-100"
          >
            <GripVerticalIcon className="size-4" />
          </button>
        }
      >
        <BlockEditor draft={block} onChange={onChange} t={t} />
      </BlockFrame>
    </div>
  )
}

/**
 * The canvas while the step it should show is not there yet — being created, or being
 * deleted with another about to take its place. Shaped like a page with three blocks on
 * it, so the swap does not move anything around.
 */
export function StepCanvasSkeleton() {
  return (
    <div className="flex min-w-0 flex-col gap-4" aria-busy>
      <div className="flex items-center gap-3">
        <Skeleton className="h-7 w-56" />
      </div>

      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="rounded-lg border">
            <div className="flex h-9 items-center gap-2 px-2">
              <Skeleton className="size-4" />
              <Skeleton className="h-3 w-20" />
            </div>
            <div className="flex flex-col gap-2 px-3 pb-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-2/3" />
            </div>
          </div>
        ))}
      </div>

      <Skeleton className="h-8 w-28" />
    </div>
  )
}

function SaveIndicator({ status, t }: { status: SaveStatus; t: Messages }) {
  if (status === 'idle') return null

  const label = {
    saving: t.library.editor.status.saving,
    saved: t.library.editor.status.saved,
    failed: t.library.editor.status.failed,
    conflict: t.library.editor.status.failed,
  }[status]

  return (
    <span
      className={cn(
        'shrink-0 text-xs tabular-nums transition-colors',
        status === 'failed' || status === 'conflict' ? 'text-destructive' : 'text-muted-foreground',
      )}
      aria-live="polite"
    >
      {label}
    </span>
  )
}
