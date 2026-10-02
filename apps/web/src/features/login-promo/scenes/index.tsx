'use client'

import type { ReactNode } from 'react'
import type { PromoCopy } from '../copy'
import type { SceneId } from '../timeline'
import { DraftScene } from './draft/scene'
import { EditorScene } from './editor/scene'
import { FeedbackScene } from './feedback/scene'
import { HomeworkScene } from './homework/scene'
import { IntroScene } from './intro/scene'
import { LibraryScene } from './library/scene'
import { LiveScene } from './live/scene'
import { ProgressScene } from './progress/scene'
import { ScheduleScene } from './schedule/scene'

/** Each chapter's scene, handed its own part of the copy. */
export const SCENE_VIEWS: Record<SceneId, (copy: PromoCopy) => ReactNode> = {
  intro: (copy) => <IntroScene copy={copy.scenes.intro} />,
  library: (copy) => <LibraryScene copy={copy.scenes.library} />,
  draft: (copy) => <DraftScene copy={copy.scenes.draft} />,
  editor: (copy) => <EditorScene copy={copy.scenes.editor} />,
  live: (copy) => <LiveScene copy={copy.scenes.live} />,
  homework: (copy) => <HomeworkScene copy={copy.scenes.homework} />,
  feedback: (copy) => <FeedbackScene copy={copy.scenes.feedback} />,
  progress: (copy) => <ProgressScene copy={copy.scenes.progress} />,
  schedule: (copy) => <ScheduleScene copy={copy.scenes.schedule} />,
}
