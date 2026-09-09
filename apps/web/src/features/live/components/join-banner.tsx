import Link from 'next/link'
import { ArrowRightIcon } from 'lucide-react'
import type { LiveSession } from '@tp/shared'
import { Button } from '@/components/ui/button'
import type { Messages } from '@/messages'

/**
 * On a student's home: the rooms open for them right now, each one line and one button.
 * Nothing when there is none — an empty "no live lessons" box is furniture.
 */
export function JoinBanner({ sessions, t }: { sessions: LiveSession[]; t: Messages }) {
  if (sessions.length === 0) return null

  return (
    <ul className="flex flex-col gap-2">
      {sessions.map((session) => (
        <li
          key={session.id}
          className="animate-rise-in flex flex-wrap items-center gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 motion-reduce:animate-none dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-100"
        >
          <span className="relative flex size-2 shrink-0">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-500 opacity-60 motion-reduce:animate-none" />
            <span className="relative inline-flex size-2 rounded-full bg-red-500" />
          </span>

          <span className="min-w-0 flex-1">
            <span className="font-medium">{t.live.join.title}:</span> {session.material.title}{' '}
            <span className="text-sky-700/80 dark:text-sky-200/80">
              {t.live.join.with} {session.teacher.fullName ?? session.teacher.email}
            </span>
          </span>

          <Button asChild>
            <Link href={`/live/${session.id}`}>
              {t.live.join.button}
              <ArrowRightIcon />
            </Link>
          </Button>
        </li>
      ))}
    </ul>
  )
}
