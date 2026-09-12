import type { AssignmentDetail, StepCheckResult } from '@tp/shared'
import { z } from 'zod'

type Answers = Record<string, unknown>
type Save = (
  stepId: string,
  answers: Answers,
  checked: boolean,
) => Promise<{
  result: StepCheckResult | null
  answers?: Answers
  error: string | null
}>
type Pending = { answers: Answers; checked: boolean }
type Snapshot = {
  answers: Record<string, Answers>
  results: Record<string, StepCheckResult>
  status: 'saved' | 'pending' | 'saving' | 'error'
}
const storedDraft = z.object({
  version: z.literal(1),
  steps: z.record(z.string(), z.record(z.string(), z.unknown())),
})

/** One ordered queue for the whole homework, shared by autosave, checking and submission. */
export class HomeworkDraft {
  private snapshot: Snapshot
  private listeners = new Set<() => void>()
  private pending = new Map<string, Pending>()
  private running: Promise<boolean> | null = null
  private timer: ReturnType<typeof setTimeout> | undefined
  private storage: Storage | undefined
  private active: boolean
  private key: string

  constructor(
    private assignment: AssignmentDetail,
    private save: Save,
  ) {
    this.active = assignment.status === 'assigned'
    this.key = `homework-draft:v1:${assignment.student.id}:${assignment.id}`
    this.snapshot = {
      answers: Object.fromEntries(
        Object.entries(assignment.steps).map(([id, step]) => [id, step.answers]),
      ),
      results: assignment.results,
      status: 'saved',
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

  private publish(patch: Partial<Snapshot>) {
    this.snapshot = { ...this.snapshot, ...patch }
    this.listeners.forEach((listener) => listener())
  }

  private persist() {
    // Only unsaved answers are kept, in this tab and account. A reload can recover them.
    try {
      if (this.pending.size) {
        this.storage?.setItem(
          this.key,
          JSON.stringify({
            version: 1,
            steps: Object.fromEntries([...this.pending].map(([id, step]) => [id, step.answers])),
          }),
        )
      } else this.storage?.removeItem(this.key)
    } catch {
      // Storage can be unavailable or full; the unload guard still protects dirty work.
    }
  }

  restore(storage: Storage) {
    this.storage = storage
    if (!this.active) {
      this.persist()
      return
    }
    try {
      const raw = storage.getItem(this.key)
      if (!raw) return
      const parsed = storedDraft.safeParse(JSON.parse(raw))
      if (!parsed.success) {
        storage.removeItem(this.key)
        return
      }
      const answers = { ...this.snapshot.answers }
      for (const [id, given] of Object.entries(parsed.data.steps)) {
        if (
          this.snapshot.results[id] ||
          !this.assignment.lesson.steps.some((step) => step.id === id)
        )
          continue
        answers[id] = given
        this.pending.set(id, { answers: given, checked: false })
      }
      this.persist()
      if (this.pending.size) {
        this.publish({ answers, status: 'pending' })
        this.schedule()
      }
    } catch {
      /* A damaged local draft must not prevent opening the saved homework. */
    }
  }

  reconcile(assignment: AssignmentDetail) {
    this.assignment = assignment
    if (assignment.status !== 'assigned') {
      this.active = false
      clearTimeout(this.timer)
      this.pending.clear()
      this.persist()
      return
    }
    // A background page refresh must preserve typing. Only server-locked steps win.
    const answers = { ...this.snapshot.answers }
    for (const id of Object.keys(assignment.results)) {
      answers[id] = assignment.steps[id]?.answers ?? {}
      this.pending.delete(id)
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
    const answers = { ...this.snapshot.answers[stepId], [blockId]: value }
    this.pending.set(stepId, { answers, checked: false })
    this.persist()
    this.publish({
      answers: { ...this.snapshot.answers, [stepId]: answers },
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
    this.publish({ status: 'saving' })
    while (this.active && this.pending.size) {
      const [id, pending] = this.pending.entries().next().value!
      try {
        const response = await this.save(id, pending.answers, pending.checked)
        if (response.error) throw new Error(response.error)
        if (!this.active) return true
        const patch: Partial<Snapshot> = {}
        if (response.result) {
          // Another tab may already have checked it. Show its canonical answers and marks.
          patch.answers = { ...this.snapshot.answers, [id]: response.answers ?? pending.answers }
          patch.results = { ...this.snapshot.results, [id]: response.result }
          this.pending.delete(id)
        } else if (this.pending.get(id) === pending) {
          this.pending.delete(id)
        }
        this.persist()
        this.publish(patch)
      } catch {
        if (!this.active) return true
        this.publish({ status: 'error' })
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
    this.pending.set(stepId, { answers: this.snapshot.answers[stepId] ?? {}, checked: true })
    this.persist()
    const saved = await this.flush()
    return { result: this.snapshot.results[stepId] ?? null, error: saved ? null : 'save_failed' }
  }

  leave() {
    clearTimeout(this.timer)
    void this.flush()
  }
}
