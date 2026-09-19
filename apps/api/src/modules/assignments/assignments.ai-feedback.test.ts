import { afterEach, describe, expect, it, vi } from 'vitest'
import { gradeAssignmentBody, type Tables } from '@tp/shared'
import type { AiQuotaService } from '../ai/ai-quota.service'
import type { AiProvider } from '../ai/ai.provider'
import type { MaterialStepRow, MaterialsRepository } from '../materials/materials.repository'
import { assignmentSnapshots } from './assignment-snapshots.repository'
import type { AssignmentRow, AssignmentsRepository } from './assignments.repository'
import { createAssignmentsService } from './assignments.service'

afterEach(() => vi.restoreAllMocks())

describe('AI homework feedback', () => {
  it('rejects the retired manual score field at the request boundary', () => {
    expect(
      gradeAssignmentBody.safeParse({
        feedback: 'Keep practising the article before professions.',
        manualScore: 1,
      }).success,
    ).toBe(false)
  })

  it.each([
    { answer: '  ', manualMax: 5, eligible: false },
    { answer: 'I would like to order tea, please.', manualMax: 0, eligible: true },
  ])(
    'only reserves quota for a nonblank writing answer ($eligible)',
    async ({ answer, manualMax, eligible }) => {
      const row = {
        id: 'assignment',
        teacher_id: 'teacher',
        status: 'submitted',
        manual_max: manualMax,
        progress: { step: { answers: { writing: answer }, checked: true } },
      } as unknown as AssignmentRow
      const assignments = {
        findById: vi.fn().mockResolvedValue(row),
      } as unknown as AssignmentsRepository
      const ai: AiProvider = {
        generateStructured: vi.fn().mockResolvedValue({
          value: { feedback: 'Review this answer.' },
          model: 'test-model',
        }),
      }
      const quota: AiQuotaService = {
        getStatus: vi.fn(),
        withReservation: vi.fn(async (_profile, _kind, operation) =>
          operation({ markProviderAttempted: vi.fn(), reportUsage: vi.fn() }),
        ),
      }

      vi.spyOn(assignmentSnapshots, 'get').mockResolvedValue({
        material: {
          title: 'Ordering food',
          level: 'A2',
          description: null,
        } as Tables<'materials'>,
        steps: [
          {
            id: 'step',
            title: 'Writing',
            blocks: [{ id: 'writing', type: 'free_writing', prompt: 'Order tea', points: 5 }],
          } as unknown as MaterialStepRow,
        ],
      })

      const service = createAssignmentsService({
        assignments,
        materials: {} as MaterialsRepository,
        ai,
        quota,
      })
      const request = service.suggestFeedback('assignment', {
        id: 'teacher',
        role: 'teacher',
      })

      if (!eligible) {
        await expect(request).rejects.toMatchObject({ code: 'rule_violation' })
        expect(quota.withReservation).not.toHaveBeenCalled()
        expect(ai.generateStructured).not.toHaveBeenCalled()
      } else {
        await expect(request).resolves.toEqual({
          feedback: 'Review this answer.',
        })
        expect(quota.withReservation).toHaveBeenCalledOnce()
        expect(ai.generateStructured).toHaveBeenCalledWith(
          expect.objectContaining({
            system: expect.not.stringContaining('score'),
            user: expect.not.stringMatching(/totalManualPoints|maximumPoints/),
          }),
        )
      }
    },
  )

  it.each([
    {
      label: 'written work without feedback',
      hasWriting: true,
      manualMax: 0,
      existingFeedback: null,
      body: {},
      blocked: true,
    },
    {
      label: 'written work with existing feedback',
      hasWriting: true,
      manualMax: 5,
      existingFeedback: 'You used the target phrase well. Check the article before tea.',
      body: {},
      blocked: false,
    },
    {
      label: 'legacy manual maximum without written work',
      hasWriting: false,
      manualMax: 5,
      existingFeedback: null,
      body: {},
      blocked: false,
    },
  ])(
    'uses the submitted snapshot to require feedback: $label',
    async ({ hasWriting, manualMax, existingFeedback, body, blocked }) => {
      const row = {
        id: 'assignment',
        teacher_id: 'teacher',
        status: 'submitted',
        manual_max: manualMax,
        manual_score: null,
        feedback: existingFeedback,
        updated_at: '2026-09-19T12:00:00.000Z',
      } as unknown as AssignmentRow
      const assignments = {
        findById: vi.fn().mockResolvedValue(row),
        updateSubmitted: vi.fn().mockResolvedValue(null),
      } as unknown as AssignmentsRepository
      vi.spyOn(assignmentSnapshots, 'get').mockResolvedValue({
        material: {
          title: 'Ordering food',
          level: 'A2',
          description: null,
        } as Tables<'materials'>,
        steps: [
          {
            id: 'step',
            title: 'Practice',
            blocks: hasWriting
              ? [{ id: 'writing', type: 'free_writing', prompt: 'Order tea' }]
              : [
                  {
                    id: 'choice',
                    type: 'multiple_choice',
                    prompt: 'Choose one',
                    options: [
                      { id: 'a', text: 'Tea' },
                      { id: 'b', text: 'Coffee' },
                    ],
                    correctIds: ['a'],
                    multiple: false,
                    shuffle: false,
                  },
                ],
          } as unknown as MaterialStepRow,
        ],
      })
      const service = createAssignmentsService({
        assignments,
        materials: {} as MaterialsRepository,
        ai: {} as AiProvider,
        quota: {} as AiQuotaService,
      })

      const request = service.grade('assignment', body, {
        id: 'teacher',
        role: 'teacher',
      })

      if (blocked) {
        await expect(request).rejects.toMatchObject({ code: 'rule_violation' })
        expect(assignments.updateSubmitted).not.toHaveBeenCalled()
      } else {
        // A null update deliberately stops before detail mapping; reaching the repository
        // proves that this review passed the feedback-only completion rule.
        await expect(request).rejects.toMatchObject({ code: 'conflict' })
        expect(assignments.updateSubmitted).toHaveBeenCalledWith(
          'assignment',
          '2026-09-19T12:00:00.000Z',
          expect.objectContaining({ status: 'graded' }),
        )
        expect(assignments.updateSubmitted).toHaveBeenCalledOnce()
        expect(assignments.updateSubmitted).not.toHaveBeenCalledWith(
          'assignment',
          '2026-09-19T12:00:00.000Z',
          expect.objectContaining({ manual_score: expect.anything() }),
        )
      }
    },
  )
})
