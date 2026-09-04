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
  DialogueOrderEditor,
  DictationEditor,
  MemoryMatchEditor,
  SpeedRoundEditor,
  WordSearchEditor,
} from './editors/games'
import {
  AnagramEditor,
  CrosswordEditor,
  HangmanEditor,
  HighlightWordsEditor,
  SpotMistakeEditor,
} from './editors/games2'
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
  materialId,
  onChange,
  t,
}: {
  draft: BlockDraft
  materialId: string
  onChange: (patch: Record<string, unknown>) => void
  t: Messages
}) {
  const as = <T extends BlockType>() => ({
    draft: draft as Draft<T>,
    onChange: onChange as (patch: Partial<Omit<BlockOfType<T>, 'id' | 'type'>>) => void,
    materialId,
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
    case 'memory_match':
      return <MemoryMatchEditor {...as<'memory_match'>()} />
    case 'word_search':
      return <WordSearchEditor {...as<'word_search'>()} />
    case 'dialogue_order':
      return <DialogueOrderEditor {...as<'dialogue_order'>()} />
    case 'dictation':
      return <DictationEditor {...as<'dictation'>()} />
    case 'speed_round':
      return <SpeedRoundEditor {...as<'speed_round'>()} />
    case 'hangman':
      return <HangmanEditor {...as<'hangman'>()} />
    case 'anagram':
      return <AnagramEditor {...as<'anagram'>()} />
    case 'spot_mistake':
      return <SpotMistakeEditor {...as<'spot_mistake'>()} />
    case 'highlight_words':
      return <HighlightWordsEditor {...as<'highlight_words'>()} />
    case 'crossword':
      return <CrosswordEditor {...as<'crossword'>()} />
  }
}
