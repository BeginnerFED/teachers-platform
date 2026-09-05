'use client'

import { KeyRoundIcon, MoreHorizontalIcon, PencilIcon, UserMinusIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import type { AdminListItem } from '@tp/shared'
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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { NewAccountState } from '@/features/accounts/action-state'
import { EditAccountDialog } from '@/features/accounts/components/edit-account-dialog'
import { NewAccountDialog } from '@/features/accounts/components/new-account-dialog'
import { ResetPasswordDialog } from '@/features/accounts/components/reset-password-dialog'
import { formatJoinedAt } from '@/lib/format'
import type { Messages } from '@/messages'
import { initialAdminActionState } from '../action-state'
import { inviteAdmin, revokeAdmin } from '../actions'

// Same construction as the subscription badges: one hue, border at half the text's
// strength, so a status reads as a label rather than a block of colour.
const PENDING_BADGE = 'border-current/50 bg-amber-50 text-amber-700'
const ACTIVE_BADGE = 'border-current/50 bg-emerald-50 text-emerald-700'

/**
 * What can be done to one administrator's row. For somebody else: a menu of three —
 * fix their details, get them back in, take the role away. For yourself: only the first,
 * as a plain button, because a menu with one thing in it is a door to a single room, and
 * the other two are refused for your own account anyway (your password changes under
 * Settings, and you cannot remove yourself).
 */
function AdminRowActions({
  admin,
  pending,
  onRemove,
  onChanged,
  t,
}: {
  admin: AdminListItem
  pending: boolean
  onRemove: () => void
  onChanged: () => void
  t: Messages
}) {
  const [editing, setEditing] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [confirmingRemove, setConfirmingRemove] = useState(false)

  const account = { id: admin.id, email: admin.email, fullName: admin.fullName }

  return (
    <>
      {admin.isSelf ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t.accounts.edit.action}
          title={t.accounts.edit.action}
          onClick={() => setEditing(true)}
          className="text-muted-foreground"
        >
          <PencilIcon />
        </Button>
      ) : (
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={pending}
              aria-label={t.admins.columns.actions}
              className="text-muted-foreground"
            >
              <MoreHorizontalIcon />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="min-w-48">
            <DropdownMenuItem onSelect={() => setEditing(true)}>
              <PencilIcon />
              {t.accounts.edit.action}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setResetting(true)}>
              <KeyRoundIcon />
              {t.accounts.reset.action}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => setConfirmingRemove(true)}>
              <UserMinusIcon />
              {t.admins.remove}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <EditAccountDialog
        open={editing}
        onOpenChange={setEditing}
        account={account}
        onSaved={onChanged}
        t={t}
      />
      <ResetPasswordDialog open={resetting} onOpenChange={setResetting} account={account} t={t} />

      <AlertDialog open={confirmingRemove} onOpenChange={setConfirmingRemove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.admins.removeConfirm.title}</AlertDialogTitle>
            <AlertDialogDescription>{t.admins.removeConfirm.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.admins.removeConfirm.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={onRemove}>
              {t.admins.removeConfirm.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export function AdminsCard({
  id,
  admins,
  locale,
  t,
}: {
  id: string
  admins: AdminListItem[]
  locale: string
  t: Messages
}) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  // The shared dialog speaks in `created`; this list's action still answers in `invited`,
  // which is the same thing under an older name.
  async function invite(formData: FormData): Promise<NewAccountState> {
    const result = await inviteAdmin(initialAdminActionState, formData)

    return { error: result.error, created: result.invited }
  }

  function remove(adminId: string) {
    const formData = new FormData()
    formData.set('adminId', adminId)

    startTransition(async () => {
      const result = await revokeAdmin(initialAdminActionState, formData)

      if (result.error) {
        toast.error(
          result.error === 'rule_violation' ? t.admins.cannotRemoveSelf : t.errors[result.error],
        )
        return
      }

      toast.success(t.admins.removed)
    })
  }

  return (
    // `pb-0`: the content here is a table, and a table ends at its last row. The card's
    // usual bottom padding left a strip of nothing under it that read as a row that had
    // failed to load — which is exactly what it looked like once the "you are the only
    // administrator" line was taken out.
    <Card id={id} className="scroll-mt-24 pb-0">
      <CardHeader className="border-b">
        <CardTitle>{t.admins.title}</CardTitle>
        <CardDescription>{t.admins.description}</CardDescription>

        <CardAction>
          <NewAccountDialog
            label={t.admins.add}
            title={t.admins.invite.title}
            description={t.admins.invite.description}
            duplicateMessage={t.admins.invite.duplicate}
            action={invite}
            variant="outline"
            t={t}
          />
        </CardAction>
      </CardHeader>

      <CardContent className="px-0 pb-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-(--card-spacing) font-medium">
                {t.admins.columns.name}
              </TableHead>
              <TableHead className="font-medium">{t.admins.columns.email}</TableHead>
              <TableHead className="font-medium">{t.admins.columns.status}</TableHead>
              <TableHead className="font-medium">{t.admins.columns.added}</TableHead>
              <TableHead className="pr-(--card-spacing) w-px text-right font-medium">
                <span className="sr-only">{t.admins.columns.actions}</span>
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {admins.map((admin) => (
              <TableRow key={admin.id}>
                <TableCell className="pl-(--card-spacing) font-medium">
                  {admin.fullName ?? '—'}
                  {admin.isSelf ? (
                    <span className="text-muted-foreground ml-2 text-xs font-normal">
                      ({t.admins.you})
                    </span>
                  ) : null}
                </TableCell>

                <TableCell className="text-muted-foreground">{admin.email}</TableCell>

                <TableCell>
                  <Badge
                    variant="outline"
                    className={admin.invitePending ? PENDING_BADGE : ACTIVE_BADGE}
                  >
                    {admin.invitePending ? t.admins.pending : t.admins.active}
                  </Badge>
                </TableCell>

                <TableCell className="text-muted-foreground tabular-nums">
                  {formatJoinedAt(admin.createdAt, locale)}
                </TableCell>

                <TableCell className="pr-(--card-spacing) text-right">
                  <AdminRowActions
                    admin={admin}
                    pending={pending}
                    onRemove={() => remove(admin.id)}
                    onChanged={() => router.refresh()}
                    t={t}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
