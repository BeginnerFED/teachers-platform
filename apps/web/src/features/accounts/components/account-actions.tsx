'use client'

import { useState } from 'react'
import { KeyRoundIcon, PencilIcon } from 'lucide-react'
import type { AccountSummary } from '@tp/shared'
import { Button } from '@/components/ui/button'
import type { Messages } from '@/messages'
import { EditAccountDialog } from './edit-account-dialog'
import { ResetPasswordDialog } from './reset-password-dialog'

/**
 * The two things an administrator does to an existing account, side by side: fix what it
 * says, or get its owner back in. Drawn as a row of small buttons for the detail panels,
 * where there is a line to put them on.
 */
export function AccountActions({
  account,
  onChanged,
  t,
}: {
  account: AccountSummary
  /** After a change the surrounding panel usually wants to re-read itself. */
  onChanged?: () => void
  t: Messages
}) {
  const [editing, setEditing] = useState(false)
  const [resetting, setResetting] = useState(false)

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setEditing(true)}
        className="h-7 gap-1.5 text-xs"
      >
        <PencilIcon className="size-3.5" />
        {t.accounts.edit.action}
      </Button>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setResetting(true)}
        className="h-7 gap-1.5 text-xs"
      >
        <KeyRoundIcon className="size-3.5" />
        {t.accounts.reset.action}
      </Button>

      <EditAccountDialog
        open={editing}
        onOpenChange={setEditing}
        account={account}
        onSaved={onChanged}
        t={t}
      />
      <ResetPasswordDialog open={resetting} onOpenChange={setResetting} account={account} t={t} />
    </div>
  )
}
