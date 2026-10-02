import type { Messages } from '@/messages'

/**
 * What the feedback scene says, picked on the server from the page's dictionary: the
 * review card's own words, from its first state (the assistant drafting) to its last
 * (the review complete).
 */
export function pickFeedbackCopy(t: Messages) {
  const { evaluation, aiFeedback } = t.homework

  return {
    title: t.loginPromo.scenes.feedback.title,
    line: t.loginPromo.scenes.feedback.line,
    evaluation: evaluation.title,
    exercises: evaluation.exercises,
    exercisesHint: evaluation.exercisesHint,
    assistantTitle: evaluation.assistantTitle,
    assistantHint: evaluation.assistantHint,
    assistantAction: evaluation.assistantAction,
    generating: aiFeedback.generating,
    feedback: evaluation.feedback,
    feedbackPlaceholder: evaluation.feedbackPlaceholder,
    complete: evaluation.complete,
    saving: t.homework.saving,
    update: evaluation.update,
    saved: evaluation.saved,
  }
}

export type FeedbackCopy = ReturnType<typeof pickFeedbackCopy>
