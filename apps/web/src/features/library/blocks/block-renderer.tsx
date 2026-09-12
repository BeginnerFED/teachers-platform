'use client'

import type { BlockResult, StudentBlock } from '@tp/shared'
import type { Messages } from '@/messages'
import { CategorizeBlock, FlashcardsBlock, MatchingBlock, SentenceBuilderBlock } from './arrange'
import { MultipleChoiceBlock, QuizGameBlock, TrueFalseBlock } from './choice'
import {
  DialogueOrderBlock,
  DictationBlock,
  MemoryMatchBlock,
  SpeedRoundBlock,
  WordSearchBlock,
} from './games'
import {
  AnagramBlock,
  CrosswordBlock,
  HangmanBlock,
  HighlightWordsBlock,
  SpotMistakeBlock,
} from './games2'
import {
  AudioBlock,
  CalloutBlock,
  DividerBlock,
  HeadingBlock,
  ImageBlock,
  ReadingBlock,
  TextBlock,
  VideoBlock,
} from './presentation'
import { GapFillBlock, FreeWritingBlock } from './writing'

/**
 * One switch, exhaustive over the union. Adding a block type to the schema without adding
 * it here is a type error rather than a blank space in somebody's lesson.
 */
export function BlockRenderer({
  block,
  answer,
  onAnswer,
  result,
  locked,
  reviewed,
  ui,
  onUi,
  leads = true,
  t,
}: {
  block: StudentBlock
  answer: unknown
  onAnswer: (value: unknown) => void
  result?: BlockResult
  locked?: boolean
  reviewed?: boolean
  /** The block's own state, when the player keeps it — see `BlockProps`. */
  ui?: unknown
  onUi?: (value: unknown) => void
  /** Whether this browser drives the clocks. */
  leads?: boolean
  t: Messages
}) {
  // Narrowed once here so each component can declare exactly the block it draws.
  const shared = { answer, onAnswer, result, locked, ui, onUi, leads, t }

  switch (block.type) {
    case 'heading':
      return <HeadingBlock block={block} />
    case 'text':
      return <TextBlock block={block} />
    case 'callout':
      return <CalloutBlock block={block} />
    case 'image':
      return <ImageBlock block={block} />
    case 'audio':
      return <AudioBlock block={block} ui={ui} onUi={onUi} t={t} />
    case 'video':
      return <VideoBlock block={block} t={t} />
    case 'divider':
      return <DividerBlock />
    case 'reading':
      return <ReadingBlock block={block} t={t} />

    case 'multiple_choice':
      return <MultipleChoiceBlock block={block} {...shared} />
    case 'true_false':
      return <TrueFalseBlock block={block} {...shared} />
    case 'quiz_game':
      return <QuizGameBlock block={block} {...shared} />
    case 'gap_fill':
      return <GapFillBlock block={block} {...shared} />
    case 'free_writing':
      return <FreeWritingBlock block={block} reviewed={reviewed} {...shared} />
    case 'matching':
      return <MatchingBlock block={block} {...shared} />
    case 'categorize':
      return <CategorizeBlock block={block} {...shared} />
    case 'sentence_builder':
      return <SentenceBuilderBlock block={block} {...shared} />
    case 'flashcards':
      return <FlashcardsBlock block={block} {...shared} />

    case 'memory_match':
      return <MemoryMatchBlock block={block} {...shared} />
    case 'word_search':
      return <WordSearchBlock block={block} {...shared} />
    case 'dialogue_order':
      return <DialogueOrderBlock block={block} {...shared} />
    case 'dictation':
      return <DictationBlock block={block} {...shared} />
    case 'speed_round':
      return <SpeedRoundBlock block={block} {...shared} />

    case 'hangman':
      return <HangmanBlock block={block} {...shared} />
    case 'anagram':
      return <AnagramBlock block={block} {...shared} />
    case 'spot_mistake':
      return <SpotMistakeBlock block={block} {...shared} />
    case 'highlight_words':
      return <HighlightWordsBlock block={block} {...shared} />
    case 'crossword':
      return <CrosswordBlock block={block} {...shared} />
  }
}
