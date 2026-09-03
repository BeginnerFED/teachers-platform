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
import { GripVerticalIcon, TriangleAlertIcon } from 'lucide-react'
import { isCompleteBlock, type BlockDraft, type BlockType, type MaterialStep } from '@tp/shared'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { Messages } from '@/messages'
import { newBlockDraft } from './block-defaults'
import { BlockEditor } from './block-editor'
import { BlockFrame } from './block-frame'
import { BlockPalette } from './block-palette'
import type { SaveStatus } from './use-autosave'

/**
 * One step: its title, its blocks in order, and the palette to add another. What you
 * build here is what a student gets, block for block, top to bottom.
 *
 * Blocks are dragged by their handle and nowhere else. A pointer that goes down on an
 * input is typing, not dragging, and the distance constraint on the sensor is the second
 * guard: a click that does not travel is a click.
 */
export function StepCanvas({
  step,
  status,
  onChange,
  t,
}: {
  step: MaterialStep
  status: SaveStatus
  onChange: (patch: { title?: string | null; blocks?: BlockDraft[] }) => void
  t: Messages
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const blocks = step.blocks

  const setBlocks = (next: BlockDraft[]) => onChange({ blocks: next })

  const patchBlock = (id: string, patch: Record<string, unknown>) =>
    setBlocks(blocks.map((block) => (block.id === id ? { ...block, ...patch } : block)))

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return

    const from = blocks.findIndex((block) => block.id === active.id)
    const to = blocks.findIndex((block) => block.id === over.id)
    if (from === -1 || to === -1) return

    setBlocks(arrayMove(blocks, from, to))
  }

  const add = (type: BlockType) => setBlocks([...blocks, newBlockDraft(type)])

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
                  onChange={(patch) => patchBlock(block.id, patch)}
                  onDelete={() => setBlocks(blocks.filter((b) => b.id !== block.id))}
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
  onChange,
  onDelete,
  t,
}: {
  block: BlockDraft
  onChange: (patch: Record<string, unknown>) => void
  onDelete: () => void
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
        onDelete={onDelete}
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
