'use client'

import Link from 'next/link'
import { ArrowRightIcon, CopyIcon, RadioIcon, SquareIcon } from 'lucide-react'
import { toast } from 'sonner'
import { PLATFORM_TIME_ZONE } from '@tp/shared'
import { Button } from '@/components/ui/button'
import { RefreshDashboard } from '@/features/admin-dashboard/components/refresh-dashboard'
import { useLiveLauncher } from './live-launcher'

export function ActiveLessonCard({ locale, home = false }: { locale: string; home?: boolean }) {
  const { session, failed, pending, end, t } = useLiveLauncher()
  if (failed)
    return (
      <section
        role="alert"
        className="flex items-center justify-between gap-4 rounded-xl border p-5"
      >
        <div>
          <h2 className="text-sm font-semibold">{t.teacherLive.activeFailed}</h2>
          <p className="text-muted-foreground mt-1 text-xs">{t.teacherLive.activeFailedHint}</p>
        </div>
        <RefreshDashboard label={t.common.retry} />
      </section>
    )

  if (!session)
    return (
      <section className="bg-card flex flex-col gap-5 rounded-xl border p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-start gap-4">
          <span className="bg-primary/10 text-primary flex size-11 shrink-0 items-center justify-center rounded-xl">
            <RadioIcon className="size-5" />
          </span>
          <div>
            <h2 className="font-semibold">{t.teacherLive.ready}</h2>
            <p className="text-muted-foreground mt-1.5 max-w-lg text-sm leading-relaxed">
              {t.liveDesk.homeHint}
            </p>
          </div>
        </div>
        <Button asChild className="corner-brackets">
          <Link href={home ? '/dashboard/live' : '#prepare'}>
            {t.liveDesk.prepareTitle}
            <ArrowRightIcon />
          </Link>
        </Button>
      </section>
    )

  return (
    <section className="border-primary/25 bg-primary/[0.025] overflow-hidden rounded-xl border">
      <div className="flex flex-col gap-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-primary flex items-center gap-2 text-xs font-medium">
            <span className="bg-primary size-1.5 rounded-full" />
            {t.teacherLive.active}
          </h2>
          <span className="text-muted-foreground text-xs">
            {t.teacherLive.started}{' '}
            {new Intl.DateTimeFormat(locale, {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
              timeZone: PLATFORM_TIME_ZONE,
            }).format(new Date(session.startedAt))}
          </span>
        </div>
        <div className="flex items-start gap-3">
          <span className="bg-background text-primary flex size-11 shrink-0 items-center justify-center rounded-xl border">
            <RadioIcon className="size-5" />
          </span>
          <div className="min-w-0">
            <h3 className="break-words text-lg font-semibold tracking-tight">
              {session.material.title}
            </h3>
            <p className="text-muted-foreground mt-1 text-xs">
              {session.material.level} · {session.material.stepCount} {t.library.card.steps}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild className="corner-brackets">
            <Link href={`/live/${session.id}`}>
              {t.live.continue}
              <ArrowRightIcon />
            </Link>
          </Button>
          <Button
            variant="outline"
            className="corner-brackets"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(
                  new URL(`/live/${session.id}`, window.location.origin).href,
                )
                toast.success(t.live.linkCopied)
              } catch {
                toast.error(t.teacherLive.copyFailed)
              }
            }}
          >
            <CopyIcon />
            {t.live.copyLink}
          </Button>
          <Button
            variant="ghost"
            className="corner-brackets text-muted-foreground sm:ml-auto"
            disabled={!!pending}
            onClick={end}
          >
            <SquareIcon className="size-3" />
            {t.live.end}
          </Button>
        </div>
      </div>
      <div className="border-primary/15 border-t px-5 py-4 sm:px-6">
        {session.invitations.length ? (
          <>
            <p className="text-muted-foreground mb-3 text-xs">{t.liveDesk.invitationsTitle}</p>
            <ul className="grid gap-2 sm:grid-cols-2">
              {session.invitations.map((invitation) => (
                <li
                  key={invitation.student.id}
                  className="bg-background/70 flex min-w-0 items-center justify-between gap-2 rounded-lg border px-3 py-2"
                >
                  <span className="truncate text-xs font-medium">
                    {invitation.student.fullName || invitation.student.email}
                  </span>
                  <span className="text-muted-foreground shrink-0 text-[11px]">
                    {invitation.status === 'pending' && invitation.readAt
                      ? t.liveDesk.invitationSeen
                      : t.liveDesk.invitationStatus[invitation.status]}
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-muted-foreground text-xs">{t.teacherLive.shareHint}</p>
        )}
      </div>
    </section>
  )
}
