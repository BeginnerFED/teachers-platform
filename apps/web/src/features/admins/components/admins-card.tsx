'use client'

import { CheckIcon, CopyIcon, PlusIcon, UserMinusIcon } from 'lucide-react'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatJoinedAt } from '@/lib/format'
import type { Messages } from '@/messages'
import { initialAdminActionState } from '../action-state'
import { inviteAdmin, revokeAdmin } from '../actions'

// Same construction as the subscription badges: one hue, border at half the text's
// strength, so a status reads as a label rather than a block of colour.
const PENDING_BADGE = 'border-current/50 bg-amber-50 text-amber-700'
const ACTIVE_BADGE = 'border-current/50 bg-emerald-50 text-emerald-700'

/** The password panel the dialog turns into once the account exists. */
function CreatedPanel({
  password,
  email,
  t,
  onDone,
}: {
  password: string
  email: string
  t: Messages
  onDone: () => void
}) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(password)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard access can be refused outright. The password is on screen and
      // selectable either way, so there is nothing to recover from and nothing to say.
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t.admins.created.title}</DialogTitle>
        <DialogDescription>{t.admins.created.description}</DialogDescription>
      </DialogHeader>

      <div className="bg-muted/40 grid gap-3 rounded-lg border p-4">
        <div className="grid gap-1">
          <span className="text-muted-foreground text-xs">{t.admins.columns.email}</span>
          <span className="text-sm font-medium break-all">{email}</span>
        </div>

        <div className="grid gap-1">
          <span className="text-muted-foreground text-xs">{t.admins.created.password}</span>
          <div className="flex items-center gap-2">
            <code className="bg-background flex-1 rounded-md border px-3 py-2 font-mono text-sm break-all select-all">
              {password}
            </code>
            <Button type="button" variant="outline" size="icon" onClick={copy} className="shrink-0">
              {copied ? <CheckIcon /> : <CopyIcon />}
              <span className="sr-only">
                {copied ? t.admins.created.copied : t.admins.created.copy}
              </span>
            </Button>
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button type="button" onClick={onDone} className="corner-brackets">
          {t.admins.created.done}
        </Button>
      </DialogFooter>
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
  const [open, setOpen] = useState(false)
  const [created, setCreated] = useState<{ email: string; temporaryPassword: string } | null>(null)
  const [pending, startTransition] = useTransition()

  function invite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)

    startTransition(async () => {
      const result = await inviteAdmin(initialAdminActionState, formData)

      if (result.error) {
        toast.error(
          result.error === 'conflict' ? t.admins.invite.duplicate : t.errors[result.error],
        )
        return
      }

      // The dialog stays open and changes what it is showing. Closing it here would throw
      // away the only copy of the password that will ever exist.
      setCreated(result.invited)
    })
  }

  function remove(adminId: string) {
    const formData = new FormData()
    formData.set('adminId', adminId)

    startTransition(async () => {
      const result = await revokeAdmin(initialAdminActionState, formData)

      if (result.error) {
        toast.error(
          result.error === 'rule_violation'
            ? t.admins.cannotRemoveSelf
            : t.errors[result.error],
        )
        return
      }

      toast.success(t.admins.removed)
    })
  }

  function close(next: boolean) {
    setOpen(next)
    if (!next) setCreated(null)
  }

  return (
    <Card id={id} className="scroll-mt-24">
      <CardHeader className="border-b">
        <CardTitle>{t.admins.title}</CardTitle>
        <CardDescription>{t.admins.description}</CardDescription>

        <CardAction>
          <Dialog open={open} onOpenChange={close}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(true)}
              className="corner-brackets"
            >
              <PlusIcon />
              {t.admins.add}
            </Button>

            <DialogContent>
              {created ? (
                <CreatedPanel
                  password={created.temporaryPassword}
                  email={created.email}
                  t={t}
                  onDone={() => close(false)}
                />
              ) : (
                <form onSubmit={invite} className="grid gap-6">
                  <DialogHeader>
                    <DialogTitle>{t.admins.invite.title}</DialogTitle>
                    <DialogDescription>{t.admins.invite.description}</DialogDescription>
                  </DialogHeader>

                  <div className="grid gap-5">
                    <Field>
                      <FieldLabel htmlFor="inviteFullName">{t.admins.invite.fullName}</FieldLabel>
                      <Input id="inviteFullName" name="fullName" maxLength={120} required />
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="inviteEmail">{t.admins.invite.email}</FieldLabel>
                      <Input id="inviteEmail" name="email" type="email" required />
                    </Field>
                  </div>

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => close(false)}>
                      {t.admins.invite.cancel}
                    </Button>
                    <Button type="submit" disabled={pending} className="corner-brackets">
                      {pending ? t.admins.invite.submitting : t.admins.invite.submit}
                    </Button>
                  </DialogFooter>
                </form>
              )}
            </DialogContent>
          </Dialog>
        </CardAction>
      </CardHeader>

      <CardContent className="px-0">
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

            {admins.length <= 1 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={5}
                  className="text-muted-foreground px-(--card-spacing) py-6 text-center text-sm"
                >
                  {t.admins.empty}
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
