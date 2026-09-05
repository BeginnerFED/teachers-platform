'use client'

import { useState, useTransition } from 'react'
import { Loader2Icon, RotateCcwIcon, Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import type { Messages } from '@/messages'
import { purgeBinned, restoreBinned } from '../actions'
import { PurgeDialog } from './purge-dialog'

/**
 * The bin's two whole-bin actions, level with its title: everything back, or everything
 * gone. Neither is offered over an empty bin. Emptying asks first and says what goes.
 */
export function BinHeaderActions({
  count,
  homework,
  t,
}: {
  /** Lessons in the bin. */
  count: number
  /** Pieces of homework set from them, which emptying takes too. */
  homework: number
  t: Messages
}) {
  const [confirming, setConfirming] = useState(false)
  const [pending, startTransition] = useTransition()

  if (count === 0) return null

  const restoreAll = () =>
    startTransition(async () => {
      const { restored, error } = await restoreBinned()

      if (error) {
        toast.error(t.library.toast.failed)
        return
      }

      toast.success(`${t.library.trash.toast.restoredMany}: ${restored}`)
    })

  const emptyBin = () =>
    startTransition(async () => {
      const { error } = await purgeBinned()

      if (error) {
        toast.error(t.library.toast.failed)
        return
      }

      toast.success(t.library.trash.toast.emptied)
    })

  return (
    // Marks itself while a request is out, so the page can fade on the mark.
    <div data-pending={pending ? '' : undefined} className="flex shrink-0 items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={restoreAll}
        className="corner-brackets"
      >
        {pending ? <Loader2Icon className="animate-spin" /> : <RotateCcwIcon />}
        {t.library.trash.restoreAll}
      </Button>

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => setConfirming(true)}
        className="corner-brackets text-destructive hover:text-destructive"
      >
        <Trash2Icon />
        {t.library.trash.empty}
      </Button>

      <PurgeDialog
        open={confirming}
        onOpenChange={setConfirming}
        count={count}
        homework={homework}
        onConfirm={emptyBin}
        t={t}
      />
    </div>
  )
}
