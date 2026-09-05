'use client'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import type { Messages } from '@/messages'

/**
 * The one question before something is destroyed, asked the same way whether it is one
 * lesson, a selection or the whole bin. It says what goes: the lessons, and — the part
 * that is easy to forget — every piece of homework that was ever set from them.
 */
export function PurgeDialog({
  open,
  onOpenChange,
  count,
  homework,
  onConfirm,
  t,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Lessons that would go. */
  count: number
  /** Pieces of homework that would go with them. */
  homework: number
  onConfirm: () => void
  t: Messages
}) {
  const copy = t.library.trash.confirmPurge

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{copy.title}</AlertDialogTitle>
          <AlertDialogDescription className="space-y-1">
            <span className="block">{copy.body}</span>
            {count > 1 ? (
              <span className="block tabular-nums">
                {copy.count}: {count}
              </span>
            ) : null}
            {homework > 0 ? (
              <span className="text-destructive block tabular-nums">
                {copy.homework}: {homework}
              </span>
            ) : null}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>{copy.cancel}</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            {copy.confirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
