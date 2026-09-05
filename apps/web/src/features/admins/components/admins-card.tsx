'use client'

import { UserMinusIcon } from 'lucide-react'
import { useTransition } from 'react'
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
  AlertDialogTrigger,
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
import type { NewAccountState } from '@/features/accounts/action-state'
import { NewAccountDialog } from '@/features/accounts/components/new-account-dialog'
import { formatJoinedAt } from '@/lib/format'
import type { Messages } from '@/messages'
import { initialAdminActionState } from '../action-state'
import { inviteAdmin, revokeAdmin } from '../actions'

// Same construction as the subscription badges: one hue, border at half the text's
// strength, so a status reads as a label rather than a block of colour.
const PENDING_BADGE = 'border-current/50 bg-amber-50 text-amber-700'
const ACTIVE_BADGE = 'border-current/50 bg-emerald-50 text-emerald-700'

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
                  {/* No button on your own row at all. An action that only ever answers
                      "you cannot do that" is worse than one that is not offered. */}
                  {admin.isSelf ? null : (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={pending}
                          aria-label={t.admins.remove}
                          title={t.admins.remove}
                          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        >
                          <UserMinusIcon />
                        </Button>
                      </AlertDialogTrigger>

                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t.admins.removeConfirm.title}</AlertDialogTitle>
                          <AlertDialogDescription>
                            {t.admins.removeConfirm.description}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t.admins.removeConfirm.cancel}</AlertDialogCancel>
                          <AlertDialogAction onClick={() => remove(admin.id)}>
                            {t.admins.removeConfirm.confirm}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
