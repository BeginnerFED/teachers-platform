'use client'

import { useTransition } from 'react'
import type { ErrorInfo } from 'next/error'
import { Loader2Icon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { shell } from '@/messages/shell'

/**
 * The error screen every section shares. Renders inside the section's layout, so it
 * replaces the content and leaves the sidebar alone.
 *
 * Error boundaries are client components that Next renders with no props of ours, so this
 * reads its two strings straight from the frame's slice of the dictionary. Production is
 * always Ukrainian anyway; the only cost is that the development Turkish toggle does not
 * reach this screen.
 *
 * The button retries rather than resets. Nearly every failure here comes from a server
 * component, and reset only draws the payload that already failed a second time; retry
 * asks the server again first. Inside a transition, so the button can say it is working
 * for as long as that takes.
 */
export function SectionError({ retry }: ErrorInfo) {
  const [pending, startTransition] = useTransition()

  return (
    <div role="alert" className="flex flex-col items-start gap-4 rounded-md border p-8">
      <p className="text-sm">{shell.failed}</p>
      <Button variant="outline" disabled={pending} onClick={() => startTransition(retry)}>
        {pending ? <Loader2Icon className="animate-spin motion-reduce:animate-none" /> : null}
        {shell.retry}
      </Button>
    </div>
  )
}
