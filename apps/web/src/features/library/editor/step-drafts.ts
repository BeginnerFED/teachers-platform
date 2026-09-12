import { blockDraftSchema, type BlockDraft, type MaterialStep } from '@tp/shared'
import { z } from 'zod'

export type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'failed' | 'conflict'
export type StepPayload = Pick<MaterialStep, 'title' | 'blocks'>
type Draft = { payload: StepPayload; lock: string; position: number }
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
  }),
)

/** Failed saves retain their payload and base version until acknowledged or explicitly discarded. */
export class StepDrafts {
  private drafts: Record<string, Draft> = {}
  private locks = new Map<string, string>()
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
  register(step: MaterialStep) {
    if (!this.drafts[step.id] && !this.running.has(step.id)) this.locks.set(step.id, step.updatedAt)
    this.positions.set(step.id, step.position)
  }
  restore(steps: MaterialStep[], storage: Storage) {
    this.storage = storage
    steps.forEach((step) => this.register(step))
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
      if (
        current &&
        JSON.stringify({ title: current.title, blocks: current.blocks }) ===
          JSON.stringify(draft.payload)
      ) {
        delete this.drafts[id]
        this.locks.set(id, current.updatedAt)
        this.mark(id, 'saved')
        continue
      }
      this.locks.set(id, draft.lock)
      this.mark(id, current?.updatedAt === draft.lock ? 'failed' : 'conflict')
      const restored = { id, position: draft.position, updatedAt: draft.lock, ...draft.payload }
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
    }
    this.persist()
    clearTimeout(this.timers.get(id))
    if (this.state[id] === 'conflict') return
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
          this.mark(id, 'saving')
          try {
            const { step, error } = await this.save(id, {
              ...draft.payload,
              expectedUpdatedAt: draft.lock,
            })
            if (!this.drafts[id]) return // An explicit delete/discard happened in flight.
            if (error || !step) {
              this.mark(id, error === 'conflict' || error === 'not_found' ? 'conflict' : 'failed')
              return
            }
            this.locks.set(id, step.updatedAt)
            if (this.drafts[id] === draft) delete this.drafts[id]
            else this.drafts[id] = { ...this.drafts[id], lock: step.updatedAt }
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
  forget(id: string) {
    clearTimeout(this.timers.get(id))
    delete this.drafts[id]
    this.persist()
    this.mark(id, 'idle')
  }
}
