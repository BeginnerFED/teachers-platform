'use client'

import type { CSSProperties } from 'react'
import type { ErrorInfo } from 'next/error'
import { SectionError } from '@/components/section-error'
import './globals.css'

/**
 * For a failure in the root layout itself, which no other boundary sits above. It replaces
 * the whole document, so it brings its own html and body and the stylesheet with them.
 *
 * The typeface and the chosen brand colour are both set up by that layout, so this page
 * goes without them: the system's own sans, and the stylesheet's default colours.
 */
export default function GlobalError(props: ErrorInfo) {
  return (
    <html lang="uk" style={{ '--font-sans': 'system-ui, sans-serif' } as CSSProperties}>
      <body className="flex min-h-svh items-center justify-center p-6">
        <main className="w-full max-w-md">
          <SectionError {...props} />
        </main>
      </body>
    </html>
  )
}
