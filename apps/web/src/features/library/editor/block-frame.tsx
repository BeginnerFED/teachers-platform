'use client'

import type { ReactNode } from 'react'
import { Trash2Icon } from 'lucide-react'
import { GRADED_BLOCK_TYPES, type BlockDraft } from '@tp/shared'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { Messages } from '@/messages'

const GRADED = new Set<string>(GRADED_BLOCK_TYPES)

/**
 * What the canvas puts around a block: as little as possible. The block itself is drawn
 * exactly as the player draws it, so the frame adds no border and no header row of its
 * own. What it adds only appears while the pointer is over the block — a handle in the
 * left margin, and a small capsule at the top right naming the block, saying whether a
 * student would see it yet, and holding its points and its delete.
 */
export function BlockFrame({
  draft,
  complete,
  handle,
  onDelete,
  onPoints,
  t,
  className,
  children,
}: {
  draft: BlockDraft
  complete: boolean
  /** The drag handle, already wired by whatever makes the frame sortable. */
  handle: ReactNode
  onDelete: () => void
  onPoints: (points: number | undefined) => void
  t: Messages
  className?: string
  children: ReactNode
}) {
  const graded = GRADED.has(draft.type)
  const points = typeof draft.points === 'number' ? draft.points : undefined

  return (
    <div
      className={cn(
        'group/block relative -mx-3 rounded-lg px-3 py-2 transition-[outline-color]',
        'hover:outline-border focus-within:outline-border outline-1 outline-transparent',
        // Dashed, faintly, always: an unfinished block is not an error, but it is not
        // yet part of the lesson either, and the author should be able to tell at a glance.
        !complete && 'outline-border/70 outline-dashed',
        className,
      )}
    >
      {handle}

      <div className="bg-background absolute -top-3 right-3 z-10 flex items-center gap-1 rounded-md border px-1.5 py-0.5 opacity-0 shadow-sm transition-opacity focus-within:opacity-100 group-hover/block:opacity-100 max-sm:opacity-100">
        <span className="text-muted-foreground px-1 text-[10px] font-medium uppercase tracking-wide">
          {t.library.editor.blocks[draft.type]}
        </span>

        {!complete ? (
          <Badge
            variant="outline"
            title={t.library.editor.incompleteHint}
            className="text-muted-foreground px-1.5 py-0 text-[10px] font-normal"
          >
            {t.library.editor.incomplete}
          </Badge>
        ) : null}

        {graded ? (
          <label className="text-muted-foreground flex items-center gap-1 pl-1 text-[10px]">
            {t.library.editor.fields.points}
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              max={100}
              value={points ?? ''}
              placeholder="—"
              onChange={(event) =>
                onPoints(event.target.value === '' ? undefined : Number(event.target.value))
              }
              className="h-5 w-12 px-1 text-center text-[11px] tabular-nums"
            />
          </label>
        ) : null}

        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t.library.editor.deleteBlock}
          onClick={onDelete}
          className="text-muted-foreground hover:text-destructive size-6"
        >
          <Trash2Icon className="size-3.5" />
        </Button>
      </div>

      {children}
    </div>
  )
}
