'use client'

import { cn } from '@/lib/utils'
import { SharedField, SharedTextarea } from './shared-text'
import { ExerciseShell } from './shell'
import { toneFor, type BlockProps } from './types'

/** Blocks answered by typing. */

const asMap = (answer: unknown): Record<string, string> =>
  answer !== null && typeof answer === 'object' && !Array.isArray(answer)
    ? (answer as Record<string, string>)
    : {}

const GAP_TONE = {
  correct: 'border-emerald-500 text-emerald-700 dark:text-emerald-300',
  wrong: 'border-destructive text-destructive line-through decoration-destructive/40',
} as const

export function GapFillBlock({
  block,
  answer,
  onAnswer,
  result,
  locked,
  t,
}: BlockProps<'gap_fill'>) {
  const given = asMap(answer)

  return (
    <ExerciseShell label={t.library.blocks.fillGaps} prompt={block.prompt} result={result}>
      {/* The sentence stays a sentence: gaps sit inline in the text rather than being
          lifted out into a numbered list, which is what makes it a reading task. */}
      <p className="text-[15px] leading-[2.4]">
        {block.segments.map((segment, index) => {
          if (segment.kind === 'text') {
            return (
              <span key={index} className="whitespace-pre-wrap">
                {segment.text}
              </span>
            )
          }

          const tone = toneFor(result, segment.id)
          const value = given[segment.id] ?? ''

          return (
            <SharedField
              key={segment.id}
              value={value}
              disabled={locked}
              onValue={(next) => onAnswer({ ...given, [segment.id]: next })}
              placeholder={segment.hint}
              aria-label={segment.hint ?? t.library.blocks.fillGaps}
              // Grows with what is typed, with a floor wide enough to look like a gap
              // rather than a typo. `ch` because the content is a word, not a box.
              style={{ width: `${Math.max(6, value.length + 2)}ch` }}
              className={cn(
                'border-input focus-visible:border-primary mx-1 border-0 border-b-2 bg-transparent px-1 text-center text-[15px] outline-none',
                tone && GAP_TONE[tone],
              )}
            />
          )
        })}
      </p>
    </ExerciseShell>
  )
}

export function FreeWritingBlock({
  block,
  answer,
  onAnswer,
  result,
  locked,
  t,
}: BlockProps<'free_writing'>) {
  const value = typeof answer === 'string' ? answer : ''
  const words = value.trim() ? value.trim().split(/\s+/).length : 0
  const short = block.minWords !== undefined && words > 0 && words < block.minWords

  return (
    <ExerciseShell
      label={t.library.blocks.writing}
      prompt={block.prompt}
      hint={block.rubric}
      result={result}
    >
      <SharedTextarea
        value={value}
        disabled={locked}
        onValue={onAnswer}
        placeholder={t.library.blocks.writingPlaceholder}
        rows={6}
        className="resize-y"
      />

      <div className="text-muted-foreground mt-2 flex flex-wrap justify-between gap-2 text-xs tabular-nums">
        <span className={cn(short && 'text-amber-600')}>
          {words} {t.library.blocks.words}
          {block.minWords !== undefined ? ` · ${t.library.blocks.minWords} ${block.minWords}` : ''}
          {block.maxWords !== undefined ? `–${block.maxWords}` : ''}
        </span>

        {/* Says plainly that no machine is going to mark this, so the absence of a green
            tick is not read as a wrong answer. */}
        {result?.manual ? <span>{t.library.player.awaitingTeacher}</span> : null}
      </div>
    </ExerciseShell>
  )
}
