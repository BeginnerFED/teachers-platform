'use client'

import { MoreHorizontalIcon } from 'lucide-react'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import type { TeacherListItem } from '@tp/shared'
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
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Messages } from '@/messages'
import { initialTeacherActionState, type TeacherActionState } from '../action-state'
import { extendSubscription, reactivateSubscription, suspendSubscription } from '../actions'

type Action = (prev: TeacherActionState, formData: FormData) => Promise<TeacherActionState>

export function TeacherRowActions({ teacher, t }: { teacher: TeacherListItem; t: Messages }) {
  const [pending, startTransition] = useTransition()
  const [confirmingSuspend, setConfirmingSuspend] = useState(false)

  function submit(action: Action, extra: Record<string, string> = {}) {
    const formData = new FormData()
    formData.set('teacherId', teacher.id)
    for (const [key, value] of Object.entries(extra)) formData.set(key, value)

    startTransition(async () => {
      const result = await action(initialTeacherActionState, formData)

      // The action hands back a code, never a sentence, so the wording is chosen here
      // from the same dictionary as the rest of the interface.
      if (result.error) toast.error(t.errors[result.error])
      else if (result.done) toast.success(t.teachers.toast[result.done])
    })
  }

  const status = teacher.subscription?.status

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8" disabled={pending}>
            <MoreHorizontalIcon />
            <span className="sr-only">{t.teachers.actions.menu}</span>
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onSelect={() => submit(extendSubscription, { months: '1' })}>
            {t.teachers.actions.extend}
          </DropdownMenuItem>

          {status === 'suspended' ? (
            <DropdownMenuItem onSelect={() => submit(reactivateSubscription)}>
              {t.teachers.actions.reactivate}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              variant="destructive"
              disabled={status === 'canceled'}
              onSelect={() => setConfirmingSuspend(true)}
            >
              {t.teachers.actions.suspend}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Suspending takes someone's ability to work away mid-lesson, so it asks first. */}
      <AlertDialog open={confirmingSuspend} onOpenChange={setConfirmingSuspend}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.teachers.suspendConfirm.title}</AlertDialogTitle>
            <AlertDialogDescription>{t.teachers.suspendConfirm.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.teachers.suspendConfirm.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={() => submit(suspendSubscription)}>
              {t.teachers.suspendConfirm.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
