'use client'

import type { ErrorInfo } from 'next/error'
import { SectionError } from '@/components/section-error'

/**
 * The last boundary inside the root layout. It catches what a section cannot catch for
 * itself — its own layout failing to build the shell, or a page in a section with no
 * boundary of its own — so there is no sidebar left around it, and it stands alone in the
 * middle of the page rather than in the corner where the content column would have been.
 */
export default function RootError(props: ErrorInfo) {
  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <div className="w-full max-w-md">
        <SectionError {...props} />
      </div>
    </main>
  )
}
