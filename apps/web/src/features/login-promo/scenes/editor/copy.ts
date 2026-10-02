import type { Messages } from '@/messages'

/**
 * What the editor scene says, picked on the server from the page's dictionary: the step
 * canvas's own words — its undo button, the save states, the gap-fill block's frame and
 * its hint — so the replica reads exactly as the editor does.
 */
export function pickEditorCopy(t: Messages) {
  const editor = t.library.editor

  return {
    title: t.loginPromo.scenes.editor.title,
    line: t.loginPromo.scenes.editor.line,
    undo: editor.undo,
    addBlock: editor.addBlock,
    /** The tools capsule names the block by its type. */
    blockType: editor.blocks.gap_fill,
    incomplete: editor.incomplete,
    /** The label the player prints over the exercise. */
    fillGaps: t.library.blocks.fillGaps,
    /** GapText's hint line, joined the way it joins them. */
    hint: `${editor.fields.clickToGap} ${editor.fields.gapHint}`,
    status: {
      pending: t.editorRecovery.pending,
      saving: editor.status.saving,
      saved: editor.status.saved,
    },
  }
}

export type EditorCopy = ReturnType<typeof pickEditorCopy>
