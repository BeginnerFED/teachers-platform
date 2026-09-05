'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { CopyIcon, Loader2Icon, RotateCcwIcon, Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'
import type { MaterialListItem } from '@tp/shared'
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
import { cn } from '@/lib/utils'
import type { Messages } from '@/messages'
import { copyMaterial, deleteMaterial, restoreMaterial } from '../actions'

/**
 * A material has exactly one thing you can do to it from outside: put it back if it is in
 * the bin, delete it if it is yours, copy it if it is not. A menu holding one item is a
 * door with a single room behind it, so this is the button itself — icon and name on the
 * lesson's page, the icon alone on a card, where the card is the name.
 *
 * While the request is out, the icon becomes a spinner and the button marks itself
 * `data-pending`, which lets whatever contains it — the card, the page — fade on that
 * mark with a :has() rule and no state lifted out of here.
 */
export function MaterialActions({
  material,
  t,
  compact = false,
}: {
  material: MaterialListItem
  t: Messages
  /** Icon only, for a card. */
  compact?: boolean
}) {
  const [confirming, setConfirming] = useState(false)
  const [pending, startTransition] = useTransition()
  const pathname = usePathname()
  const router = useRouter()

  // Deleting the lesson whose page you are standing on: the page has nothing left to
  // show, so it goes back to the shelf rather than staying open on a bin item.
  const onOwnPage = pathname === `/library/${material.id}`

  const run = (
    action: () => Promise<{ error: string | null }>,
    success: string | null,
    { leave = false } = {},
  ) =>
    startTransition(async () => {
      const { error } = await action()

      if (error) {
        toast.error(t.library.toast.failed)
        return
      }

      if (success) toast.success(success)
      if (leave) router.push('/library')
    })

  const action =
    material.deletedAt !== null
      ? {
          icon: RotateCcwIcon,
          label: t.library.actions.restore,
          destructive: false,
          onClick: () => run(() => restoreMaterial(material.id), t.library.toast.restored),
        }
      : material.canEdit
        ? {
            icon: Trash2Icon,
            label: t.library.actions.delete,
            destructive: true,
            onClick: () => setConfirming(true),
          }
        : {
            // Copying redirects into the new copy, so it never reports success here.
            icon: CopyIcon,
            label: t.library.actions.copyToMine,
            destructive: false,
            onClick: () => run(() => copyMaterial(material.id), null),
          }

  const Icon = pending ? Loader2Icon : action.icon

  return (
    <>
      <Button
        type="button"
        variant={compact ? 'ghost' : 'outline'}
        size={compact ? 'icon' : 'default'}
        disabled={pending}
        aria-busy={pending || undefined}
        data-pending={pending ? '' : undefined}
        aria-label={compact ? action.label : undefined}
        onClick={action.onClick}
        className={cn(
          'relative z-10',
          compact && 'text-muted-foreground size-7',
          // Destructive is quiet red text, not a red button.
          action.destructive &&
            'text-red-700 hover:text-red-700 dark:text-red-300 dark:hover:text-red-300',
        )}
      >
        <Icon className={cn('size-4', pending && 'animate-spin')} />
        {compact ? null : action.label}
      </Button>

      {/* Confirmed rather than undone: an undo toast that is missed leaves a teacher
          hunting for a lesson they do not know is in the bin. */}
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.library.confirmDelete.title}</AlertDialogTitle>
            <AlertDialogDescription>{t.library.confirmDelete.body}</AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>{t.library.confirmDelete.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                run(() => deleteMaterial(material.id), t.library.toast.deleted, {
                  leave: onOwnPage,
                })
              }
            >
              {t.library.confirmDelete.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
