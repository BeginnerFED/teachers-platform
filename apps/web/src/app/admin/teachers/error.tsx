'use client'

import { Button } from '@/components/ui/button'
import { uk } from '@/messages'

/**
 * Renders inside the layout, so it replaces the content and leaves the sidebar alone.
 *
 * Error boundaries are client components, so this reads the Ukrainian dictionary
 * directly rather than through getMessages. Production is always Ukrainian anyway; the
 * only cost is that the development Turkish toggle does not reach this screen.
 */
export default function TeachersError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-start gap-4 rounded-md border p-8">
      <p className="text-sm">{uk.errors.internal}</p>
      <Button variant="outline" onClick={reset}>
        {uk.common.retry}
      </Button>
    </div>
  )
}
