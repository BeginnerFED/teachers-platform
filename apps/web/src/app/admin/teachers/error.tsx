'use client'

import { Button } from '@/components/ui/button'
import { uk } from '@/messages'

/**
 * Error boundaries are client components, so this reads the Ukrainian dictionary
 * directly rather than through getMessages. Production is always Ukrainian anyway; the
 * only cost is that the development Turkish toggle does not reach this screen.
 */
export default function TeachersError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-sm">{uk.errors.internal}</p>
      <Button variant="outline" onClick={reset}>
        {uk.common.retry}
      </Button>
    </main>
  )
}
