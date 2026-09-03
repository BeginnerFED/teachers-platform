import { z } from 'zod'
import { LEVELS, type Level } from '../constants'
import type { Enums } from '../database.types'
import { blockDraftsSchema, type BlockDraft, type StudentBlock } from './blocks'
import { paginationQuery } from './pagination'

/**
 * A material is a lesson in the library: a sequence of steps, each step a page of blocks.
 * Distinct from `lessons`, which is an hour in the calendar. One is content, the other is
 * an appointment, and conflating them is the mistake this naming exists to prevent.
 */

/** The official library the platform ships, versus a teacher's own shelf. */
export const MATERIAL_VISIBILITIES = ['platform', 'private'] as const
export type MaterialVisibility = (typeof MATERIAL_VISIBILITIES)[number]

/** A draft is invisible to everyone but its owner, including to the admin's library. */
export const MATERIAL_STATUSES = ['draft', 'published'] as const
export type MaterialStatus = (typeof MATERIAL_STATUSES)[number]

/** Which shelf the list is showing. */
export const MATERIAL_SCOPES = ['platform', 'mine', 'all'] as const
export type MaterialScope = (typeof MATERIAL_SCOPES)[number]

type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never

/**
 * Compile-time tripwires. Each of these is a list that exists twice — once as a Postgres
 * enum and once as a TypeScript constant — and the failure they prevent is a migration
 * that adds a value nothing in the app can name, which surfaces as a runtime cast error
 * rather than a build error.
 */
export const levelsMatchDatabase: Exact<Level, Enums<'cefr_level'>> = true
export const visibilitiesMatchDatabase: Exact<
  MaterialVisibility,
  Enums<'material_visibility'>
> = true
export const statusesMatchDatabase: Exact<MaterialStatus, Enums<'material_status'>> = true

const tag = z.string().trim().min(1).max(40)

/**
 * `z.coerce.boolean()` would be wrong here and quietly so: it follows JavaScript, where
 * the string "false" is truthy, so `?deleted=false` would open the bin.
 */
const queryFlag = z
  .union([z.literal('true'), z.literal('false')])
  .default('false')
  .transform((value) => value === 'true')

export const listMaterialsQuery = paginationQuery.extend({
  scope: z.enum(MATERIAL_SCOPES).default('all'),
  level: z.enum(LEVELS).optional(),
  tag: tag.optional(),
  status: z.enum(MATERIAL_STATUSES).optional(),
  /** Matched against title and description. */
  query: z.string().trim().min(1).max(120).optional(),
  /** The bin. Deleted materials are excluded from every other view. */
  deleted: queryFlag,
})

export type ListMaterialsQuery = z.infer<typeof listMaterialsQuery>

export const materialIdParam = z.object({ materialId: z.uuid() })
export const stepIdParam = materialIdParam.extend({ stepId: z.uuid() })

export const createMaterialBody = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).optional(),
  level: z.enum(LEVELS),
  tags: z.array(tag).max(10).default([]),
  /**
   * Only the admin may write to the official library; the service enforces that rather
   * than the schema, so a teacher sending `platform` gets a 403 and not a 422.
   */
  visibility: z.enum(MATERIAL_VISIBILITIES).default('private'),
  estimatedMinutes: z.number().int().min(1).max(240).optional(),
})

export type CreateMaterialBody = z.infer<typeof createMaterialBody>

export const updateMaterialBody = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(1000).nullable(),
    level: z.enum(LEVELS),
    tags: z.array(tag).max(10),
    status: z.enum(MATERIAL_STATUSES),
    /**
     * Moving a lesson into the official library, or back out of it. Admin only — enforced
     * by the service rather than the schema, so a teacher sending it gets a 403 and not a
     * puzzling validation error about a field they never typed.
     */
    visibility: z.enum(MATERIAL_VISIBILITIES),
    estimatedMinutes: z.number().int().min(1).max(240).nullable(),
  })
  .partial()

export type UpdateMaterialBody = z.infer<typeof updateMaterialBody>

export const createStepBody = z.object({
  title: z.string().trim().max(200).optional(),
  /** Where to insert. Appended when absent. */
  position: z.number().int().min(0).max(200).optional(),
})

/**
 * The editor saves a step whole rather than block by block: a step is small, and a partial
 * write of an ordered array is a merge problem nobody wants at two in the morning.
 *
 * `expectedUpdatedAt` is the optimistic lock — the same trick the subscription endpoints
 * use. Two tabs editing one step is not hypothetical once autosave exists.
 */
export const updateStepBody = z
  .object({
    title: z.string().trim().max(200).nullable(),
    // Drafts, not finished blocks: see blockDraftSchema for why an editor must be allowed
    // to save something that is not yet fit to show a student.
    blocks: blockDraftsSchema,
    expectedUpdatedAt: z.iso.datetime({ offset: true }),
  })
  .partial()

export type UpdateStepBody = z.infer<typeof updateStepBody>

export const reorderStepsBody = z.object({
  /** Every step of the material, in the order they should end up. */
  orderedStepIds: z.array(z.uuid()).min(1).max(200),
})

export type ReorderStepsBody = z.infer<typeof reorderStepsBody>

/**
 * Marking a step without recording anything. The student projection carries no answer key,
 * so the browser cannot mark itself — it asks. Nothing is persisted here; that arrives with
 * assignments, and this endpoint is what makes a lesson usable before they exist.
 */
export const checkAnswersBody = z.object({
  /** Keyed by block id. The shape per block is the block's own, and graded defensively. */
  answers: z.record(z.string(), z.unknown()),
})

export type CheckAnswersBody = z.infer<typeof checkAnswersBody>

/* ----------------------------------------------------------------- responses --- */

export type MaterialOwner = {
  id: string
  fullName: string | null
  email: string
}

export type MaterialListItem = {
  id: string
  title: string
  description: string | null
  level: (typeof LEVELS)[number]
  tags: string[]
  visibility: MaterialVisibility
  status: MaterialStatus
  estimatedMinutes: number | null
  stepCount: number
  /** Null on a platform material — the library speaks for the platform, not a person. */
  owner: MaterialOwner | null
  /** Whether the caller can edit it, so the UI does not have to re-derive the rule. */
  canEdit: boolean
  /** Set when this is somebody's copy of another material. A record, not a live link. */
  sourceMaterialId: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export type MaterialStep = {
  id: string
  position: number
  title: string | null
  /** Everything the author has, finished or not. The student projection is the strict one. */
  blocks: BlockDraft[]
  /** Send it back as `expectedUpdatedAt` to save without clobbering another tab. */
  updatedAt: string
}

export type MaterialDetail = MaterialListItem & {
  steps: MaterialStep[]
}

/* The student's copy of all of the above — no answers anywhere in it. */

export type StudentMaterialStep = {
  id: string
  position: number
  title: string | null
  blocks: StudentBlock[]
}

export type StudentMaterial = {
  id: string
  title: string
  description: string | null
  level: (typeof LEVELS)[number]
  estimatedMinutes: number | null
  steps: StudentMaterialStep[]
}

export type BlockResult = {
  /** Null while a teacher still has to read it. */
  score: number | null
  max: number
  /** Keyed by answerable unit — a gap, a pair, a statement — so the page can tick each. */
  parts: Record<string, boolean>
  manual: boolean
  /** The author's note on why, revealed only once the answer has been given. */
  explanation?: string
}

export type StepCheckResult = {
  autoScore: number
  autoMax: number
  manualMax: number
  byBlock: Record<string, BlockResult>
}
