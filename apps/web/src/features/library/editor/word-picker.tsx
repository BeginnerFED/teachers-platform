'use client'

import { cn } from '@/lib/utils'

/**
 * A sentence or passage whose words are buttons. The author points at the ones that
 * matter — the mistake, the adjectives — and the block remembers their positions. The
 * same picture the student will get, with the answer lit up for the person writing it.
 */
export function WordPicker({
  words,
  selected,
  onToggle,
  tone = 'primary',
  className,
}: {
  words: string[]
  selected: number[]
  onToggle: (index: number) => void
  /** Red for "this one is the mistake", primary for "these are the ones to find". */
  tone?: 'primary' | 'destructive'
  className?: string
}) {
  const chosen = new Set(selected)

  return (
    <p className={cn('text-[15px] leading-loose', className)}>
      {words.map((word, index) => (
        <button
          key={index}
          type="button"
          onClick={() => onToggle(index)}
          className={cn(
            'mr-1.5 rounded px-1 transition-colors',
            chosen.has(index)
              ? tone === 'destructive'
                ? 'bg-destructive/10 text-destructive ring-destructive/60 ring-1'
                : 'bg-primary/15 ring-primary ring-1'
              : 'hover:bg-muted decoration-dotted underline-offset-4 hover:underline',
          )}
        >
          {word}
        </button>
      ))}
    </p>
  )
}
