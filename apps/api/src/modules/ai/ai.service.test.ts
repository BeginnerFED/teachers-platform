import { describe, expect, it, vi } from 'vitest'
import type { GeneratedLessonContent } from '@tp/shared'
import type { AiQuotaService } from './ai-quota.service'
import type { AiProvider, StructuredGenerationRequest } from './ai.provider'
import { createAiService } from './ai.service'

describe('AI lesson service', () => {
  it('does not reserve quota if the provider is not configured', async () => {
    const quota: AiQuotaService = { getStatus: vi.fn(), withReservation: vi.fn() }
    const provider: AiProvider = {
      assertConfigured: () => {
        throw new Error('AI generation is not configured')
      },
      generateStructured: vi.fn(),
    }

    await expect(
      createAiService({ provider, quota }).generateLessonDraft(
        { topic: 'Ordering food', targetLanguage: 'English', level: 'A2', stepCount: 1 },
        'profile-id',
      ),
    ).rejects.toThrow('AI generation is not configured')
    expect(quota.withReservation).not.toHaveBeenCalled()
  })

  it('replaces every model-controlled id while preserving answer references', async () => {
    const content: GeneratedLessonContent = {
      title: 'Ordering food',
      description: 'Restaurant English',
      tags: ['speaking'],
      steps: [
        {
          title: 'Choose a phrase',
          blocks: [
            {
              id: 'model-block',
              type: 'multiple_choice',
              prompt: 'Which phrase is polite?',
              options: [
                { id: 'model-a', text: 'Give me soup.' },
                { id: 'model-b', text: 'Could I have the soup, please?' },
              ],
              correctIds: ['model-b'],
              multiple: false,
              shuffle: true,
            },
          ],
        },
      ],
    }
    const reportUsage = vi.fn()
    const provider: AiProvider = {
      async generateStructured<T>(request: StructuredGenerationRequest<T>) {
        request.onUsage?.(4.5)
        return { value: content as T, model: 'test-model' }
      },
    }
    const quota: AiQuotaService = {
      getStatus: vi.fn(),
      async withReservation(_profileId, _kind, operation) {
        return operation({
          markProviderAttempted: vi.fn(),
          reportUsage,
        })
      },
    }
    const ids = ['new-block', 'new-a', 'new-b']
    const service = createAiService({ provider, quota, createId: () => ids.shift()! })

    const draft = await service.generateLessonDraft(
      {
        topic: 'Ordering food',
        targetLanguage: 'English',
        level: 'A2',
        stepCount: 1,
      },
      'profile-id',
    )
    const block = draft.steps[0]?.blocks[0]

    expect(block?.id).toBe('new-block')
    expect(block?.type).toBe('multiple_choice')
    if (block?.type !== 'multiple_choice') throw new Error('Expected a multiple-choice block')
    expect(block.options.map((option) => option.id)).toEqual(['new-a', 'new-b'])
    expect(block.correctIds).toEqual(['new-b'])
    expect(draft.level).toBe('A2')
    expect(reportUsage).toHaveBeenCalledOnce()
    expect(reportUsage).toHaveBeenCalledWith(4.5)
  })

  it('does not request or preserve point weights in generated lessons', async () => {
    const legacyWeightedContent = {
      title: 'Writing practice',
      description: 'A writing draft',
      tags: ['writing'],
      steps: [
        {
          title: 'Write',
          blocks: [
            {
              id: 'writing',
              type: 'free_writing' as const,
              prompt: 'Describe your ideal workplace.',
              points: 100,
            },
          ],
        },
      ],
    }
    const provider: AiProvider = {
      async generateStructured<T>(request: StructuredGenerationRequest<T>) {
        const prompt = JSON.parse(request.user) as Record<string, unknown>

        expect(request.system).toContain('Do not assign scores, grades, or point weights.')
        expect(JSON.stringify(prompt)).not.toMatch(/points|score|grade/i)

        const parsed = request.schema.parse(legacyWeightedContent)
        expect((parsed as GeneratedLessonContent).steps[0]?.blocks[0]).not.toHaveProperty('points')
        return { value: parsed, model: 'test-model' }
      },
    }
    const quota: AiQuotaService = {
      getStatus: vi.fn(),
      async withReservation(_profileId, _kind, operation) {
        return operation({
          markProviderAttempted: vi.fn(),
          reportUsage: vi.fn(),
        })
      },
    }
    const service = createAiService({ provider, quota })

    const draft = await service.generateLessonDraft(
      {
        topic: 'Writing practice',
        targetLanguage: 'English',
        level: 'B1',
        stepCount: 1,
      },
      'profile-id',
    )

    expect(draft.steps[0]?.blocks[0]).not.toHaveProperty('points')
  })
})
