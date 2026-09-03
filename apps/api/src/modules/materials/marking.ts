import { gradeBlocks, type Block, type StepCheckResult } from '@tp/shared'

/**
 * Marks one step: the pure grading, plus the one thing the grader does not know — what to
 * tell the student afterwards. Shared by the stateless check a lesson offers in the library
 * and by homework, so a step is marked the same way wherever it is answered.
 */
export function markStep(blocks: Block[], answers: Record<string, unknown>): StepCheckResult {
  const graded = gradeBlocks(blocks, answers)

  return {
    autoScore: graded.autoScore,
    autoMax: graded.autoMax,
    manualMax: graded.manualMax,
    byBlock: Object.fromEntries(
      Object.entries(graded.byBlock).map(([blockId, grade]) => {
        const block = blocks.find((candidate) => candidate.id === blockId)
        // Held back until the question has been answered, which is the only moment an
        // explanation teaches anything rather than giving the answer away. For "spot the
        // mistake" the explanation is the correction itself.
        const explanation =
          block?.type === 'multiple_choice' && block.explanation
            ? { explanation: block.explanation }
            : block?.type === 'spot_mistake'
              ? {
                  explanation: block.items
                    .map((item) => `${item.words[item.wrongIndex] ?? '?'} → ${item.correction}`)
                    .join(' · '),
                }
              : {}

        return [blockId, { ...grade, ...explanation }]
      }),
    ),
  }
}
