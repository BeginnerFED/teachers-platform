import { z } from 'zod'
import { LEVELS } from '../constants'
import {
  calloutBlock,
  dividerBlock,
  flashcardsBlock,
  freeWritingBlock,
  gapFillBlock,
  headingBlock,
  matchingBlock,
  multipleChoiceBlock,
  readingBlock,
  textBlock,
  trueFalseBlock,
} from './blocks'

export const AI_USAGE_KINDS = ['lesson_draft', 'homework_feedback'] as const
export type AiUsageKind = (typeof AI_USAGE_KINDS)[number]

const aiQuotaCountersSchema = z.strictObject({
  kind: z.enum(AI_USAGE_KINDS),
  resetAt: z.iso.datetime({ offset: true }),
  retryAfterSeconds: z.number().int().nonnegative(),
  requestedUnits: z.number().int().nonnegative(),
  userCalls: z.number().int().nonnegative(),
  userCallLimit: z.number().int().positive(),
  platformUnits: z.number().int().nonnegative(),
  platformUnitLimit: z.number().int().positive(),
})

export const aiQuotaExceededDetailsSchema = z.union([
  aiQuotaCountersSchema.safeExtend({
    scope: z.literal('user'),
    reason: z.literal('user_daily_call_limit'),
  }),
  aiQuotaCountersSchema.safeExtend({
    scope: z.literal('platform'),
    reason: z.literal('platform_daily_unit_limit'),
  }),
])

export type AiQuotaExceededDetails = z.infer<typeof aiQuotaExceededDetailsSchema>

export const aiRequestRateLimitDetailsSchema = z.strictObject({
  scope: z.literal('request'),
  reason: z.literal('rate_limit'),
  retryAfterSeconds: z.number().int().positive(),
})

export type AiRequestRateLimitDetails = z.infer<typeof aiRequestRateLimitDetailsSchema>

export const aiProviderRateLimitDetailsSchema = z.strictObject({
  scope: z.literal('provider'),
  reason: z.literal('provider_rate_limit'),
})

export type AiProviderRateLimitDetails = z.infer<typeof aiProviderRateLimitDetailsSchema>

/** Structured 429 details returned by an AI endpoint. */
export const aiLimitDetailsSchema = z.union([
  aiQuotaExceededDetailsSchema,
  aiRequestRateLimitDetailsSchema,
  aiProviderRateLimitDetailsSchema,
])

export type AiLimitDetails = z.infer<typeof aiLimitDetailsSchema>

export const aiUsageAllowanceSchema = z.strictObject({
  used: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  remaining: z.number().int().nonnegative(),
})

export type AiUsageAllowance = z.infer<typeof aiUsageAllowanceSchema>

/**
 * The caller's current UTC-day allowance. Feature limits count requests, while the shared
 * platform allowance counts Cloudflare neurons. Keeping those units explicit prevents a
 * UI from presenting unlike quantities as though they were interchangeable.
 */
export const aiUsageStatusSchema = z.strictObject({
  usageDate: z.iso.date(),
  resetAt: z.iso.datetime({ offset: true }),
  lessonDraft: aiUsageAllowanceSchema,
  homeworkFeedback: aiUsageAllowanceSchema,
  platform: z.strictObject({
    usedUnits: z.number().int().nonnegative(),
    limitUnits: z.number().int().positive(),
    remainingUnits: z.number().int().nonnegative(),
  }),
})

export type AiUsageStatus = z.infer<typeof aiUsageStatusSchema>

/**
 * Blocks the model may author directly. Asset-backed blocks need an uploaded asset, while
 * generated grids and puzzles need deterministic builders, so neither belongs in this
 * endpoint. The returned blocks are complete and can be shown in the editor immediately.
 */
export const AI_LESSON_BLOCK_TYPES = [
  'heading',
  'text',
  'callout',
  'divider',
  'multiple_choice',
  'gap_fill',
  'matching',
  'true_false',
  'flashcards',
  'reading',
  'free_writing',
] as const

// The regular editor schemas still understand legacy point weights. AI-authored drafts do
// not expose that field at all, so neither the provider's JSON schema nor its result can
// reintroduce scoring into the teacher's workflow.
const { points: _multipleChoicePoints, ...aiMultipleChoiceShape } = multipleChoiceBlock.shape
const aiMultipleChoiceBlock = z
  .object(aiMultipleChoiceShape)
  .refine(
    (block) => block.correctIds.every((id) => block.options.some((option) => option.id === id)),
    {
      message: 'correctIds must all name an option',
      path: ['correctIds'],
    },
  )
  .refine((block) => block.multiple || block.correctIds.length === 1, {
    message: 'A single-answer question needs exactly one correct option',
    path: ['correctIds'],
  })

const { points: _gapFillPoints, ...aiGapFillShape } = gapFillBlock.shape
const aiGapFillBlock = z
  .object(aiGapFillShape)
  .refine((block) => block.segments.some((segment) => segment.kind === 'gap'), {
    message: 'A gap-fill needs at least one gap',
    path: ['segments'],
  })

export const aiLessonBlockSchema = z.discriminatedUnion('type', [
  headingBlock,
  textBlock,
  calloutBlock,
  dividerBlock,
  aiMultipleChoiceBlock,
  aiGapFillBlock,
  matchingBlock.omit({ points: true }),
  trueFalseBlock.omit({ points: true }),
  flashcardsBlock.omit({ points: true }),
  readingBlock.omit({ audioAssetId: true, points: true }),
  freeWritingBlock.omit({ points: true }),
])

export type AiLessonBlock = z.infer<typeof aiLessonBlockSchema>

export const generateLessonDraftBody = z.strictObject({
  topic: z.string().trim().min(2).max(500),
  instructions: z.string().trim().min(1).max(2000).optional(),
  targetLanguage: z.string().trim().min(2).max(80),
  level: z.enum(LEVELS),
  stepCount: z.number().int().min(1).max(8),
})

export type GenerateLessonDraftBody = z.infer<typeof generateLessonDraftBody>

export const generatedLessonStepSchema = z.strictObject({
  title: z.string().trim().min(1).max(200),
  blocks: z.array(aiLessonBlockSchema).min(1).max(12),
})

export type GeneratedLessonStep = z.infer<typeof generatedLessonStepSchema>

/** The model-produced part of a draft, before the provider name is attached. */
export const generatedLessonContentSchema = z.strictObject({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000),
  tags: z.array(z.string().trim().min(1).max(40)).max(10),
  steps: z.array(generatedLessonStepSchema).min(1).max(8),
})

export type GeneratedLessonContent = z.infer<typeof generatedLessonContentSchema>

/**
 * An editor-ready suggestion only. There are deliberately no material or step database
 * ids here: accepting the suggestion and persisting it is a separate, explicit action.
 */
export const generatedLessonDraftSchema = generatedLessonContentSchema.safeExtend({
  /** Echoed from the validated request; the model never gets to choose the CEFR level. */
  level: z.enum(LEVELS),
  model: z.string().trim().min(1).max(200),
})

export type GeneratedLessonDraft = z.infer<typeof generatedLessonDraftSchema>

/**
 * The material fields shown alongside the editor when generation starts. They are kept
 * separate from the proposed values so the database can refuse to overwrite a rename or
 * property change made while the teacher was reviewing the proposal.
 */
export const aiDraftMaterialMetadataSchema = z.strictObject({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).nullable(),
  level: z.enum(LEVELS),
  tags: z.array(z.string().trim().min(1).max(40)).max(10),
})

export type AiDraftMaterialMetadata = z.infer<typeof aiDraftMaterialMetadataSchema>

/**
 * The editor snapshot that an author reviewed before accepting an AI draft. The database
 * checks every timestamp again inside the same transaction that replaces the lesson, so
 * a save from another tab can never be deleted between a preflight check and the write.
 */
export const replaceLessonWithAiDraftBody = z
  .strictObject({
    expectedMetadata: aiDraftMaterialMetadataSchema,
    originalSteps: z
      .array(
        z.strictObject({
          id: z.uuid(),
          updatedAt: z.iso.datetime({ offset: true }),
        }),
      )
      .max(200),
    draft: generatedLessonDraftSchema,
  })
  .superRefine((value, context) => {
    const ids = new Set(value.originalSteps.map((step) => step.id))

    if (ids.size !== value.originalSteps.length) {
      context.addIssue({
        code: 'custom',
        path: ['originalSteps'],
        message: 'Original step ids must be unique',
      })
    }
  })

export type ReplaceLessonWithAiDraftBody = z.infer<typeof replaceLessonWithAiDraftBody>
