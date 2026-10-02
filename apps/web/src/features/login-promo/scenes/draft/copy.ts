import type { Messages } from '@/messages'
import { FIRST_STEP } from './data'

/**
 * What the draft scene says, picked on the server from the page's dictionary: the AI
 * lesson dialog's own strings (library.editor.ai), in both of its stages.
 */
export function pickDraftCopy(t: Messages) {
  const ai = t.library.editor.ai
  const names = t.library.editor.blocks
  const kinds = [...new Set(FIRST_STEP.blocks)].map((type) => names[type])

  return {
    title: t.loginPromo.scenes.draft.title,
    line: t.loginPromo.scenes.draft.line,

    // The form.
    dialogTitle: ai.title,
    dialogDescription: ai.description,
    topic: ai.topic,
    topicPlaceholder: ai.topicPlaceholder,
    instructions: ai.instructions,
    instructionsPlaceholder: ai.instructionsPlaceholder,
    targetLanguage: ai.targetLanguage,
    language: ai.defaultTargetLanguage,
    level: ai.level,
    stepCount: ai.stepCount,
    cancel: ai.cancel,
    generate: ai.generate,
    generating: ai.generating,

    // The preview.
    previewTitle: ai.previewTitle,
    previewDescription: ai.previewDescription,
    /** The open step's sub-line, written the way the dialog writes it. */
    stepSummary: `${FIRST_STEP.blocks.length} ${ai.blocks} · ${kinds.join(', ')}`,
    multipleChoice: names.multiple_choice,
    callout: names.callout,
    correct: t.library.editor.fields.correct,
    grammar: t.library.editor.fields.tones.grammar,
  }
}

export type DraftCopy = ReturnType<typeof pickDraftCopy>
