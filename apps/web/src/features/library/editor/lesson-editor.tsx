'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'
import { LayersIcon, Loader2Icon, PlusIcon } from 'lucide-react'
import { toast } from 'sonner'
import { arrayMove } from '@dnd-kit/sortable'
import type {
  AiDraftMaterialMetadata,
  BlockDraft,
  GeneratedLessonDraft,
  MaterialDetail,
  MaterialStep,
} from '@tp/shared'
import { Button } from '@/components/ui/button'
import type { Messages } from '@/messages'
import { addStep, deleteStep, loadSteps, reorderSteps, replaceLessonWithAiDraft } from '../actions'
import { AiLessonDialog } from './ai-lesson-dialog'
import { setEditorStepCount, setPendingFlush } from './editor-flush'
import { StepCanvas, StepCanvasSkeleton } from './step-canvas'
import { StepList } from './step-list'
import { useStepAutosave } from './use-autosave'

/** The same steps in the order given. Any the order does not name stay, at the end. */
function inOrder(steps: MaterialStep[], ids: string[]): MaterialStep[] {
  const rank = new Map(ids.map((id, index) => [id, index]))
  const at = (step: MaterialStep) => rank.get(step.id) ?? ids.length

  return [...steps].sort((a, b) => at(a) - at(b))
}

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
export function LessonEditor({
  material,
  accountId,
  locale,
  t,
}: {
  material: MaterialDetail
  accountId: string
  locale: string
  t: Messages
}) {
  const router = useRouter()
  const [steps, setSteps] = useState<MaterialStep[]>(() => material.steps)
  const [selectedId, setSelectedId] = useState<string | null>(() => material.steps[0]?.id ?? null)
  const [adding, startAdding] = useTransition()
  const [discarding, startDiscarding] = useTransition()
  // Deletions in flight, by step. A set rather than a transition's single flag, because
  // two steps can be on their way out at once and each row shows its own state.
  const [removing, setRemoving] = useState<ReadonlySet<string>>(() => new Set())
  // Whether the author has changed anything since mount. Fresh steps from the server
  // replace what is on screen only while this is false; after that only the locks move.
  const touched = useRef(false)
  const initialSteps = useRef(material.steps)
  const generationBase = useRef<{
    metadata: AiDraftMaterialMetadata
    steps: Pick<MaterialStep, 'id' | 'updatedAt'>[]
  }>({
    metadata: {
      title: material.title,
      description: material.description,
      level: material.level,
      tags: material.tags,
    },
    steps: material.steps.map(({ id, updatedAt }) => ({ id, updatedAt })),
  })

  const autosave = useStepAutosave(material.id, accountId)
  const { register, flushAll, drafts } = autosave

  // The preview button lives in the page header, outside this component; this is how it
  // asks for everything queued to be sent before it navigates.
  useEffect(() => {
    setPendingFlush(flushAll)

    return () => setPendingFlush(null)
  }, [flushAll])

  // The header's "give as homework" was rendered with the step count the page had, and
  // this editor adds and removes steps without rendering the page again.
  useEffect(() => {
    setEditorStepCount(steps.length)

    return () => setEditorStepCount(null)
  }, [steps.length])

  // A back-navigation restores this page from the router cache: the steps and the locks
  // it shows are the ones from the last visit, not the ones the server holds. Ask, and
  // adopt what comes back wholesale if nothing has been typed yet. After that a step keeps
  // what is on screen, and its lock moves only if the server's copy is that same content:
  // one changed elsewhere meanwhile keeps the old lock, so saving over it is a conflict.
  useEffect(() => {
    let cancelled = false

    const restored = drafts.restore(initialSteps.current, window.sessionStorage)
    if (drafts.hasPending()) {
      touched.current = true
      setSteps(restored)
    }

    void loadSteps(material.id)
      .then(({ steps: fresh }) => {
        if (cancelled || !fresh) return

        const adopted = !touched.current
        for (const step of fresh) register(step, { adopted })

        if (adopted) {
          setSteps(fresh)
          setSelectedId((current) =>
            fresh.some((step) => step.id === current) ? current : (fresh[0]?.id ?? null),
          )
        }
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [material.id, register, drafts])

  const selected = steps.find((step) => step.id === selectedId) ?? steps[0] ?? null

  // The steps as they are right now. A change can arrive long after the render that began
  // it — an upload finishing is the one that does — and a save built from that render's
  // steps would carry the title as it was then, quietly undoing a rename made in between.
  const latestSteps = useRef(steps)
  useEffect(() => {
    latestSteps.current = steps
  }, [steps])

  // A live lesson holding this one is not a failure worth retrying; it is a wait, and
  // saying so spares the author pressing the same button until the lesson ends.
  const failed = (error: string | null) =>
    error === 'live_locked' ? t.library.toast.liveLocked : t.library.toast.failed

  const prepareGeneration = async () => {
    await flushAll()

    const fresh = await loadSteps(material.id)
    if (fresh.error || !fresh.steps || !fresh.metadata) {
      throw new Error('Could not refresh lesson before generating')
    }

    for (const step of fresh.steps) register(step, { adopted: true })

    generationBase.current = {
      metadata: fresh.metadata,
      steps: fresh.steps.map(({ id, updatedAt }) => ({ id, updatedAt })),
    }
    touched.current = true
    latestSteps.current = fresh.steps
    setSteps(fresh.steps)
    setSelectedId((current) =>
      fresh.steps?.some((step) => step.id === current) ? current : (fresh.steps?.[0]?.id ?? null),
    )
  }

  const adoptServerSteps = (fresh: MaterialStep[]) => {
    for (const step of latestSteps.current) autosave.forget(step.id)
    for (const step of fresh) register(step, { adopted: true })

    touched.current = true
    latestSteps.current = fresh
    setSteps(fresh)
    setSelectedId((current) =>
      fresh.some((step) => step.id === current) ? current : (fresh[0]?.id ?? null),
    )
  }

  const reconcileAfterApplyFailure = async () => {
    try {
      const fresh = await loadSteps(material.id)
      if (fresh.steps) adoptServerSteps(fresh.steps)
      // The failed response may have followed a committed transaction. Refresh the
      // surrounding title, level and tags as well as the client-owned step editor.
      router.refresh()
    } catch {
      // Keep the original error visible. A temporary network outage can also prevent
      // this defensive read; the editor still retains its already-flushed local state.
    }
  }

  const applyGeneratedDraft = async (draft: GeneratedLessonDraft): Promise<string | null> => {
    try {
      await flushAll()
    } catch {
      return 'unsaved_changes'
    }

    let result: Awaited<ReturnType<typeof replaceLessonWithAiDraft>>

    try {
      result = await replaceLessonWithAiDraft(
        material.id,
        generationBase.current.metadata,
        generationBase.current.steps,
        draft,
      )
    } catch {
      await reconcileAfterApplyFailure()
      return 'internal'
    }

    // Even a partial network failure must leave the editor showing the server's truth.
    // Otherwise the next autosave could write against steps that no longer exist.
    if (result.steps) {
      adoptServerSteps(result.steps)
    }

    if (result.error) {
      await reconcileAfterApplyFailure()
      return result.error
    }

    toast.success(t.library.editor.ai.applied)
    // The editor has already adopted the saved steps. Refresh the surrounding server
    // header so the generated title, description, tags and level appear immediately too.
    router.refresh()
    return null
  }

  const changeStep = (id: string, patch: { title?: string | null; blocks?: BlockDraft[] }) => {
    const current = latestSteps.current.find((step) => step.id === id)
    if (!current) return

    touched.current = true

    // The patch always carries the whole field that changed — the full block list, the
    // full title — so merging it onto the freshest step is what gets saved, rather than
    // onto state that has not updated yet or, worse, onto a stale copy.
    const merged = { ...current, ...patch }

    latestSteps.current = latestSteps.current.map((step) => (step.id === id ? merged : step))

    setSteps((all) => all.map((step) => (step.id === id ? { ...step, ...patch } : step)))
    autosave.schedule(id, { title: merged.title, blocks: merged.blocks })
  }

  const add = () =>
    startAdding(async () => {
      touched.current = true
      const { step, error } = await addStep(material.id)

      if (error || !step) {
        toast.error(failed(error))
        return
      }

      register(step)
      setSteps((current) => [...current, step])
      setSelectedId(step.id)
    })

  const remove = async (id: string) => {
    touched.current = true

    // Wait for a save already in flight before deleting. Keep the draft until the delete
    // succeeds, so a failed removal cannot also discard the author's unsaved work.
    setRemoving((current) => new Set(current).add(id))
    await drafts.flush(id)

    const { error } = await deleteStep(material.id, id)

    setRemoving((current) => {
      const next = new Set(current)
      next.delete(id)
      return next
    })

    if (error) {
      toast.error(failed(error))
      return
    }

    autosave.forget(id)

    // From the steps as they are now, not as they were when the delete was asked for: the
    // author may have gone on typing in another step during the round trip, and a list
    // captured before it would put the older copy back and have the next keystroke save it.
    const index = latestSteps.current.findIndex((step) => step.id === id)
    const remaining = latestSteps.current.filter((step) => step.id !== id)
    latestSteps.current = remaining
    setSteps((current) => current.filter((step) => step.id !== id))

    // The neighbour that took its place, or the last one if it was the last.
    setSelectedId((current) =>
      current === id ? (remaining[Math.min(index, remaining.length - 1)]?.id ?? null) : current,
    )
  }

  const recover = () =>
    startAdding(async () => {
      if (!selected) return
      const payload = drafts.payload(selected.id)
      if (!payload) return
      const { steps: fresh } = await loadSteps(material.id)
      if (!fresh) {
        toast.error(t.library.toast.failed)
        return
      }
      const { step, error } = await addStep(material.id)
      if (!step || error) {
        toast.error(failed(error))
        return
      }
      register(step)
      drafts.queue(step.id, payload)
      drafts.forget(selected.id)
      // The step the draft came from is shown again as it is saved, so its lock is the
      // saved one. Only that step's: the others stay as the editor holds them.
      const original = fresh.find((item) => item.id === selected.id)
      if (original) register(original, { adopted: true })
      setSteps((current) =>
        [
          ...current.filter((item) => item.id !== selected.id),
          ...(original ? [original] : []),
          { ...step, ...payload },
        ].sort((a, b) => a.position - b.position),
      )
      setSelectedId(step.id)
      await drafts.flush(step.id)
      if (drafts.payload(step.id)) {
        toast.error(t.library.edit.saveFailed)
        return
      }
      toast.success(t.editorRecovery.recovered)
    })

  /**
   * The other way out of a conflict: the draft goes, and the step comes back as it is saved
   * — or leaves the list, if it was deleted. Nothing is duplicated, and a draft that no
   * longer applies stops coming back with every reload.
   */
  const discard = () =>
    startDiscarding(async () => {
      if (!selected) return
      const id = selected.id
      const { steps: fresh } = await loadSteps(material.id)
      if (!fresh) {
        toast.error(t.library.toast.failed)
        return
      }
      autosave.forget(id)
      // Only this step comes back from the server, so only its lock moves. Another step's
      // newer lock without its newer content would let the next save write over that edit.
      const saved = fresh.find((step) => step.id === id)
      if (saved) register(saved, { adopted: true })
      const replace = (all: MaterialStep[]) =>
        saved
          ? all.map((step) => (step.id === id ? saved : step))
          : all.filter((step) => step.id !== id)
      latestSteps.current = replace(latestSteps.current)
      setSteps(replace)
    })

  /**
   * Out of one step, onto the end of another. Both are saved. Refused when the target
   * already holds a block with that id: two blocks sharing one id in a step are edited,
   * deleted and marked as one. Says whether it moved, so the canvas records an undo only
   * for a move that happened.
   */
  const moveBlock = (fromStepId: string, blockId: string, toStepId: string): boolean => {
    const from = latestSteps.current.find((step) => step.id === fromStepId)
    const target = latestSteps.current.find((step) => step.id === toStepId)
    const block = from?.blocks.find((candidate) => candidate.id === blockId)
    if (!from || !target || !block || from.id === target.id) return false
    if (target.blocks.some((candidate) => candidate.id === blockId)) return false

    changeStep(from.id, { blocks: from.blocks.filter((candidate) => candidate.id !== blockId) })
    changeStep(target.id, { blocks: [...target.blocks, block] })

    return true
  }

  /** A move undone: the block leaves the step it went to, as the canvas puts its own back. */
  const unmoveBlock = (blockId: string, toStepId: string) => {
    const target = latestSteps.current.find((step) => step.id === toStepId)
    if (!target?.blocks.some((block) => block.id === blockId)) return

    changeStep(target.id, { blocks: target.blocks.filter((block) => block.id !== blockId) })
  }

  const reorder = async (from: number, to: number) => {
    const previous = steps.map((step) => step.id)
    const order = arrayMove(previous, from, to)
    touched.current = true

    // Optimistic: the list moves under the pointer, and is put back only if the server
    // disagrees. Waiting for a round trip before letting go of a dragged item is exactly
    // the kind of lag that makes a drag feel broken. Only the order is applied, to the
    // steps as they are by then, so nothing typed during the round trip is put back.
    setSteps((current) => inOrder(current, order))

    const { steps: saved, error } = await reorderSteps(material.id, order)

    if (error || !saved) {
      setSteps((current) => inOrder(current, previous))
      toast.error(failed(error))
      return
    }

    // The server's word on where each step now sits, and nothing more. A reorder changes no
    // step's content and so no step's version: a newer version in this list is an edit made
    // somewhere else, and taking its lock without its content would let the next save here
    // write over that edit unseen.
    for (const step of saved) drafts.place(step.id, step.position)

    const positions = new Map(saved.map((step) => [step.id, step.position]))
    setSteps((current) =>
      current.map((step) => {
        const position = positions.get(step.id)
        return position === undefined || position === step.position ? step : { ...step, position }
      }),
    )
  }

  // Nothing yet: one thing to do, said once, in the middle. The two-column layout only
  // makes sense once there is a step to list and a page to fill — before that it was a
  // narrow column holding one button beside a very large empty box.
  if (steps.length === 0 || !selected) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex justify-end">
          <AiLessonDialog
            defaultLevel={material.level}
            hasExistingSteps={false}
            onFlush={prepareGeneration}
            onApply={applyGeneratedDraft}
            locale={locale}
            t={t}
          />
        </div>

        <div className="border-border/60 bg-card flex flex-col items-center gap-4 rounded-2xl border px-6 py-14 text-center">
          <span className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-full">
            <LayersIcon className="size-4" />
          </span>

          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">{t.library.editor.empty.title}</p>
            <p className="text-muted-foreground max-w-sm text-balance text-sm">
              {t.library.editor.empty.body}
            </p>
          </div>

          <Button type="button" disabled={adding} onClick={add} className="corner-brackets">
            {adding ? <Loader2Icon className="animate-spin" /> : <PlusIcon />}
            {t.library.editor.firstStep}
          </Button>
        </div>
      </div>
    )
  }

  // The canvas is about to show a different step: the one being added will be selected,
  // and the one being deleted is leaving. A skeleton in its place says so, where the
  // change is going to happen, instead of the old page sitting there as if nothing were.
  const canvasBusy = adding || discarding || removing.has(selected.id)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <AiLessonDialog
          defaultLevel={material.level}
          hasExistingSteps
          onFlush={prepareGeneration}
          onApply={applyGeneratedDraft}
          locale={locale}
          t={t}
        />
      </div>

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
            materialId={material.id}
            status={autosave.status[selected.id] ?? 'idle'}
            onRetry={() => {
              void drafts.flush(selected.id)
            }}
            onRecover={recover}
            onDiscard={discard}
            // Numbered where they stand in the lesson, the way the list beside it numbers
            // them: often the number is all an untitled step has to go by.
            otherSteps={steps
              .map(({ id, title }, index) => ({ id, title, number: index + 1 }))
              .filter((step) => step.id !== selected.id)}
            onChange={(patch) => changeStep(selected.id, patch)}
            onMoveBlock={(blockId, toStepId) => moveBlock(selected.id, blockId, toStepId)}
            onUndoMove={unmoveBlock}
            t={t}
          />
        )}
      </div>
    </div>
  )
}
