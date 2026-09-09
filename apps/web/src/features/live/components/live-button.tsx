'use client'

import Link from 'next/link'
import { useTransition } from 'react'
import { Loader2Icon, RadioIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import type { Messages } from '@/messages'
import { startLive } from '../actions'

/**
 * The lesson page's way into a live lesson. Opens a room and walks the teacher into it;
 * if they already have one open on this lesson, it goes there instead of opening a second.
 */
export function LiveButton({
  materialId,
  openSessionId,
  t,
}: {
  materialId: string
  /** The host's room already open on this lesson, if any. */
  openSessionId: string | null
  t: Messages
}) {
  const [pending, startTransition] = useTransition()

  if (openSessionId) {
    return (
      <Button asChild variant="outline">
        <Link href={`/live/${openSessionId}`}>
          <RadioIcon className="text-red-500" />
          {t.live.continue}
        </Link>
      </Button>
    )
  }

  return (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const { error } = await startLive(materialId)
          if (error) toast.error(t.live.failed)
        })
      }
    >
      {pending ? <Loader2Icon className="animate-spin" /> : <RadioIcon />}
      {pending ? t.live.starting : t.live.start}
    </Button>
  )
}
