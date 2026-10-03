import {
  canonicalAnswer,
  fingerprintOf,
  type AssignmentDetail,
  type StepCheckResult,
} from '@tp/shared'
import { z } from 'zod'

type Answers = Record<string, unknown>
type Save = (
  stepId: string,
  answers: Answers,
  checked: boolean,
  changed: string[],
  bases: Record<string, string>,
) => Promise<{
  result: StepCheckResult | null
  answers?: Answers
  updatedAt?: string
  kept?: string[]
  error: string | null
}>
/**
 * The blocks of one step answered here since it was last saved — those, not the step — and
 * for each, what the saved step held in it when it was first changed here. A reload tells
 * by that whether another tab or device has changed the block since, and so does the server
 * when the save arrives.
 */
type Pending = { answers: Answers; bases: Record<string, string>; checked: boolean }
type Snapshot = {
  answers: Record<string, Answers>
  results: Record<string, StepCheckResult>
  status: 'saved' | 'pending' | 'saving' | 'error'
  /**
   * How many saves so far let answers typed here give way to another device's. A hand-in
   * asked for before the count last went up was asked for work that has changed since.
   */
  dropped: number
}
const storedDraft = z.object({
  version: z.literal(3),
  steps: z.record(
    z.string(),
    z.object({
      answers: z.record(z.string(), z.unknown()),
      bases: z.record(z.string(), z.string()),
      /** The step's save on its way when the page went, block by block; see `sending`. */
      sending: z.record(z.string(), z.string()).optional(),
    }),
  ),
})
/**
 * Refusals no retry can turn around: the homework was handed in, or taken back, somewhere
 * else. A conflict can also be a lost race, and the page's fresh copy tells the two apart.
 */
const REFUSALS = new Set(['conflict', 'not_found'])
/**
 * Answers that leave a save in doubt: a server error can come after the save was written — a
 * gateway that gave up waiting, or a failure once the write had committed.
 */
const UNSETTLED = new Set(['internal', 'upstream_unavailable'])

/** Answers block by block, each in its canonical form: how a stored draft keeps `sending`. */
const canonicalBlocks = (answers: Answers) =>
  Object.fromEntries(
    Object.entries(answers).map(([blockId, value]) => [blockId, canonicalAnswer(value)]),
  )

function draftKey(assignment: AssignmentDetail) {
  const attempt = assignment.revisionRequestedAt ?? 'initial'
  return `homework-draft:v1:${assignment.student.id}:${assignment.id}:${attempt}`
}

/** One ordered queue for the whole homework, shared by autosave, checking and submission. */
export class HomeworkDraft {
  private snapshot: Snapshot
  private listeners = new Set<() => void>()
  private pending = new Map<string, Pending>()
  /**
   * What each step's save on its way carries, block by block, until an answer comes back.
   * Meanwhile the server may hold it or not: a page that unloads, or a request whose answer
   * is lost, leaves either possible. Kept with the draft, so that what this page saved itself
   * is never taken for another device's change.
   */
  private sending = new Map<string, Answers>()
  private running: Promise<boolean> | null = null
  private timer: ReturnType<typeof setTimeout> | undefined
  private storage: Storage | undefined
  private active: boolean
  private key: string
  /**
   * The newest version of the saved homework this page knows, its own saves included. Null
   * once a save came back without one: from then on, a refreshed copy cannot be told apart
   * from one older than this page's own saves.
   */
  private seen: string | null
  /** The last save was refused, not lost; see REFUSALS. */
  private refusal = false

  constructor(
    private assignment: AssignmentDetail,
    private save: Save,
    /** Asks the page for the homework as it now stands, after a refused save. */
    private refresh: () => void = () => {},
    /**
     * Tells the student that answers typed here gave way to newer ones from elsewhere, and
     * in which blocks.
     */
    private onDropped: (blockIds: string[]) => void = () => {},
  ) {
    this.active = assignment.status === 'assigned'
    this.key = draftKey(assignment)
    this.seen = assignment.updatedAt
    this.snapshot = {
      answers: Object.fromEntries(
        Object.entries(assignment.steps).map(([id, step]) => [id, step.answers]),
      ),
      results: assignment.results,
      status: 'saved',
      dropped: 0,
    }
  }

  getSnapshot = () => this.snapshot
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  hasPending = () => this.pending.size > 0
  wasRefused = () => this.refusal

  private publish(patch: Partial<Snapshot>) {
    this.snapshot = { ...this.snapshot, ...patch }
    this.listeners.forEach((listener) => listener())
  }

  private persist() {
    // Only unsaved answers are kept, in this tab and account, each with what the saved
    // homework held where it was typed, and with what the save on its way carries. A reload
    // can recover them.
    try {
      if (this.pending.size) {
        this.storage?.setItem(
          this.key,
          JSON.stringify({
            version: 3,
            steps: Object.fromEntries(
              [...this.pending].map(([id, step]) => {
                const sending = this.sending.get(id)

                return [
                  id,
                  {
                    answers: step.answers,
                    bases: step.bases,
                    ...(sending && { sending: canonicalBlocks(sending) }),
                  },
                ]
              }),
            ),
          }),
        )
      } else this.storage?.removeItem(this.key)
    } catch {
      // Storage can be unavailable or full; the unload guard still protects dirty work.
    }
  }

  /**
   * Puts back what a reload interrupted, block by block. A block comes back only while the
   * saved homework still holds what it was typed over — what this page began from, or what
   * its own save on the way carried, if that arrived: one that another tab or device has
   * changed since keeps that answer, since putting this one back would overwrite it.
   * Returns whether any answer was left out that way, so the student can be told.
   *
   * That save may also still be on its way, and land only after this page read the homework.
   * Until it is answered, it goes out again as it carried the block, and the typing since
   * follows, typed over it — as after a save whose answer was lost.
   */
  restore(storage: Storage): boolean {
    this.storage = storage
    if (!this.active) {
      this.persist()
      return false
    }
    let dropped = false
    try {
      const raw = storage.getItem(this.key)
      if (!raw) return false
      const parsed = storedDraft.safeParse(JSON.parse(raw))
      if (!parsed.success) {
        storage.removeItem(this.key)
        return false
      }
      const answers = { ...this.snapshot.answers }
      for (const [id, stored] of Object.entries(parsed.data.steps)) {
        if (!this.assignment.lesson.steps.some((step) => step.id === id)) continue
        const saved = this.assignment.steps[id]?.answers ?? {}
        // A checked step is locked whoever checked it, and its answers stand: no save lands.
        const locked = Boolean(this.snapshot.results[id])
        const kept: Pending = { answers: {}, bases: {}, checked: false }
        const unanswered: Answers = {}
        for (const [blockId, value] of Object.entries(stored.answers)) {
          const now = canonicalAnswer(saved[blockId])
          const sending = stored.sending?.[blockId]
          // Its own save on the way may still land while the block holds what that save was
          // typed over, and change it — even where that is also what was typed last.
          const landing = !locked && !!sending && sending !== now && now === stored.bases[blockId]
          // Saved after all: the request outlived the page that sent it.
          if (now === canonicalAnswer(value) && !landing) continue
          // Typed on from what the block still holds — what this page began from, or what its
          // own save on the way carried, taken after all — it is this page's to put back.
          const own = now === stored.bases[blockId] || now === sending
          if (locked || !own) {
            dropped = true
            continue
          }
          kept.answers[blockId] = value
          kept.bases[blockId] = now
          if (landing) unanswered[blockId] = JSON.parse(sending)
        }
        if (!Object.keys(kept.answers).length) continue
        answers[id] = { ...answers[id], ...kept.answers }
        this.pending.set(id, kept)
        if (Object.keys(unanswered).length) this.sending.set(id, unanswered)
      }
      this.persist()
      if (this.pending.size) {
        this.publish({ answers, status: 'pending' })
        this.schedule()
      }
    } catch {
      /* A damaged local draft must not prevent opening the saved homework. */
    }
    return dropped
  }

  reconcile(assignment: AssignmentDetail) {
    const wasActive = this.active
    const previousRevision = this.assignment.revisionRequestedAt
    const previousKey = this.key
    this.assignment = assignment
    if (assignment.status !== 'assigned') {
      this.active = false
      clearTimeout(this.timer)
      this.pending.clear()
      this.sending.clear()
      this.persist()
      return
    }

    // A teacher may return a handed-in submission while this page is still mounted. That
    // starts a fresh editable attempt: discard the locked results and any stale draft from
    // the previous attempt, while keeping the answers supplied by the server.
    if (!wasActive || assignment.revisionRequestedAt !== previousRevision) {
      this.active = true
      clearTimeout(this.timer)
      this.pending.clear()
      this.sending.clear()
      try {
        this.storage?.removeItem(previousKey)
      } catch {
        /* Storage may be disabled. */
      }
      this.key = draftKey(assignment)
      this.seen = assignment.updatedAt
      this.publish({
        answers: Object.fromEntries(
          Object.entries(assignment.steps).map(([id, step]) => [id, step.answers]),
        ),
        results: assignment.results,
        status: 'saved',
      })
      return
    }

    // A background page refresh must preserve typing: what is still waiting to be saved
    // stays on top. Under it, a copy newer than anything this page has saved shows what
    // another tab or device saved since. An older one — fetched before this page's last
    // save landed — must not take that save back off the screen; only its locks count.
    const answers = { ...this.snapshot.answers }
    if (this.seen && assignment.updatedAt > this.seen) {
      this.seen = assignment.updatedAt
      for (const [id, step] of Object.entries(assignment.steps)) {
        answers[id] = { ...step.answers, ...this.pending.get(id)?.answers }
      }
    }
    for (const id of Object.keys(assignment.results)) {
      answers[id] = assignment.steps[id]?.answers ?? {}
      this.pending.delete(id)
      this.sending.delete(id)
    }
    this.persist()
    this.publish({
      answers,
      results: { ...this.snapshot.results, ...assignment.results },
      ...(!this.pending.size && { status: 'saved' }),
    })
  }

  answer(stepId: string, blockId: string, value: unknown) {
    if (!this.active || this.snapshot.results[stepId]) return
    const pending = this.pending.get(stepId)
    // A block not changed here yet shows what the saved step holds in it, and that is what
    // this change is typed over. Changed again before it is saved, it keeps that first base.
    const base =
      pending?.bases[blockId] ?? canonicalAnswer(this.snapshot.answers[stepId]?.[blockId])
    this.pending.set(stepId, {
      answers: { ...pending?.answers, [blockId]: value },
      bases: { ...pending?.bases, [blockId]: base },
      checked: false,
    })
    this.persist()
    this.publish({
      answers: {
        ...this.snapshot.answers,
        [stepId]: { ...this.snapshot.answers[stepId], [blockId]: value },
      },
      status: this.running ? 'saving' : 'pending',
    })
    this.schedule()
  }

  private schedule() {
    clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      void this.flush()
    }, 700)
  }

  flush = (): Promise<boolean> => {
    clearTimeout(this.timer)
    if (this.running) return this.running
    if (!this.active || !this.pending.size) return Promise.resolve(true)
    this.running = this.drain().finally(() => {
      this.running = null
    })
    return this.running
  }

  private async drain(): Promise<boolean> {
    this.refusal = false
    this.publish({ status: 'saving' })
    while (this.active && this.pending.size) {
      const [id, pending] = this.pending.entries().next().value!
      // A save no answer came back for may have arrived all the same. Until an answer comes,
      // the step goes out again as that save carried it, and the typing since follows once
      // it lands: the server then holds what the blocks held before or this page's one save,
      // never an answer of this page's own that it would take for another device's.
      const unanswered = this.sending.get(id)
      const behind =
        unanswered !== undefined &&
        Object.entries(unanswered).some(
          ([blockId, value]) =>
            canonicalAnswer(pending.answers[blockId]) !== canonicalAnswer(value),
        )
      const carried = behind ? unanswered : pending.answers
      const changed = Object.keys(carried)
      // The whole step travels, so that a server which predates `changed` still saves it
      // whole; one that knows it takes only the blocks answered here, each while it still
      // holds what this page began from.
      const sent = { ...this.snapshot.answers[id], ...carried }
      const bases = Object.fromEntries(
        changed.flatMap((blockId) => {
          const base = pending.bases[blockId]
          return base === undefined ? [] : [[blockId, fingerprintOf(base)]]
        }),
      )
      const checking = !behind && pending.checked
      this.sending.set(id, carried)
      this.persist()
      try {
        const response = await this.save(id, sent, checking, changed, bases)
        // Taken or refused, an answer settles what the save carried; a server error does not —
        // unless this was the value in doubt going out again and failing again. That is a value
        // the server cannot take, and holding on to it would block every later save.
        if (!response.error || !UNSETTLED.has(response.error) || behind) this.sending.delete(id)
        if (response.error) {
          this.refusal = REFUSALS.has(response.error)
          throw new Error(response.error)
        }
        if (!this.active) return true
        if (!response.updatedAt) this.seen = null
        else if (!this.seen || response.updatedAt > this.seen) this.seen = response.updatedAt
        // The step as saved: these answers, and whatever another tab or device saved into
        // its other blocks — or into those of these it had changed since this page began on
        // them, which keep that. Once checked it is locked, even if another tab checked it
        // first.
        const saved = response.answers ?? sent
        const kept = new Set(response.kept)
        const next = this.pending.get(id)
        if (response.result) {
          // The step is locked as the server holds it. Typing made here since that it does not
          // hold gives way, and is reported like any other answer that lost to another one.
          for (const [blockId, value] of Object.entries(next?.answers ?? {}))
            if (canonicalAnswer(value) !== canonicalAnswer(saved[blockId])) kept.add(blockId)
          this.pending.delete(id)
        } else if (next) {
          // A check that went out has had its answer, whatever came of it.
          const left: Pending = {
            answers: { ...next.answers },
            bases: { ...next.bases },
            checked: next.checked && !checking,
          }
          for (const blockId of changed) {
            if (!Object.hasOwn(left.answers, blockId)) continue
            if (
              kept.has(blockId) ||
              canonicalAnswer(left.answers[blockId]) === canonicalAnswer(carried[blockId])
            ) {
              delete left.answers[blockId]
              delete left.bases[blockId]
            } else {
              // Answered on while this was saving: what it saved is what the block is now
              // typed over.
              left.bases[blockId] = canonicalAnswer(saved[blockId])
            }
          }
          if (left.checked || Object.keys(left.answers).length) this.pending.set(id, left)
          else this.pending.delete(id)
        }
        // Typed over an older copy of a block another device has saved since: its answer
        // stands, and this one is let go. The page is told which blocks, and it is counted.
        if (kept.size) this.onDropped([...kept])
        const patch: Partial<Snapshot> = {
          answers: {
            ...this.snapshot.answers,
            [id]: { ...saved, ...this.pending.get(id)?.answers },
          },
          ...(kept.size > 0 && { dropped: this.snapshot.dropped + 1 }),
        }
        if (response.result) {
          patch.results = { ...this.snapshot.results, [id]: response.result }
        }
        this.persist()
        this.publish(patch)
      } catch {
        // A refusal settled the save above. Lost on the way, or answered with a server error,
        // it leaves what it carried in doubt, and in `sending` for the retry to send again as
        // it was.
        this.persist()
        if (!this.active) return true
        this.publish({ status: 'error' })
        // Most likely handed in or taken back elsewhere, where no retry can save it. The
        // page's fresh copy shows the work as it now stands; after a lost race, that is
        // still open, and this step still waits with its retry.
        if (this.refusal) this.refresh()
        return false
      }
    }
    this.publish({ status: 'saved' })
    return true
  }

  async check(stepId: string) {
    if (!this.active) return { result: null, error: 'conflict' }
    const known = this.snapshot.results[stepId]
    if (known) return { result: known, error: null }
    const pending = this.pending.get(stepId)
    this.pending.set(stepId, {
      answers: pending?.answers ?? {},
      bases: pending?.bases ?? {},
      checked: true,
    })
    this.persist()
    const saved = await this.flush()
    return { result: this.snapshot.results[stepId] ?? null, error: saved ? null : 'save_failed' }
  }

  leave() {
    clearTimeout(this.timer)
    void this.flush()
  }
}
