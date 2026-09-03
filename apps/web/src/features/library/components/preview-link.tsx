'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Loader2Icon, PlayIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { flushPendingSaves } from '../editor/editor-flush'

/**
 * "Preview" that first makes sure there is nothing left to save. A plain link raced the
 * autosave: click within a second of typing and the preview rendered the lesson without
 * the last thing typed — and the save itself was sometimes lost with the page.
 */
export function PreviewLink({ href, label }: { href: string; label: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await flushPendingSaves()
          router.push(href)
        })
      }
      className="corner-brackets"
    >
      {pending ? <Loader2Icon className="animate-spin" /> : <PlayIcon />}
      {label}
    </Button>
  )
}
