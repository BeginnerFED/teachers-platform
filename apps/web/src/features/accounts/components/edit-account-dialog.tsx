'use client'

import { useTransition } from 'react'
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
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import type { Messages } from '@/messages'
import { updateAccount } from '../actions'

/**
 * A name or an address, corrected. Only what actually changed is sent: the address in
 * particular is an auth change, and re-sending an unchanged one would be a change for
 * nothing.
 */
export function EditAccountDialog({
  open,
  onOpenChange,
  account,
  onSaved,
  t,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  account: AccountSummary
  onSaved?: () => void
  t: Messages
}) {
  const [pending, startTransition] = useTransition()

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)

    const fullName = String(formData.get('fullName') ?? '').trim()
    const email = String(formData.get('email') ?? '')
      .trim()
      .toLowerCase()

    const patch = {
      ...(fullName !== (account.fullName ?? '') ? { fullName } : {}),
      ...(email !== account.email ? { email } : {}),
    }

    if (Object.keys(patch).length === 0) {
      onOpenChange(false)
      return
    }

    startTransition(async () => {
      const { error } = await updateAccount(account.id, patch)

      if (error) {
        toast.error(error === 'conflict' ? t.accounts.edit.duplicate : t.errors[error])
        return
      }

      toast.success(t.accounts.edit.saved)
      onSaved?.()
      onOpenChange(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-6">
          <DialogHeader>
            <DialogTitle>{t.accounts.edit.title}</DialogTitle>
            <DialogDescription>{t.accounts.edit.description}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-5">
            <Field>
              <FieldLabel htmlFor="editFullName">{t.accounts.form.fullName}</FieldLabel>
              <Input
                id="editFullName"
                name="fullName"
                defaultValue={account.fullName ?? ''}
                maxLength={120}
                required
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="editEmail">{t.accounts.form.email}</FieldLabel>
              <Input
                id="editEmail"
                name="email"
                type="email"
                defaultValue={account.email}
                required
              />
            </Field>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t.accounts.edit.cancel}
            </Button>
            <Button type="submit" disabled={pending} className="corner-brackets">
              {pending ? t.accounts.edit.saving : t.accounts.edit.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
