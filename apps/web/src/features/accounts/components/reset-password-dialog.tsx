'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import type { AccountSummary } from '@tp/shared'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { Messages } from '@/messages'
import type { NewAccountState } from '../action-state'
import { resetPassword } from '../actions'
import { PasswordPanel } from './password-panel'

/**
 * The way back into an account for somebody who has lost their password. A question
 * first, because the old password stops working the moment this runs; then the new one,
 * shown the way a new account's is — once.
 *
 * Its own dialog rather than an alert: the alert would close on confirm, and closing is
 * the one thing that must not happen while the password is on screen.
 */
export function ResetPasswordDialog({
  open,
  onOpenChange,
  account,
  t,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  account: AccountSummary
  t: Messages
}) {
  const [created, setCreated] = useState<NewAccountState['created']>(null)
  const [pending, startTransition] = useTransition()

  function close(next: boolean) {
    onOpenChange(next)
    if (!next) setCreated(null)
  }

  function confirm() {
    startTransition(async () => {
      const result = await resetPassword(account.id)

      if (result.error) {
        toast.error(t.errors[result.error])
        return
      }

      setCreated(result.created)
    })
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        {created ? (
          <PasswordPanel
            title={t.accounts.reset.done}
            email={created.email}
            password={created.temporaryPassword}
            onDone={() => close(false)}
            t={t}
          />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{t.accounts.reset.title}</DialogTitle>
              <DialogDescription>{t.accounts.reset.description}</DialogDescription>
            </DialogHeader>

            <p className="text-sm">
              <span className="text-muted-foreground">{t.accounts.created.email}: </span>
              <span className="font-medium">{account.email}</span>
            </p>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => close(false)}>
                {t.accounts.reset.cancel}
              </Button>
              <Button
                type="button"
                disabled={pending}
                onClick={confirm}
                className="corner-brackets"
              >
                {pending ? t.accounts.reset.working : t.accounts.reset.confirm}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
