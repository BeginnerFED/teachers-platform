'use client'

import {
  CopyIcon,
  CornerDownRightIcon,
  GripVerticalIcon,
  PlusIcon,
  Trash2Icon,
  Undo2Icon,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { ExerciseShell } from '@/features/library/blocks/shell'
import { cn } from '@/lib/utils'
import { useAt, useCue } from '../../engine/clock'
import { staggered } from '../../engine/motion'
import { PromoPointer, type PointerStep } from '../../engine/pointer'
import { SceneFrame } from '../../engine/scene-frame'
import type { EditorCopy } from './copy'
import { GAP_WORDS, LESSON, rawText, tokenise } from './data'

/**
 * The scene's moments, in ms from its start. The fragment arrives at 1060 and has settled
 * by 1340. The house curve covers most of a move early, so the arrow is over its word
 * about half way through the move's time, and hovers start there, not at the move's end.
 */
const T = {
  pointerIn: 1680,
  toHave: 1720,
  /** The arrow crosses into the block: the block's hover chrome appears. */
  blockIn: 1780,
  overHave: 1970,
  pressHave: 2290,
  /** The click lands: 'have' is a gap and the block is finished. */
  gapHave: 2390,
  toCard: 2730,
  overCard: 2890,
  pressCard: 3260,
  gapCard: 3360,
  /** The arrow leaves; the block is drawn as the student will see it. */
  leave: 3720,
  /** Autosave waits 800ms after the last edit (step-drafts.ts), then saves. */
  saving: 4160,
  saved: 4440,
} as const

const SCRIPT: PointerStep[] = [
  { at: T.pointerIn, appear: { x: 452, y: 604 } },
  { at: T.toHave, to: 'have', duration: 560 },
  { at: T.pressHave, press: true },
  { at: T.toCard, to: 'card', duration: 480 },
  { at: T.pressCard, press: true },
  { at: T.leave, leave: true },
]

/**
 * The canvas is drawn at the editor's own sizes and shown a little smaller, the way a
 * screenshot is, so the dialogue keeps the two lines it has in the player.
 */
const ZOOM = 0.9

/** inline.tsx's FIELD: a field that looks like the text it holds. */
const FIELD =
  'w-full min-w-0 rounded bg-transparent outline-none transition-colors hover:bg-muted/50 focus:bg-muted/50 focus:ring-2 focus:ring-ring/40 placeholder:text-muted-foreground/50'

const ICON_BUTTON = cn(
  buttonVariants({ variant: 'ghost', size: 'icon' }),
  'text-muted-foreground size-6',
)

/**
 * The lesson editor's step canvas (features/library/editor/step-canvas.tsx) on step 2 of
 * the drafted lesson. Two clicks turn two words into gaps: the block stops being
 * unfinished, and the step saves itself.
 */
export function EditorScene({ copy }: { copy: EditorCopy }) {
  return (
    <SceneFrame title={copy.title} line={copy.line} overlay={<PromoPointer script={SCRIPT} />}>
      {/* The page the canvas sits on. The right side keeps room for the block frame,
          which reaches 12px past the column the way it does in the editor. */}
      <div className="bg-card border-border/60 rounded-2xl border py-5 pl-4 pr-7">
        <div style={{ zoom: ZOOM }}>
          <div className="flex w-full min-w-0 flex-col gap-5">
            <TopRow copy={copy} />

            {/* The player's spacing between blocks, and the gutter the handle lives in. */}
            <div className="animate-rise-in flex flex-col gap-5 pl-6" style={staggered(1)}>
              <GapFillBlock copy={copy} />
            </div>

            <div className="animate-rise-in" style={staggered(2)}>
              <span className={buttonVariants({ variant: 'outline' })}>
                <PlusIcon />
                {copy.addBlock}
              </span>
            </div>
          </div>
        </div>
      </div>
    </SceneFrame>
  )
}

/** The step's title, its undo, and the autosave state. */
function TopRow({ copy }: { copy: EditorCopy }) {
  const edited = useAt(T.gapHave)
  const save = useCue([T.gapHave, T.saving, T.saved])
  const status = [null, copy.status.pending, copy.status.saving, copy.status.saved][save]

  return (
    <div
      className="animate-rise-in flex flex-wrap items-center gap-x-3 gap-y-1"
      style={staggered(0)}
    >
      <div className="-mx-2 min-w-0 flex-1 rounded-lg px-2 py-1 text-lg font-medium tracking-tight">
        {LESSON.stepTitle}
      </div>

      {/* Disabled until there is something to undo. */}
      <span
        className={cn(
          buttonVariants({ variant: 'ghost', size: 'sm' }),
          'text-muted-foreground',
          !edited && 'opacity-50',
        )}
      >
        <Undo2Icon className="size-3.5" />
        {copy.undo}
      </span>

      {status ? (
        <span className="text-muted-foreground shrink-0 text-xs tabular-nums transition-colors">
          {status}
        </span>
      ) : null}
    </div>
  )
}

/** BlockFrame (block-frame.tsx) around the GapFillEditor, with the chrome a hover brings. */
function GapFillBlock({ copy }: { copy: EditorCopy }) {
  const hovered = useCue([T.blockIn, T.leave]) === 1
  const gaps = useCue([T.gapHave, T.gapCard])
  // The word under the arrow, then the gap it became, until the arrow moves off it.
  const over = useCue([T.overHave, T.toCard + 10, T.overCard, T.leave])
  const pointed = over === 1 ? GAP_WORDS[0] : over === 3 ? GAP_WORDS[1] : null

  // A gap-fill needs at least one gap before a student can be given it.
  const complete = gaps > 0
  const raw = rawText(gaps)

  return (
    <div
      data-hover={hovered || undefined}
      className={cn(
        'group/block relative -mx-3 rounded-xl px-3 py-2 transition-[outline-color]',
        'data-[hover]:outline-border/70 outline-1 outline-transparent',
        // Dashed, faintly, always: the block is not part of the lesson yet.
        !complete && 'outline-border/70 outline-dashed',
      )}
    >
      <span className="text-muted-foreground absolute -left-4 top-2.5 rounded p-1 opacity-0 transition-opacity group-data-[hover]/block:opacity-100">
        <GripVerticalIcon className="size-4" />
      </span>

      <div className="bg-background border-border/60 absolute -top-3 right-3 z-10 flex items-center gap-0.5 rounded-full border px-2 py-0.5 opacity-0 shadow-sm transition-opacity group-data-[hover]/block:opacity-100">
        <span className="text-muted-foreground px-1 text-[10px] font-medium uppercase tracking-wide">
          {copy.blockType}
        </span>

        {!complete ? (
          <Badge
            variant="outline"
            className="text-muted-foreground px-1.5 py-0 text-[10px] font-normal"
          >
            {copy.incomplete}
          </Badge>
        ) : null}

        <span className={ICON_BUTTON}>
          <CopyIcon className="size-3.5" />
        </span>
        <span className={ICON_BUTTON}>
          <CornerDownRightIcon className="size-3.5" />
        </span>
        <span className={ICON_BUTTON}>
          <Trash2Icon className="size-3.5" />
        </span>
      </div>

      <ExerciseShell
        label={copy.fillGaps}
        prompt={<div className={cn(FIELD, '-mx-1 px-1')}>{LESSON.prompt}</div>}
      >
        <div className="grid gap-2">
          <GapSentence raw={raw} pointed={pointed} />

          {/* The raw text underneath, for what pointing cannot say. */}
          <div
            className={cn(
              FIELD,
              '-mx-1 resize-none whitespace-pre-wrap px-1',
              'text-muted-foreground font-mono text-xs',
            )}
          >
            {raw}
          </div>

          <p className="text-muted-foreground text-xs">{copy.hint}</p>
        </div>
      </ExerciseShell>
    </div>
  )
}

/**
 * The sentence as the student will see it, every word a button (gap-text.tsx). Words and
 * gaps are inline-blocks, as the buttons they stand for are, so a hover tint and a gap's
 * line sit where the product draws them.
 */
function GapSentence({ raw, pointed }: { raw: string; pointed: string | null }) {
  return (
    <p className="text-[15px] leading-[2.4]">
      {tokenise(raw).map((token, index) => {
        if (token.kind === 'text') {
          return (
            <span key={index} className="whitespace-pre-wrap">
              {token.raw}
            </span>
          )
        }

        if (token.kind === 'word') {
          return (
            <span
              key={index}
              data-anchor={isGapWord(token.raw) ? token.raw : undefined}
              data-hover={pointed === token.raw || undefined}
              className="data-[hover]:decoration-primary data-[hover]:bg-primary/5 inline-block rounded px-0.5 underline decoration-transparent decoration-dotted underline-offset-4 transition-colors"
            >
              {token.raw}
            </span>
          )
        }

        const answer = token.answers[0] ?? '·'

        return (
          <span
            key={index}
            data-anchor={answer}
            data-hover={pointed === answer || undefined}
            className="border-primary data-[hover]:bg-primary/10 mx-1 inline-block min-w-[6ch] border-b-2 px-1 text-center transition-colors"
          >
            {answer}
          </span>
        )
      })}
    </p>
  )
}

function isGapWord(word: string): boolean {
  return (GAP_WORDS as readonly string[]).includes(word)
}
