import type { ReactNode } from 'react'
import { RadioIcon } from 'lucide-react'
import type { Messages } from '@/messages'

/**
 * The frame for somebody who is not signed in — a guest in a live lesson, in by the link.
 * No sidebar, because there is nowhere else for them to go: a bar naming the product and
 * the room, and the same reading column every other page has.
 */
export function PublicShell({ t, children }: { t: Messages; children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
        <span className="text-sm font-semibold tracking-tight">{t.app.name}</span>
        <span className="text-muted-foreground flex items-center gap-1.5 text-sm">
          <span aria-hidden>·</span>
          <RadioIcon className="size-3.5" />
          {t.live.title}
        </span>
      </header>

      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6">
        {children}
      </div>
    </div>
  )
}
