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
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useState } from 'react'
import { GripVerticalIcon, Loader2Icon, PlusIcon, Trash2Icon } from 'lucide-react'
import { estimateMinutes, type MaterialStep } from '@tp/shared'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { Messages } from '@/messages'

/**
 * The lesson's spine: every step in order, the one being edited marked, and a way to add
 * the next. Dragging reorders; the canvas beside it shows whichever is selected.
 *
 * Nothing here happens silently. A step being deleted fades and shows a spinner where its
 * bin was, and stays put until the server agrees it is gone; a step being added appears
 * first as a grey placeholder at the end of the list. Feedback sits on the row it is about.
 */
export function StepList({
  materialId,
  steps,
  selectedId,
  adding,
  removingIds,
  onSelect,
  onAdd,
  onDelete,
  onReorder,
  t,
}: {
  materialId: string
  steps: MaterialStep[]
  selectedId: string | null
  adding: boolean
  removingIds: ReadonlySet<string>
  onSelect: (id: string) => void
  onAdd: () => void
  onDelete: (id: string) => void
  onReorder: (from: number, to: number) => void
  t: Messages
}) {
  const [confirming, setConfirming] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return

    const from = steps.findIndex((step) => step.id === active.id)
    const to = steps.findIndex((step) => step.id === over.id)
    if (from !== -1 && to !== -1) onReorder(from, to)
  }

  return (
    <aside className="flex flex-col gap-2">
      <p className="text-muted-foreground px-1 text-[11px] font-medium uppercase tracking-wide">
        {t.library.editor.steps}
      </p>

      <DndContext
        id={`steps-${materialId}`}
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis]}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={steps.map((step) => step.id)}
          strategy={verticalListSortingStrategy}
        >
          <ol className="flex flex-col gap-1">
            {steps.map((step, index) => (
              <SortableStep
                key={step.id}
                step={step}
                index={index}
                selected={step.id === selectedId}
                removing={removingIds.has(step.id)}
                onSelect={() => onSelect(step.id)}
                onDelete={() => setConfirming(step.id)}
                t={t}
              />
            ))}

            {/* The step that is on its way. Where it will land, at the size it will be. */}
            {adding ? (
              <li className="flex items-center gap-2 px-2 py-1.5" aria-busy>
                <Skeleton className="size-3.5 rounded-sm" />
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 flex-1" />
              </li>
            ) : null}
          </ol>
        </SortableContext>
      </DndContext>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={adding}
        onClick={onAdd}
        className="justify-start gap-2"
      >
        {adding ? <Loader2Icon className="size-4 animate-spin" /> : <PlusIcon className="size-4" />}
        {t.library.editor.addStep}
      </Button>

      {/* Live, from what is on the canvas right now — the same estimate the card shows,
          computed by the same function, so the two never disagree. */}
      <p className="text-muted-foreground px-2 pt-1 text-xs tabular-nums">
        {t.library.editor.duration}: ≈ {estimateMinutes(steps)} {t.library.card.minutes}
      </p>

      <AlertDialog open={confirming !== null} onOpenChange={(open) => !open && setConfirming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.library.editor.confirmDeleteStep.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.library.editor.confirmDeleteStep.body}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.library.editor.confirmDeleteStep.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirming) onDelete(confirming)
                setConfirming(null)
              }}
            >
              {t.library.editor.confirmDeleteStep.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  )
}

function SortableStep({
  step,
  index,
  selected,
  removing,
  onSelect,
  onDelete,
  t,
}: {
  step: MaterialStep
  index: number
  selected: boolean
  /** Deletion is in flight. The row stays, faded, until the server says it is gone. */
  removing: boolean
  onSelect: () => void
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
  } = useSortable({ id: step.id, disabled: removing })

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      aria-busy={removing || undefined}
      className={cn(
        'group/step flex items-center gap-1 rounded-md pr-1 transition-[background-color,color,opacity]',
        selected ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/60',
        isDragging && 'relative z-10 shadow-md',
        removing && 'pointer-events-none opacity-40',
      )}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        aria-label={t.library.editor.dragHandle}
        disabled={removing}
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none p-1.5 opacity-0 focus-visible:opacity-100 active:cursor-grabbing group-hover/step:opacity-100 max-sm:opacity-100"
      >
        <GripVerticalIcon className="size-3.5" />
      </button>

      <button
        type="button"
        onClick={onSelect}
        disabled={removing}
        className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left text-sm"
      >
        <span className="w-4 shrink-0 text-xs tabular-nums opacity-60">{index + 1}</span>
        <span className={cn('truncate', !step.title && 'italic opacity-60')}>
          {step.title || t.library.detail.untitledStep}
        </span>
      </button>

      {/* The spinner replaces the bin rather than appearing beside it: the thing you
          clicked is the thing that is now working. */}
      {removing ? (
        <span className="flex size-6 shrink-0 items-center justify-center">
          <Loader2Icon className="size-3.5 animate-spin" />
        </span>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t.library.editor.deleteStep}
          onClick={onDelete}
          className="hover:text-destructive size-6 shrink-0 opacity-0 focus-visible:opacity-100 group-hover/step:opacity-100 max-sm:opacity-100"
        >
          <Trash2Icon className="size-3.5" />
        </Button>
      )}
    </li>
  )
}
