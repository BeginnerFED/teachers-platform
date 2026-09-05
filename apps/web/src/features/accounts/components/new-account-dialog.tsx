'use client'

import { useState, useTransition } from 'react'
import { PlusIcon } from 'lucide-react'
import { toast } from 'sonner'
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
import type { NewAccountState } from '../action-state'
import { PasswordPanel } from './password-panel'

/**
 * Making an account for somebody else, wherever that happens: beside the list of teachers,
 * beside the list of students, in the administrators card. One component, because the job
 * is the same one every time — two fields, then a password that is shown once.
 *
 * The dialog does not close on success. It changes what it is showing, because closing it
 * would throw away the only copy of the password that will ever exist.
 */
export function NewAccountDialog({
  label,
  title,
  description,
  duplicateMessage,
  action,
  fields,
  t,
  variant = 'default',
}: {
  /** The trigger's own words — "Add a teacher" reads better than a generic "Add". */
  label: string
  title: string
  description: string
  /** What to say when the address is already registered, in this list's own terms. */
  duplicateMessage: string
  action: (formData: FormData) => Promise<NewAccountState>
  /** Anything one kind of account needs beyond a name and an address. Part of the form. */
  fields?: React.ReactNode
  t: Messages
  variant?: 'default' | 'outline'
}) {
  const [open, setOpen] = useState(false)
  const [created, setCreated] = useState<NewAccountState['created']>(null)
  const [pending, startTransition] = useTransition()

  function close(next: boolean) {
    setOpen(next)
    if (!next) setCreated(null)
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)

    startTransition(async () => {
      const result = await action(formData)

      if (result.error) {
        toast.error(result.error === 'conflict' ? duplicateMessage : t.errors[result.error])
        return
      }

      setCreated(result.created)
    })
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <Button
        type="button"
        variant={variant}
        size="sm"
        onClick={() => setOpen(true)}
        className="corner-brackets"
      >
        <PlusIcon />
        {label}
      </Button>

      <DialogContent>
        {created ? (
          <PasswordPanel
            title={t.accounts.created.title}
            email={created.email}
            password={created.temporaryPassword}
            onDone={() => close(false)}
            t={t}
          />
        ) : (
          <form onSubmit={submit} className="grid gap-6">
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>{description}</DialogDescription>
            </DialogHeader>

            <div className="grid gap-5">
              <Field>
                <FieldLabel htmlFor="newAccountFullName">{t.accounts.form.fullName}</FieldLabel>
                <Input id="newAccountFullName" name="fullName" maxLength={120} required />
              </Field>

              <Field>
                <FieldLabel htmlFor="newAccountEmail">{t.accounts.form.email}</FieldLabel>
                <Input id="newAccountEmail" name="email" type="email" required />
              </Field>

              {fields}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => close(false)}>
                {t.accounts.form.cancel}
              </Button>
              <Button type="submit" disabled={pending} className="corner-brackets">
                {pending ? t.accounts.form.submitting : t.accounts.form.submit}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
