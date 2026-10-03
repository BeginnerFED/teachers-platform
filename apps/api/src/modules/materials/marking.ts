import { gradeBlocks, type Block, type StepCheckResult } from '@tp/shared'

/** Whether anything was given for a block: an option chosen, a word tapped, a gap filled. */
function answered(value: unknown): boolean {
  if (value === undefined || value === null) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'object') return Object.keys(value).length > 0

  return true
}

/**
 * What to tell the student about one block. Held back until the question has been answered,
 * which is the only moment an explanation teaches anything rather than giving the answer
 * away — unless nothing can be answered any more (`reveal`). For "spot the mistake" the
 * explanation is the correction itself, and each of its sentences is a question of its own:
 * only the ones tapped are corrected.
 */
function explain(
  block: Block | undefined,
  answer: unknown,
  reveal: boolean,
): { explanation?: string } {
  if (!reveal && !answered(answer)) return {}

  if (block?.type === 'multiple_choice' && block.explanation) {
    return { explanation: block.explanation }
  }

  if (block?.type === 'spot_mistake') {
    const tapped =
      answer !== null && typeof answer === 'object' && !Array.isArray(answer)
        ? (answer as Record<string, unknown>)
        : {}
    const corrected = block.items.filter((item) => reveal || answered(tapped[item.id]))

    return corrected.length > 0
      ? {
          explanation: corrected
            .map((item) => `${item.words[item.wrongIndex] ?? '?'} → ${item.correction}`)
            .join(' · '),
        }
      : {}
  }

  return {}
}

/**
 * Marks one step: the pure grading, plus the one thing the grader does not know — what to
 * tell the student afterwards. Shared by the stateless check a lesson offers in the library
 * and by homework, so a step is marked the same way wherever it is answered.
 *
 * `reveal` is for a reader who will not answer again: the student once their homework's review
 * is complete, and the teacher reviewing it. Every explanation is given then, those of the
 * questions left unanswered too.
 */
export function markStep(
  blocks: Block[],
  answers: Record<string, unknown>,
  reveal = false,
): StepCheckResult {
  const graded = gradeBlocks(blocks, answers)

  return {
    autoScore: graded.autoScore,
    autoMax: graded.autoMax,
    manualMax: graded.manualMax,
    byBlock: Object.fromEntries(
      Object.entries(graded.byBlock).map(([blockId, grade]) => {
        const block = blocks.find((candidate) => candidate.id === blockId)

        return [blockId, { ...grade, ...explain(block, answers[blockId], reveal) }]
      }),
    ),
  }
}
