'use client'

import type { ComponentProps } from 'react'
import { SectionError } from '@/components/section-error'

/**
 * The inbox's panes have no column around them, so the error is given the margin every
 * other section's column gives it, rather than drawing its border over the pane's edges.
 */
export default function InboxError(props: ComponentProps<typeof SectionError>) {
  return (
    <div className="p-4">
      <SectionError {...props} />
    </div>
  )
}
