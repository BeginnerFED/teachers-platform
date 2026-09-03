'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { LayersIcon, Loader2Icon, PlusIcon } from 'lucide-react'
import { toast } from 'sonner'
import { arrayMove } from '@dnd-kit/sortable'
import type { BlockDraft, MaterialDetail, MaterialStep } from '@tp/shared'
import { Button } from '@/components/ui/button'
import type { Messages } from '@/messages'
import { addStep, deleteStep, loadSteps, reorderSteps } from '../actions'
import { setPendingFlush } from './editor-flush'
import { StepCanvas, StepCanvasSkeleton } from './step-canvas'
import { StepList } from './step-list'
import { useStepAutosave } from './use-autosave'

/**
 * The lesson as a thing being made. Steps down the side, the chosen step's blocks in the
 * middle, and nothing to submit: every change is saved a moment after it is made.
 *
 * The editor owns its copy of the steps from the moment it mounts. The page may re-render
 * around it — a title saved in the header, the library list refreshed — and none of that
 * is allowed to reach in and replace what is being typed. The one exception is deliberate:
 * on mount it asks the server for the steps as they are now, because the page it was
 * handed may be the browser's cached copy from before the last save.
 */
export function LessonEditor({ material, t }: { material: MaterialDetail; t: Messages }) {
  const [steps, setSteps] = useState<MaterialStep[]>(() => material.steps)
  const [selectedId, setSelectedId] = useState<string | null>(() => material.steps[0]?.id ?? null)
  const [adding, startAdding] = useTransition()
  // Deletions in flight, by step. A set rather than a transition's single flag, because
  // two steps can be on their way out at once and each row shows its own state.
  const [removing, setRemoving] = useState<ReadonlySet<string>>(() => new Set())
  // Whether the author has changed anything since mount. Fresh steps from the server
  // replace what is on screen only while this is false; after that only the locks move.
  const touched = useRef(false)

  const autosave = useStepAutosave(material.id, steps)
  const { register, flushAll } = autosave

  // The preview button lives in the page header, outside this component; this is how it
  // asks for everything queued to be sent before it navigates.
  useEffect(() => {
    setPendingFlush(flushAll)

    return () => setPendingFlush(null)
  }, [flushAll])

  // A back-navigation restores this page from the router cache: the steps and the locks
  // it shows are the ones from the last visit, not the ones the server holds. Ask, and
  // adopt what comes back — wholesale if nothing has been typed yet, locks only otherwise.
  useEffect(() => {
    let cancelled = false

    void loadSteps(material.id).then(({ steps: fresh }) => {
      if (cancelled || !fresh) return

      for (const step of fresh) register(step)

      if (!touched.current) {
        setSteps(fresh)
        setSelectedId((current) =>
          fresh.some((step) => step.id === current) ? current : (fresh[0]?.id ?? null),
        )
      }
    })

    return () => {
      cancelled = true
    }
  }, [material.id, register])

  const selected = steps.find((step) => step.id === selectedId) ?? steps[0] ?? null

  const changeStep = (id: string, patch: { title?: string | null; blocks?: BlockDraft[] }) => {
    const current = steps.find((step) => step.id === id)
    if (!current) return

    touched.current = true

    // The patch always carries the whole field that changed — the full block list, the
    // full title — so merging it onto the rendered step is the freshest possible view,
    // and the save is scheduled from that rather than from state that has not updated yet.
    const merged = { ...current, ...patch }

    setSteps((all) => all.map((step) => (step.id === id ? { ...step, ...patch } : step)))
    autosave.schedule(id, { title: merged.title, blocks: merged.blocks })
  }

  const add = () =>
    startAdding(async () => {
      touched.current = true
      const { step, error } = await addStep(material.id)

      if (error || !step) {
        toast.error(t.library.toast.failed)
        return
      }

      register(step)
      setSteps((current) => [...current, step])
      setSelectedId(step.id)
    })

  const remove = async (id: string) => {
    const index = steps.findIndex((step) => step.id === id)
    touched.current = true

    // Marked first, so the row fades the instant the dialog closes rather than after the
    // round trip. Any save still queued for it is dropped now: a save that lands after
    // the delete would only fail, and a failure flash on a vanishing row helps nobody.
    setRemoving((current) => new Set(current).add(id))
    autosave.forget(id)

    const { error } = await deleteStep(material.id, id)

    setRemoving((current) => {
      const next = new Set(current)
      next.delete(id)
      return next
    })

    if (error) {
      toast.error(t.library.toast.failed)
      return
    }

    const remaining = steps.filter((step) => step.id !== id)
    setSteps(remaining)

    if (selectedId === id) {
      // The neighbour that took its place, or the last one if it was the last.
      setSelectedId(remaining[Math.min(index, remaining.length - 1)]?.id ?? null)
    }
  }

  /** Out of one step, onto the end of another. Both are saved. */
  const moveBlock = (blockId: string, toStepId: string) => {
    const from = selected
    const target = steps.find((step) => step.id === toStepId)
    const block = from?.blocks.find((candidate) => candidate.id === blockId)
    if (!from || !target || !block || from.id === target.id) return

    touched.current = true
    const fromBlocks = from.blocks.filter((candidate) => candidate.id !== blockId)
    const toBlocks = [...target.blocks, block]

    setSteps((all) =>
      all.map((step) =>
        step.id === from.id
          ? { ...step, blocks: fromBlocks }
          : step.id === target.id
            ? { ...step, blocks: toBlocks }
            : step,
      ),
    )
    autosave.schedule(from.id, { title: from.title, blocks: fromBlocks })
    autosave.schedule(target.id, { title: target.title, blocks: toBlocks })
  }

  const reorder = async (from: number, to: number) => {
    const previous = steps
    const next = arrayMove(steps, from, to)
    touched.current = true

    // Optimistic: the list moves under the pointer, and is put back only if the server
    // disagrees. Waiting for a round trip before letting go of a dragged item is exactly
    // the kind of lag that makes a drag feel broken.
    setSteps(next)

    const { error } = await reorderSteps(
      material.id,
      next.map((step) => step.id),
    )

    if (error) {
      setSteps(previous)
      toast.error(t.library.toast.failed)
    }
  }

  // Nothing yet: one thing to do, said once, in the middle. The two-column layout only
  // makes sense once there is a step to list and a page to fill — before that it was a
  // narrow column holding one button beside a very large empty box.
  if (steps.length === 0 || !selected) {
    return (
      <div className="flex flex-col items-center gap-5 rounded-xl border border-dashed px-6 py-16 text-center">
        <LayersIcon className="text-muted-foreground/50 size-8" strokeWidth={1.5} />

        <div className="flex flex-col gap-1">
          <p className="font-medium">{t.library.editor.empty.title}</p>
          <p className="text-muted-foreground max-w-sm text-balance text-sm">
            {t.library.editor.empty.body}
          </p>
        </div>

        <Button type="button" disabled={adding} onClick={add} className="corner-brackets">
          {adding ? <Loader2Icon className="animate-spin" /> : <PlusIcon />}
          {t.library.editor.firstStep}
        </Button>
      </div>
    )
  }

  // The canvas is about to show a different step: the one being added will be selected,
  // and the one being deleted is leaving. A skeleton in its place says so, where the
  // change is going to happen, instead of the old page sitting there as if nothing were.
  const canvasBusy = adding || removing.has(selected.id)

  return (
    <div className="grid gap-8 lg:grid-cols-[200px_minmax(0,1fr)]">
      <StepList
        materialId={material.id}
        steps={steps}
        selectedId={selected.id}
        adding={adding}
        removingIds={removing}
        onSelect={setSelectedId}
        onAdd={add}
        onDelete={remove}
        onReorder={reorder}
        t={t}
      />

      {canvasBusy ? (
        <StepCanvasSkeleton />
      ) : (
        <StepCanvas
          // Keyed by step so the canvas's own local state — the gap-fill's raw text, the
          // sentence being typed — starts fresh when a different step is chosen.
          key={selected.id}
          step={selected}
          status={autosave.status[selected.id] ?? 'idle'}
          otherSteps={steps
            .filter((step) => step.id !== selected.id)
            .map(({ id, title }) => ({ id, title }))}
          onChange={(patch) => changeStep(selected.id, patch)}
          onMoveBlock={moveBlock}
          t={t}
        />
      )}
    </div>
  )
}
