'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
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
import { withdrawAssignment } from '../actions'

/**
 * The question before homework is taken back. Asked the same way from the row's menu and
 * from the work's own page, because the student's answers go with it either way.
 */
export function WithdrawDialog({
  open,
  onOpenChange,
  assignmentId,
  onDone,
  t,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  assignmentId: string
  /** After it is gone: the page decides where that leaves the reader. */
  onDone?: () => void
  t: Messages
}) {
  const [, startTransition] = useTransition()

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="rounded-2xl p-7">
        <AlertDialogHeader>
          <AlertDialogTitle>{t.homework.confirmWithdraw.title}</AlertDialogTitle>
          <AlertDialogDescription>{t.homework.confirmWithdraw.body}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t.homework.confirmWithdraw.cancel}</AlertDialogCancel>
          <AlertDialogAction
            className="bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950/70"
            onClick={() =>
              startTransition(async () => {
                const { error } = await withdrawAssignment(assignmentId)

                if (error) {
                  toast.error(t.homework.failed)
                  return
                }

                toast.success(t.homework.withdrawn)
                onDone?.()
              })
            }
          >
            {t.homework.confirmWithdraw.confirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
