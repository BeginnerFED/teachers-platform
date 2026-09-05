'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Undo2Icon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Messages } from '@/messages'
import { WithdrawDialog } from './withdraw-dialog'

/**
 * Taking homework back, from the work's own page. Quiet — an outline pill beside the
 * title, since the page's one filled action is elsewhere — and it asks first.
 */
export function WithdrawButton({ assignmentId, t }: { assignmentId: string; t: Messages }) {
  const [confirming, setConfirming] = useState(false)
  const router = useRouter()

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setConfirming(true)}
        className="text-muted-foreground hover:text-red-700 dark:hover:text-red-300"
      >
        <Undo2Icon />
        {t.homework.withdraw}
      </Button>

      <WithdrawDialog
        open={confirming}
        onOpenChange={setConfirming}
        assignmentId={assignmentId}
        // The page has nothing left to show, so it goes back to the desk.
        onDone={() => router.push('/homework')}
        t={t}
      />
    </>
  )
}
