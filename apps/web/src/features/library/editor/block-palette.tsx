'use client'

import {
  AlignLeftIcon,
  ArrowLeftRightIcon,
  BookOpenIcon,
  BrainIcon,
  CaseUpperIcon,
  CheckCheckIcon,
  EarIcon,
  Grid3x3Icon,
  HeadingIcon,
  HighlighterIcon,
  HeadphonesIcon,
  ImageIcon,
  LayersIcon,
  LayoutGridIcon,
  ListChecksIcon,
  MessageSquareTextIcon,
  MessagesSquareIcon,
  MinusIcon,
  PenLineIcon,
  PlusIcon,
  SearchIcon,
  SearchXIcon,
  ShuffleIcon,
  SpellCheckIcon,
  TextCursorInputIcon,
  TimerIcon,
  VideoIcon,
  ZapIcon,
} from 'lucide-react'
import { EXERCISE_BLOCK_TYPES, PRESENTATION_BLOCK_TYPES, type BlockType } from '@tp/shared'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Messages } from '@/messages'

const ICONS: Record<BlockType, typeof PlusIcon> = {
  heading: HeadingIcon,
  text: AlignLeftIcon,
  callout: MessageSquareTextIcon,
  image: ImageIcon,
  audio: HeadphonesIcon,
  video: VideoIcon,
  divider: MinusIcon,
  reading: BookOpenIcon,
  multiple_choice: ListChecksIcon,
  gap_fill: TextCursorInputIcon,
  matching: ArrowLeftRightIcon,
  sentence_builder: ShuffleIcon,
  categorize: LayoutGridIcon,
  true_false: CheckCheckIcon,
  flashcards: LayersIcon,
  free_writing: PenLineIcon,
  quiz_game: TimerIcon,
  memory_match: BrainIcon,
  word_search: SearchIcon,
  dialogue_order: MessagesSquareIcon,
  dictation: EarIcon,
  speed_round: ZapIcon,
  hangman: SpellCheckIcon,
  anagram: CaseUpperIcon,
  spot_mistake: SearchXIcon,
  highlight_words: HighlighterIcon,
  crossword: Grid3x3Icon,
}

/**
 * Every block type, in two groups, one tap away. A palette that stays open at the side
 * of the canvas is the other option; it costs a column on every screen for something
 * used a few times per lesson.
 */
export function BlockPalette({ onPick, t }: { onPick: (type: BlockType) => void; t: Messages }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="corner-brackets">
          <PlusIcon />
          {t.library.editor.addBlock}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-56">
        <PaletteGroup
          label={t.library.editor.groups.presentation}
          types={PRESENTATION_BLOCK_TYPES}
          onPick={onPick}
          t={t}
        />
        <DropdownMenuSeparator />
        <PaletteGroup
          label={t.library.editor.groups.exercise}
          types={EXERCISE_BLOCK_TYPES}
          onPick={onPick}
          t={t}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Module-level on purpose: a component defined inside another's render is remade on every pass. */
function PaletteGroup({
  label,
  types,
  onPick,
  t,
}: {
  label: string
  types: readonly BlockType[]
  onPick: (type: BlockType) => void
  t: Messages
}) {
  return (
    <DropdownMenuGroup>
      <DropdownMenuLabel className="text-muted-foreground text-[11px] font-medium uppercase">
        {label}
      </DropdownMenuLabel>

      {types.map((type) => {
        const Icon = ICONS[type]

        return (
          <DropdownMenuItem key={type} onSelect={() => onPick(type)}>
            <Icon />
            {t.library.editor.blocks[type]}
          </DropdownMenuItem>
        )
      })}
    </DropdownMenuGroup>
  )
}
