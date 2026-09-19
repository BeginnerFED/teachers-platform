'use client'

import type { ReactNode } from 'react'
import { CopyIcon, CornerDownRightIcon, Trash2Icon } from 'lucide-react'
import type { BlockDraft } from '@tp/shared'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type { Messages } from '@/messages'

/**
 * What the canvas puts around a block: as little as possible. The block itself is drawn
 * exactly as the player draws it, so the frame adds no border and no header row of its
 * own. What it adds only appears while the pointer is over the block — a handle in the
 * left margin, and a small capsule at the top right naming the block, saying whether a
 * student would see it yet, and holding what can be done to it: duplicate, move to
 * another step, delete.
 */
export function BlockFrame({
  draft,
  complete,
  handle,
  moveTargets,
  onDelete,
  onDuplicate,
  onMove,
  t,
  className,
  children,
}: {
  draft: BlockDraft
  complete: boolean
  /** The drag handle, already wired by whatever makes the frame sortable. */
  handle: ReactNode
  /** The other steps of the lesson, to move this block into. */
  moveTargets: { id: string; title: string | null }[]
  onDelete: () => void
  onDuplicate: () => void
  onMove: (stepId: string) => void
  t: Messages
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        'group/block relative -mx-3 rounded-xl px-3 py-2 transition-[outline-color]',
        'hover:outline-border/70 focus-within:outline-border/70 outline-1 outline-transparent',
        // Dashed, faintly, always: an unfinished block is not an error, but it is not
        // yet part of the lesson either, and the author should be able to tell at a glance.
        !complete && 'outline-border/70 outline-dashed',
        className,
      )}
    >
      {handle}

      {/* Stays while its menu is open, when the pointer has left the block for the menu. */}
      <div className="bg-background border-border/60 has-data-[state=open]:opacity-100 absolute -top-3 right-3 z-10 flex items-center gap-0.5 rounded-full border px-2 py-0.5 opacity-0 shadow-sm transition-opacity focus-within:opacity-100 group-hover/block:opacity-100 max-sm:opacity-100">
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

        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t.library.editor.duplicate}
          title={t.library.editor.duplicate}
          onClick={onDuplicate}
          className="text-muted-foreground hover:text-foreground size-6"
        >
          <CopyIcon className="size-3.5" />
        </Button>

        {moveTargets.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t.library.editor.moveTo}
                title={t.library.editor.moveTo}
                className="text-muted-foreground hover:text-foreground size-6"
              >
                <CornerDownRightIcon className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="text-muted-foreground text-[11px] font-medium uppercase">
                {t.library.editor.moveTo}
              </DropdownMenuLabel>
              {moveTargets.map((target, index) => (
                <DropdownMenuItem key={target.id} onSelect={() => onMove(target.id)}>
                  <span className="text-muted-foreground w-4 text-xs tabular-nums">
                    {index + 1}
                  </span>
                  <span className={cn('truncate', !target.title && 'italic opacity-70')}>
                    {target.title || t.library.detail.untitledStep}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}

        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t.library.editor.deleteBlock}
          title={t.library.editor.deleteBlock}
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
