'use client'

import { Button } from '@/components/ui/button'
import { uk } from '@/messages'

export function SectionError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-4 rounded-md border p-8">
      <p className="text-sm">{uk.errors.internal}</p>
      <Button variant="outline" onClick={reset}>
        {uk.common.retry}
      </Button>
    </div>
  )
}
