'use client'

import { useState, useTransition } from 'react'
import { Loader2Icon, XIcon } from 'lucide-react'
import { toast } from 'sonner'
import type { EndedLink } from '@tp/shared'
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
import type { EndLinkResult } from '../actions'

/**
 * The small × at the end of a person's row. Hidden until the row is hovered, like every
 * other row control here, and confirmed before it does anything: ending a link cancels the
 * lessons planned under it and withdraws open homework, and a row that vanishes on a stray
 * click is the kind of thing that gets reported as data loss.
 *
 * The confirmation says what will happen; the toast afterwards says what did, in numbers.
 */
export function EndLinkButton({
  label,
  confirm,
  onEnd,
  success,
  failure,
}: {
  label: string
  confirm: { title: string; description: string; cancel: string; confirm: string }
  onEnd: () => Promise<EndLinkResult>
  /** The headline, and the counts under it when the answer carried them. */
  success: (ended: EndedLink | null) => { title: string; description?: string }
  failure: (error: NonNullable<EndLinkResult['error']>) => string
}) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={pending}
        aria-label={label}
        title={label}
        onClick={() => setOpen(true)}
        className="text-muted-foreground hover:text-destructive data-pending:opacity-100 size-6 shrink-0 opacity-0 transition-opacity focus-visible:opacity-100 group-hover/person:opacity-100 max-sm:opacity-100"
        data-pending={pending ? '' : undefined}
      >
        {pending ? (
          <Loader2Icon className="size-3.5 animate-spin" />
        ) : (
          <XIcon className="size-3.5" />
        )}
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirm.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{confirm.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                startTransition(async () => {
                  // A failed request answers in a toast like a refusal does. Thrown out of
                  // a transition, it would take the whole page down to its error screen.
                  const result = await onEnd().catch((): EndLinkResult => ({ error: 'internal' }))

                  if (result.error) {
                    toast.error(failure(result.error))
                    return
                  }

                  // Ended, whether or not the answer said what it took with it.
                  const { title, description } = success(result.ended ?? null)
                  toast.success(title, { description })
                })
              }
            >
              {confirm.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
