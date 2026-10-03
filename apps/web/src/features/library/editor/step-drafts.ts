import { blockDraftSchema, type BlockDraft, type MaterialStep } from '@tp/shared'
import { z } from 'zod'

export type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'failed' | 'paused' | 'conflict'
export type StepPayload = Pick<MaterialStep, 'title' | 'blocks'>
/**
 * `base` is the step's content as the server held it at `lock`. Kept so that a newer lock
 * over the very same content — saved again, nothing in it changed — can be told apart
 * from somebody else's edit. Drafts written before it existed have none.
 */
type Draft = { payload: StepPayload; lock: string; position: number; base?: string }
type Save = (
  id: string,
  payload: StepPayload & { expectedUpdatedAt: string },
) => Promise<{
  step?: MaterialStep | null
  error?: string | null
}>
const storedDrafts = z.record(
  z.string(),
  z.object({
    payload: z.object({ title: z.string().nullable(), blocks: z.array(blockDraftSchema) }),
    lock: z.string(),
    position: z.number(),
    base: z.string().optional(),
  }),
)

/**
 * A step's title and blocks as one string, whatever order their keys happen to be in: the
 * server hands blocks back in its own order, and the editor builds them in another.
 */
export function stepContent(step: StepPayload): string {
  return JSON.stringify({ title: step.title, blocks: step.blocks }, (_, value: unknown) =>
    value !== null && typeof value === 'object' && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : value,
  )
}

/** Failed saves retain their payload and base version until acknowledged or explicitly discarded. */
export class StepDrafts {
  private drafts: Record<string, Draft> = {}
  private locks = new Map<string, string>()
  private bases = new Map<string, string>()
  private positions = new Map<string, number>()
  private running = new Map<string, Promise<void>>()
  private timers = new Map<string, ReturnType<typeof setTimeout>>()
  private listeners = new Set<() => void>()
  private state: Record<string, SaveStatus> = {}
  private storage?: Storage
  constructor(
    private key: string,
    private save: Save,
  ) {}
  subscribe = (fn: () => void) => {
    this.listeners.add(fn)
    return () => {
      this.listeners.delete(fn)
    }
  }
  getSnapshot = () => this.state
  private mark(id: string, status: SaveStatus) {
    this.state = { ...this.state, [id]: status }
    this.listeners.forEach((fn) => fn())
  }
  private persist() {
    try {
      if (this.hasPending()) this.storage?.setItem(this.key, JSON.stringify(this.drafts))
      else this.storage?.removeItem(this.key)
    } catch {
      /* A full or disabled browser store must not stop network saves. */
    }
  }
  /**
   * The server's copy of a step, as the version its next save is checked against. With no
   * draft waiting, the lock follows only content the editor really shows: a copy the caller
   * has just put on screen (`adopted`), or one the same as what it already holds. A copy
   * carrying somebody else's edit leaves the old lock in place, so that a save from the
   * older text on screen is refused as a conflict instead of quietly writing over theirs.
   */
  register(step: MaterialStep, { adopted = false }: { adopted?: boolean } = {}) {
    this.positions.set(step.id, step.position)
    if (this.running.has(step.id)) return
    const draft = this.drafts[step.id]
    if (!draft) {
      const content = stepContent(step)
      const base = this.bases.get(step.id)
      if (!adopted && base !== undefined && base !== content) return
      this.locks.set(step.id, step.updatedAt)
      this.bases.set(step.id, content)
      return
    }
    // A draft is waiting, and the server's copy has a newer lock over exactly the content
    // the draft was written against: nothing it would write over has changed. The draft
    // still applies, so it goes out under the new lock instead of failing on the old one.
    if (draft.lock !== step.updatedAt && draft.base === stepContent(step)) {
      this.drafts[step.id] = { ...draft, lock: step.updatedAt }
      this.locks.set(step.id, step.updatedAt)
      this.persist()
      if (this.state[step.id] === 'conflict') this.mark(step.id, 'failed')
    }
  }
  /**
   * Where a step now sits after a reorder, and nothing else: a reorder changes neither a
   * step's content nor its version, so its lock stays exactly where it was.
   */
  place(id: string, position: number) {
    this.positions.set(id, position)
  }
  restore(steps: MaterialStep[], storage: Storage) {
    this.storage = storage
    // The steps the page was rendered with, which are what the editor first shows.
    steps.forEach((step) => this.register(step, { adopted: true }))
    try {
      const parsed = storedDrafts.safeParse(JSON.parse(storage.getItem(this.key) ?? '{}'))
      if (parsed.success) this.drafts = { ...parsed.data, ...this.drafts }
    } catch {
      /* Ignore invalid browser data. */
    }
    const result = [...steps]
    for (const [id, draft] of Object.entries(this.drafts)) {
      const index = result.findIndex((step) => step.id === id)
      const current = result[index]
      // A lost success response is already saved, even though its timestamp changed.
      if (current && stepContent(current) === stepContent(draft.payload)) {
        delete this.drafts[id]
        this.locks.set(id, current.updatedAt)
        this.bases.set(id, stepContent(current))
        this.mark(id, 'saved')
        continue
      }
      // Only the lock moved — the same content under a newer timestamp — so the draft is
      // not in conflict with anything and is simply sent again under the new lock.
      const lock =
        current && draft.base !== undefined && draft.base === stepContent(current)
          ? current.updatedAt
          : draft.lock
      if (lock !== draft.lock) this.drafts[id] = { ...draft, lock }
      this.locks.set(id, lock)
      this.mark(id, current?.updatedAt === lock ? 'failed' : 'conflict')
      const restored = { id, position: draft.position, updatedAt: lock, ...draft.payload }
      if (index >= 0) result[index] = restored
      else result.push(restored)
    }
    this.persist()
    return result
  }
  queue(id: string, payload: { title: string | null; blocks: BlockDraft[] }) {
    this.drafts[id] = {
      payload,
      lock: this.locks.get(id) ?? '',
      position: this.positions.get(id) ?? 0,
      base: this.bases.get(id),
    }
    this.persist()
    // Kept, not sent: a conflict waits for the author, and a step held by a live lesson is
    // retried on its own schedule — the newest draft is what that retry will carry.
    if (this.state[id] === 'conflict' || this.state[id] === 'paused') return
    clearTimeout(this.timers.get(id))
    this.mark(id, 'pending')
    this.timers.set(
      id,
      setTimeout(() => {
        void this.flush(id)
      }, 800),
    )
  }
  hasPending = () => Object.keys(this.drafts).length > 0
  payload(id: string) {
    return this.drafts[id]?.payload
  }
  flush = (id: string): Promise<void> => {
    const running = this.running.get(id)
    if (running) return running
    clearTimeout(this.timers.get(id))
    if (!this.drafts[id] || this.state[id] === 'conflict') return Promise.resolve()
    // Defer until the promise is registered, even if the injected save fails synchronously.
    const job = Promise.resolve()
      .then(async () => {
        while (this.drafts[id]) {
          const draft = this.drafts[id]
          // A retry while a live lesson holds the step is expected to be refused again;
          // flashing "saving" for it every few seconds would only be noise.
          if (this.state[id] !== 'paused') this.mark(id, 'saving')
          try {
            const { step, error } = await this.save(id, {
              ...draft.payload,
              expectedUpdatedAt: draft.lock,
            })
            if (!this.drafts[id]) return // An explicit delete/discard happened in flight.
            if (error || !step) {
              this.mark(
                id,
                error === 'conflict' || error === 'not_found'
                  ? 'conflict'
                  : error === 'live_locked'
                    ? 'paused'
                    : 'failed',
              )
              return
            }
            this.locks.set(id, step.updatedAt)
            this.bases.set(id, stepContent(step))
            if (this.drafts[id] === draft) delete this.drafts[id]
            else
              this.drafts[id] = {
                ...this.drafts[id],
                lock: step.updatedAt,
                base: stepContent(step),
              }
            this.persist()
            this.mark(id, this.drafts[id] ? 'pending' : 'saved')
          } catch {
            this.mark(id, 'failed')
            return
          }
        }
      })
      .finally(() => this.running.delete(id))
    this.running.set(id, job)
    return job
  }
  flushAll = async () => {
    await Promise.all(
      [...new Set([...Object.keys(this.drafts), ...this.running.keys()])].map(this.flush),
    )
    if (this.hasPending()) throw new Error('Unsaved lesson changes')
  }
  /** Tries again every step waiting for a live lesson to end. */
  retryPaused = () => {
    for (const [id, status] of Object.entries(this.state)) {
      if (status === 'paused') void this.flush(id)
    }
  }
  forget(id: string) {
    clearTimeout(this.timers.get(id))
    delete this.drafts[id]
    this.persist()
    this.mark(id, 'idle')
  }
}
