'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import {
  CopyIcon,
  Loader2Icon,
  MoreHorizontalIcon,
  PlayIcon,
  SendIcon,
  Trash2Icon,
} from 'lucide-react'
import { toast } from 'sonner'
import type { MaterialListItem, MaterialOwner } from '@tp/shared'
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { AssignDialog } from '@/features/homework/components/assign-dialog'
import { cn } from '@/lib/utils'
import type { Messages } from '@/messages'
import { copyMaterial, deleteMaterial } from '../actions'

/**
 * The "···" on a card: three things you might want without opening the lesson — look at
 * it, give it to a student, or get rid of it (take a copy, if it is not yours). A menu is
 * right here because there are three of them; on the lesson page there is one, and it is
 * a button.
 *
 * Shown on hover, and kept shown while open or busy: a menu whose button fades under the
 * pointer is a menu that seems to have vanished. While a delete or copy is out the icon
 * spins and the button marks itself `data-pending`, which the card fades on.
 */
export function MaterialCardMenu({
  material,
  recipients,
  t,
}: {
  material: MaterialListItem
  recipients: MaterialOwner[]
  t: Messages
}) {
  const [assigning, setAssigning] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [pending, startTransition] = useTransition()

  const run = (action: () => Promise<{ error: string | null }>, success: string | null) =>
    startTransition(async () => {
      const { error } = await action()

      if (error) {
        toast.error(t.library.toast.failed)
        return
      }

      if (success) toast.success(success)
    })

  return (
    <>
      {/* Not modal: a modal menu locks the page's pointer events and the dialog it opens
          would open into that lock. */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={pending}
            aria-busy={pending || undefined}
            aria-label={t.library.actions.more}
            data-pending={pending ? '' : undefined}
            className={cn(
              'text-muted-foreground relative z-10 size-7 transition-opacity',
              'data-pending:opacity-100 opacity-0 focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100 max-sm:opacity-100',
            )}
          >
            {pending ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              <MoreHorizontalIcon className="size-4" />
            )}
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="min-w-44">
          <DropdownMenuItem asChild>
            <Link href={`/library/${material.id}/play`}>
              <PlayIcon />
              {t.library.actions.preview}
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem onSelect={() => setAssigning(true)}>
            <SendIcon />
            {t.homework.assign}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {material.canEdit ? (
            <DropdownMenuItem variant="destructive" onSelect={() => setConfirming(true)}>
              <Trash2Icon />
              {t.library.actions.delete}
            </DropdownMenuItem>
          ) : (
            // Copying redirects into the new copy, so it never reports success here.
            <DropdownMenuItem onSelect={() => run(() => copyMaterial(material.id), null)}>
              <CopyIcon />
              {t.library.actions.copyToMine}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AssignDialog
        open={assigning}
        onOpenChange={setAssigning}
        materialId={material.id}
        recipients={recipients}
        t={t}
      />

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
              onClick={() => run(() => deleteMaterial(material.id), t.library.toast.deleted)}
            >
              {t.library.confirmDelete.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
