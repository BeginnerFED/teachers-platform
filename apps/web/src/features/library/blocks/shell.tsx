import type { ReactNode } from 'react'
import type { BlockResult } from '@tp/shared'
import { cn } from '@/lib/utils'

/**
 * The frame every exercise sits in: a small label saying what kind of task this is, the
 * author's prompt, the task itself, and — once marked — the score and any explanation.
 *
 * The label matters more than it looks. A page of mixed exercises with no labels reads as
 * one long undifferentiated form, and a student stops knowing what is being asked of them.
 *
 * `prompt` and `hint` take nodes as well as strings: the editor draws this exact frame
 * around an exercise being written, with the prompt as a field you type into. That is what
 * makes the canvas look like the lesson — the same shell, the same classes.
 */
export function ExerciseShell({
  label,
  prompt,
  hint,
  result,
  children,
  className,
}: {
  label: string
  prompt?: ReactNode
  hint?: ReactNode
  result?: BlockResult
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('rounded-lg border p-4 sm:p-5', className)}>
      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">
          {label}
        </span>

        {result && !result.manual ? (
          <span
            className={cn(
              'lesson-score-enter text-xs font-medium tabular-nums',
              result.score === result.max ? 'text-emerald-600' : 'text-destructive',
            )}
          >
            {result.score} / {result.max}
          </span>
        ) : null}
      </header>

      {prompt ? <div className="mb-3 text-sm font-medium">{prompt}</div> : null}
      {hint ? <div className="text-muted-foreground mb-3 text-xs">{hint}</div> : null}

      {children}

      {/* Held back until the answer is in, which is the only moment an explanation
          teaches rather than gives the game away. */}
      {result?.explanation ? (
        <p className="lesson-feedback-enter text-muted-foreground mt-4 border-t pt-3 text-sm">
          {result.explanation}
        </p>
      ) : null}
    </section>
  )
}
