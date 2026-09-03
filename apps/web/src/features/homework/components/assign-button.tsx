'use client'

import { useState } from 'react'
import { SendIcon } from 'lucide-react'
import type { MaterialOwner } from '@tp/shared'
import { Button } from '@/components/ui/button'
import type { Messages } from '@/messages'
import { AssignDialog } from './assign-dialog'

/** The lesson page's own way in to "give this lesson to…". */
export function AssignButton({
  materialId,
  recipients,
  t,
}: {
  materialId: string
  recipients: MaterialOwner[]
  t: Messages
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="corner-brackets"
      >
        <SendIcon />
        {t.homework.assign}
      </Button>

      <AssignDialog
        open={open}
        onOpenChange={setOpen}
        materialId={materialId}
        recipients={recipients}
        t={t}
      />
    </>
  )
}
