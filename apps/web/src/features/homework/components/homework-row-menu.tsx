'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ArrowUpRightIcon, MoreHorizontalIcon, Undo2Icon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Messages } from '@/messages'
import { WithdrawDialog } from './withdraw-dialog'

/**
 * The far-right "⋯" of a row. Opening the work is what the row itself does, so it is
 * repeated here only for the keyboard; taking the work back is the rare, destructive
 * thing, and this is where the design language puts those.
 */
export function HomeworkRowMenu({
  assignmentId,
  canWithdraw,
  t,
}: {
  assignmentId: string
  /** Only the teacher who set it, and only while it is still open. */
  canWithdraw: boolean
  t: Messages
}) {
  const [confirming, setConfirming] = useState(false)
  const router = useRouter()

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t.library.actions.more}
            // Above the row's link overlay, and shown only when the row is looked at.
            className="text-muted-foreground data-open:opacity-100 relative z-10 opacity-0 transition-opacity focus-visible:opacity-100 group-hover/row:opacity-100 max-sm:opacity-100"
          >
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="min-w-44">
          <DropdownMenuItem asChild>
            <Link href={`/homework/${assignmentId}`}>
              <ArrowUpRightIcon />
              {t.homework.open}
            </Link>
          </DropdownMenuItem>

          {canWithdraw ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirming(true)}>
                <Undo2Icon />
                {t.homework.withdraw}
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {canWithdraw ? (
        <WithdrawDialog
          open={confirming}
          onOpenChange={setConfirming}
          assignmentId={assignmentId}
          onDone={() => router.refresh()}
          t={t}
        />
      ) : null}
    </>
  )
}
