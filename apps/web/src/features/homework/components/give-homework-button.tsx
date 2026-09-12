'use client'

import { useState } from 'react'
import { PlusIcon } from 'lucide-react'
import type { MaterialOwner } from '@tp/shared'
import { Button } from '@/components/ui/button'
import type { Messages } from '@/messages'
import { AssignDialog } from './assign-dialog'

/**
 * The desk's one filled action, level with its title. Opens the same dialog a lesson's
 * page does, minus the lesson — which it asks for first.
 */
export function GiveHomeworkButton({
  recipients,
  t,
}: {
  recipients: MaterialOwner[]
  t: Messages
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button type="button" className="corner-brackets" onClick={() => setOpen(true)}>
        <PlusIcon />
        {t.homework.assign}
      </Button>

      <AssignDialog open={open} onOpenChange={setOpen} recipients={recipients} t={t} />
    </>
  )
}
