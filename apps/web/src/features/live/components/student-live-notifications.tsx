'use client'

import Link from 'next/link'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from 'react'
import { useRouter } from 'next/navigation'
import { BellIcon, RadioIcon, ArrowRightIcon, RefreshCwIcon } from 'lucide-react'
import { toast } from 'sonner'
import type { StudentLiveInvitation } from '@tp/shared'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { createClient } from '@/lib/supabase/client'
import type { Messages } from '@/messages'
import { readLiveInvitations, respondToLiveInvitation } from '../actions'
import {
  StudyUpdatesList,
  useStudyUpdates,
} from '@/features/student-dashboard/components/study-updates'

type Feed = {
  invitations: StudentLiveInvitation[]
  failed: boolean
  refresh: () => Promise<void>
  markRead: () => void
  decline: (id: string) => void
  pending: boolean
  t: Messages
}
const Context = createContext<Feed | null>(null)

export function StudentLiveProvider({
  initial,
  accountId,
  t,
  children,
}: {
  initial: StudentLiveInvitation[] | null
  accountId: string
  t: Messages
  children: ReactNode
}) {
  const router = useRouter()
  const [invitations, setInvitations] = useState(initial ?? [])
  const [failed, setFailed] = useState(initial === null)
  const [pending, transition] = useTransition()
  const seen = useRef(new Set((initial ?? []).map((item) => item.session.id)))
  const request = useRef<AbortController | null>(null)
  const mounted = useRef(false)
  const refresh = useCallback(async () => {
    if (request.current || document.visibilityState === 'hidden') return
    const controller = new AbortController()
    request.current = controller
    try {
      const response = await fetch('/api/live/invitations', {
        signal: controller.signal,
        cache: 'no-store',
      })
      if (!response.ok) throw new Error('Invitations unavailable')
      const { data } = (await response.json()) as { data: StudentLiveInvitation[] }
      if (!mounted.current || controller.signal.aborted) return
      for (const invitation of data) {
        if (!seen.current.has(invitation.session.id) && !invitation.readAt) {
          toast(t.liveNotifications.received, {
            description: `${invitation.session.teacher.fullName || invitation.session.teacher.email} · ${invitation.session.material.title}`,
            action: {
              label: t.live.join.button,
              onClick: () => router.push(`/live/${invitation.session.id}`),
            },
          })
        }
        seen.current.add(invitation.session.id)
      }
      setInvitations(data)
      setFailed(false)
    } catch {
      if (mounted.current && !controller.signal.aborted) setFailed(true)
    } finally {
      if (request.current === controller) request.current = null
    }
  }, [router, t])
  useEffect(() => {
    mounted.current = true
    const supabase = createClient()
    const channel = supabase
      .channel(`live-invitations:${accountId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_invitations',
          filter: `student_id=eq.${accountId}`,
        },
        () => void refresh(),
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') void refresh()
      })
    const interval = setInterval(() => void refresh(), 10000)
    const focus = () => void refresh()
    window.addEventListener('focus', focus)
    document.addEventListener('visibilitychange', focus)
    const initialRefresh = setTimeout(() => void refresh(), 0)
    return () => {
      mounted.current = false
      clearTimeout(initialRefresh)
      request.current?.abort()
      request.current = null
      clearInterval(interval)
      window.removeEventListener('focus', focus)
      document.removeEventListener('visibilitychange', focus)
      void supabase.removeChannel(channel)
    }
  }, [accountId, refresh])
  function markRead() {
    const ids = invitations.filter((item) => !item.readAt).map((item) => item.session.id)
    if (!ids.length || pending) return
    transition(async () => {
      try {
        const result = await readLiveInvitations(ids)
        if (!result.error)
          setInvitations((current) =>
            current.map((item) =>
              ids.includes(item.session.id) ? { ...item, readAt: new Date().toISOString() } : item,
            ),
          )
      } catch {
        /* The unread badge remains until the next successful read. */
      }
    })
  }
  function decline(id: string) {
    if (pending) return
    transition(async () => {
      try {
        const result = await respondToLiveInvitation(id, 'declined')
        if (result.error) {
          toast.error(t.errors[result.error])
          void refresh()
        } else setInvitations((current) => current.filter((item) => item.session.id !== id))
      } catch {
        toast.error(t.live.failed)
      }
    })
  }
  return (
    <Context.Provider value={{ invitations, failed, refresh, markRead, decline, pending, t }}>
      {children}
    </Context.Provider>
  )
}

function InvitationCard({ invitation }: { invitation: StudentLiveInvitation }) {
  const feed = useContext(Context)!
  const { session } = invitation
  return (
    <div className="min-w-0">
      <p className="break-words text-sm font-semibold">{session.material.title}</p>
      <p className="text-muted-foreground mt-1 break-words text-xs">
        {session.teacher.fullName || session.teacher.email}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button asChild className="corner-brackets">
          <Link href={`/live/${session.id}`}>
            {feed.t.live.join.button}
            <ArrowRightIcon className="size-3.5" />
          </Link>
        </Button>
        {invitation.status === 'pending' && (
          <Button
            variant="ghost"
            className="corner-brackets"
            disabled={feed.pending}
            onClick={() => feed.decline(session.id)}
          >
            {feed.t.liveNotifications.decline}
          </Button>
        )}
      </div>
    </div>
  )
}

export function LiveNotificationBell() {
  const feed = useContext(Context)
  const updates = useStudyUpdates()
  const [open, setOpen] = useState(false)
  if (!feed) return null
  const count =
    feed.invitations.filter((item) => !item.readAt).length +
    (updates?.items.filter((item) => !item.readAt).length ?? 0)
  return (
    <Popover
      open={open}
      onOpenChange={(open) => {
        setOpen(open)
        if (open) {
          feed.markRead()
          updates?.markRead()
          void updates?.refresh()
          void feed.refresh()
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={`${feed.t.studentHome.notifications}${count ? ` (${count})` : ''}`}
        >
          <BellIcon className="size-4" />
          {count > 0 && (
            <span className="bg-primary text-primary-foreground absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full px-1 text-[10px]">
              {count}
            </span>
          )}
          {(feed.failed || updates?.failed) && (
            <span className="bg-muted-foreground absolute right-0.5 top-0.5 size-1.5 rounded-full" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="max-h-[75dvh] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto p-0"
      >
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">{feed.t.studentHome.notifications}</h2>
          <p className="text-muted-foreground mt-1 text-xs">{feed.t.liveNotifications.hint}</p>
        </div>
        {feed.failed && (
          <div role="alert" className="flex items-center justify-between gap-2 px-4 py-3">
            <p className="text-muted-foreground text-xs">{feed.t.liveNotifications.failed}</p>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={feed.t.common.retry}
              onClick={() => void feed.refresh()}
            >
              <RefreshCwIcon className="size-3.5" />
            </Button>
          </div>
        )}
        {feed.invitations.length ? (
          <ul className="divide-y">
            {feed.invitations.map((invitation) => (
              <li key={invitation.session.id} className="p-4">
                <InvitationCard invitation={invitation} />
              </li>
            ))}
          </ul>
        ) : (
          !feed.failed && (
            <p className="text-muted-foreground px-4 py-8 text-center text-xs">
              {feed.t.liveNotifications.empty}
            </p>
          )
        )}
        <StudyUpdatesList t={feed.t} onNavigate={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  )
}

export function StudentLiveBanner() {
  const feed = useContext(Context)
  if (!feed) return null
  if (feed.failed && !feed.invitations.length)
    return (
      <div
        role="alert"
        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"
      >
        <p className="text-muted-foreground text-sm">{feed.t.liveNotifications.failed}</p>
        <Button variant="outline" className="corner-brackets" onClick={() => void feed.refresh()}>
          {feed.t.common.retry}
        </Button>
      </div>
    )
  if (!feed.invitations.length) return null
  return (
    <section aria-label={feed.t.liveNotifications.title} className="space-y-3">
      {feed.invitations.map((invitation) => (
        <div
          key={invitation.session.id}
          className="border-primary/25 bg-primary/[0.025] flex items-start gap-4 rounded-xl border p-5"
        >
          <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
            <RadioIcon className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-primary mb-2 text-xs font-medium">
              {feed.t.liveNotifications.received}
            </p>
            <InvitationCard invitation={invitation} />
          </div>
        </div>
      ))}
    </section>
  )
}

/** Uses the same feed as the bell, so a new invitation enables joining immediately. */
export function StudentLessonJoin({
  lessonId,
  hideWaiting = false,
}: {
  lessonId: string
  hideWaiting?: boolean
}) {
  const feed = useContext(Context)
  if (!feed) return null
  const invitation = feed.invitations.find((item) => item.session.calendarLesson?.id === lessonId)
  if (!invitation)
    return hideWaiting ? null : (
      <p className="text-muted-foreground text-xs leading-relaxed">
        {feed.failed ? feed.t.liveNotifications.failed : feed.t.studentHome.waiting}
      </p>
    )
  return (
    <Button asChild size="sm" className="corner-brackets">
      <Link href={`/live/${invitation.session.id}`}>
        <RadioIcon />
        {feed.t.live.join.button}
        <ArrowRightIcon />
      </Link>
    </Button>
  )
}
