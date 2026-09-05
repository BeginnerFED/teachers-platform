import type { Level } from '@tp/shared'
import { cn } from '@/lib/utils'

/**
 * A CEFR level as a small quiet chip. One shape everywhere a level is shown — on a card,
 * at the top of a lesson, in a picker — so the eye learns it once.
 */
export function LevelChip({ level, className }: { level: Level; className?: string }) {
  return (
    <span
      className={cn(
        'bg-muted text-foreground/80 inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[11px] font-medium leading-4',
        className,
      )}
    >
      {level}
    </span>
  )
}
