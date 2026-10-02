import type { Messages } from '@/messages'
import { pickDraftCopy } from './scenes/draft/copy'
import { pickEditorCopy } from './scenes/editor/copy'
import { pickFeedbackCopy } from './scenes/feedback/copy'
import { pickHomeworkCopy } from './scenes/homework/copy'
import { pickLibraryCopy } from './scenes/library/copy'
import { pickLiveCopy } from './scenes/live/copy'
import { pickProgressCopy } from './scenes/progress/copy'
import { pickScheduleCopy } from './scenes/schedule/copy'
import type { SceneId } from './timeline'

/**
 * The strings the tour shows, picked on the server.
 *
 * Only this slice crosses into the browser, not the dictionary it comes from, and it is
 * picked from whichever dictionary the page renders with — so the development Turkish
 * reading aid shows the tour in Turkish too. Each scene picks its own part beside its
 * component; counted and formatted pieces are finished here, where the locale is known.
 */
export function pickPromoCopy(t: Messages) {
  const scenes = {
    intro: { title: t.app.tagline, line: t.app.description },
    library: pickLibraryCopy(t),
    draft: pickDraftCopy(t),
    editor: pickEditorCopy(t),
    live: pickLiveCopy(t),
    homework: pickHomeworkCopy(t),
    feedback: pickFeedbackCopy(t),
    progress: pickProgressCopy(t),
    schedule: pickScheduleCopy(t),
  } satisfies Record<SceneId, { title: string; line: string }>

  return {
    label: t.loginPromo.label,
    play: t.loginPromo.play,
    pause: t.loginPromo.pause,
    chapterGroup: t.loginPromo.chapterGroup,
    chapter: t.loginPromo.chapter,
    chapters: t.loginPromo.chapters,
    scenes,
  }
}

export type PromoCopy = ReturnType<typeof pickPromoCopy>
