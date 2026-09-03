'use client'

import type { BlockDraft, BlockOfType, BlockType } from '@tp/shared'
import type { Messages } from '@/messages'
import type { Draft } from './block-defaults'
import {
  CategorizeEditor,
  FlashcardsEditor,
  MatchingEditor,
  SentenceBuilderEditor,
} from './editors/arrange'
import { MultipleChoiceEditor, QuizGameEditor, TrueFalseEditor } from './editors/choice'
import {
  AudioEditor,
  CalloutEditor,
  DividerEditor,
  HeadingEditor,
  ImageEditor,
  ReadingEditor,
  TextEditor,
  VideoEditor,
} from './editors/presentation'
import { FreeWritingEditor, GapFillEditor } from './editors/writing'

/**
 * One switch, exhaustive over the block types. A draft is a partial of its finished
 * shape, which is what the cast below says: nothing is invented, the editor is simply
 * told which shape it is filling in.
 */
export function BlockEditor({
  draft,
  onChange,
  t,
}: {
  draft: BlockDraft
  onChange: (patch: Record<string, unknown>) => void
  t: Messages
}) {
  const as = <T extends BlockType>() => ({
    draft: draft as Draft<T>,
    onChange: onChange as (patch: Partial<Omit<BlockOfType<T>, 'id' | 'type'>>) => void,
    t,
  })

  switch (draft.type) {
    case 'heading':
      return <HeadingEditor {...as<'heading'>()} />
    case 'text':
      return <TextEditor {...as<'text'>()} />
    case 'callout':
      return <CalloutEditor {...as<'callout'>()} />
    case 'image':
      return <ImageEditor {...as<'image'>()} />
    case 'audio':
      return <AudioEditor {...as<'audio'>()} />
    case 'video':
      return <VideoEditor {...as<'video'>()} />
    case 'divider':
      return <DividerEditor />
    case 'reading':
      return <ReadingEditor {...as<'reading'>()} />
    case 'multiple_choice':
      return <MultipleChoiceEditor {...as<'multiple_choice'>()} />
    case 'true_false':
      return <TrueFalseEditor {...as<'true_false'>()} />
    case 'quiz_game':
      return <QuizGameEditor {...as<'quiz_game'>()} />
    case 'gap_fill':
      return <GapFillEditor {...as<'gap_fill'>()} />
    case 'free_writing':
      return <FreeWritingEditor {...as<'free_writing'>()} />
    case 'matching':
      return <MatchingEditor {...as<'matching'>()} />
    case 'categorize':
      return <CategorizeEditor {...as<'categorize'>()} />
    case 'sentence_builder':
      return <SentenceBuilderEditor {...as<'sentence_builder'>()} />
    case 'flashcards':
      return <FlashcardsEditor {...as<'flashcards'>()} />
  }
}
