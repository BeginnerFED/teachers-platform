import { describe, expect, it } from 'vitest'
import { replaceLessonWithAiDraftBody } from './contracts/ai'

const validBody = {
  expectedMetadata: {
    title: 'Existing lesson',
    description: null,
    level: 'A2' as const,
    tags: ['speaking'],
  },
  originalSteps: [
    {
      id: 'a40bda75-a267-4786-97ce-46613e1c0d8f',
      updatedAt: '2026-09-16T09:00:00.000Z',
    },
  ],
  draft: {
    title: 'Generated lesson',
    description: 'A generated proposal',
    level: 'A2' as const,
    tags: ['conversation'],
    model: '@cf/google/gemma-4-26b-a4b-it',
    steps: [
      {
        title: 'Warm-up',
        blocks: [{ id: 'heading-1', type: 'heading' as const, text: 'Let us begin', level: 2 }],
      },
    ],
  },
}

describe('replaceLessonWithAiDraftBody metadata snapshot', () => {
  it('accepts the exact material metadata reviewed before generation', () => {
    expect(replaceLessonWithAiDraftBody.safeParse(validBody).success).toBe(true)
  })

  it('requires the metadata snapshot so applying a draft cannot blindly overwrite it', () => {
    const withoutSnapshot = {
      originalSteps: validBody.originalSteps,
      draft: validBody.draft,
    }

    expect(replaceLessonWithAiDraftBody.safeParse(withoutSnapshot).success).toBe(false)
  })

  it('rejects fields outside the title, description, level and tags snapshot', () => {
    const result = replaceLessonWithAiDraftBody.safeParse({
      ...validBody,
      expectedMetadata: { ...validBody.expectedMetadata, updatedAt: '2026-09-16T09:00:00.000Z' },
    })

    expect(result.success).toBe(false)
  })
})
