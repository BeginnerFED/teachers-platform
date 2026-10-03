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
import { usePathname, useRouter } from 'next/navigation'
import { BellIcon, CalendarDaysIcon, ClipboardListIcon } from 'lucide-react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { toast } from 'sonner'
import { PLATFORM_TIME_ZONE, type Role, type StudyUpdate } from '@tp/shared'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { createClient } from '@/lib/supabase/client'
import { startOfWeek, toIsoDate, toZoned } from '@/lib/zoned-time'
import type { Messages } from '@/messages'
import { readStudyUpdates } from '../actions'

type RefreshOptions = { force?: boolean; silent?: boolean }
type Feed = {
  role: Role
  items: StudyUpdate[]
  failed: boolean
  /** Messages waiting in the inbox, for the mark beside it in the sidebar. */
  unreadMessages: number
  refresh: (options?: RefreshOptions) => Promise<void>
  markRead: () => void
}
const Context = createContext<Feed | null>(null)
export const useStudyUpdates = () => useContext(Context)

/**
 * Realtime hands back the channel it already holds for a topic, and a channel that is still
 * leaving never joins again. A section's shell mounts while the shell of the section just
 * left is still taking its channel down, so with one topic between them the new shell took
 * that channel over and heard nothing pushed to it from then on. Each mount asks for a topic
 * of its own; the changes it listens for are filtered by account, not by topic.
 */
let mounts = 0

function hrefFor(item: StudyUpdate, role: Role) {
  if (item.kind === 'lesson_removed') return '/student/calendar'
  if (item.kind === 'homework_removed') return '/student/homework'
  if (item.kind.startsWith('homework_')) return `/student/homework/${item.entityId}`
  const week = item.scheduledAt
    ? toIsoDate(startOfWeek(toZoned(new Date(item.scheduledAt), PLATFORM_TIME_ZONE)))
    : ''
  const calendar =
    role === 'student'
      ? '/student/calendar'
      : role === 'teacher'
        ? '/dashboard/calendar'
        : '/admin/calendar'
  return `${calendar}?${new URLSearchParams({ week, lesson: item.entityId })}`
}

export function StudyUpdatesProvider({
  initial,
  unreadMessages,
  accountId,
  role,
  t,
  children,
}: {
  initial: StudyUpdate[] | null
  /**
   * Messages waiting when the layout rendered. The poll below brings the count along, so
   * the sidebar's mark stays current while a page stays open.
   */
  unreadMessages: number
  accountId: string
  role: Role
  t: Messages
  children: ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [items, setItems] = useState(initial ?? [])
  const [failed, setFailed] = useState(initial === null)
  const [pending, transition] = useTransition()
  const seen = useRef(new Map((initial ?? []).map((item) => [item.id, item.updatedAt])))
  const loaded = useRef(initial !== null)
  const request = useRef<AbortController | null>(null)
  const mounted = useRef(false)
  /**
   * The inbox keeps itself current: its own poll fetches the page again whenever anything
   * in it moves, the sidebar's mark included. Asking on a timer here as well, or fetching
   * the page again for a notification the inbox does not show, would be traffic for
   * nothing. The bell still hears of what is pushed to it, and asks when the tab returns.
   */
  const inInbox = useRef(pathname.startsWith('/inbox'))
  /** The count the layout last rendered, for matching a poll's answer against. */
  const rendered = useRef(unreadMessages)
  /**
   * A poll's answer, kept with the rendered count it was asked against. Whichever is newer
   * wins: the answer stands until the layout renders a different count, and that render
   * stands until the next poll. An answer still on its way when the layout rendered is
   * older than the render, so it is set aside too.
   */
  const [polled, setPolled] = useState<{ rendered: number; unread: number } | null>(null)
  /**
   * The words for a toast, read when one is shown. Every render of the layout hands over a
   * fresh copy of them, and a poll that depended on that copy was torn down and set up
   * again each time the page was fetched: the channel joined afresh, and one more request.
   */
  const copy = useRef(t)
  useEffect(() => {
    copy.current = t
    inInbox.current = pathname.startsWith('/inbox')
    rendered.current = unreadMessages
  }, [t, pathname, unreadMessages])
  const refresh = useCallback(
    async (options?: RefreshOptions) => {
      if (document.visibilityState === 'hidden') return
      if (request.current && !options?.force) return
      request.current?.abort()
      const controller = new AbortController()
      request.current = controller
      const against = rendered.current
      try {
        const response = await fetch('/api/notifications', {
          cache: 'no-store',
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]),
        })
        if (!response.ok) throw new Error('Updates unavailable')
        const { data, unread } = (await response.json()) as {
          data: StudyUpdate[]
          /** Null when the inbox could not be read, which leaves the mark as it was. */
          unread: number | null
        }
        if (!mounted.current || controller.signal.aborted) return
        if (typeof unread === 'number') setPolled({ rendered: against, unread })
        let changed = [...seen.current.keys()].some((id) => !data.some((item) => item.id === id))
        for (const item of data) {
          if (seen.current.get(item.id) !== item.updatedAt) {
            changed = true
            if (loaded.current && !item.readAt && !options?.silent)
              toast(copy.current.studentHome.notificationKinds[item.kind], {
                description: item.title ?? undefined,
                action: {
                  label: copy.current.homework.open,
                  onClick: () => router.push(hrefFor(item, role)),
                },
              })
          }
        }
        seen.current = new Map(data.map((item) => [item.id, item.updatedAt]))
        loaded.current = true
        setItems(data)
        setFailed(false)
        if (changed && !inInbox.current) router.refresh()
      } catch {
        if (mounted.current && !controller.signal.aborted) setFailed(true)
      } finally {
        if (request.current === controller) request.current = null
      }
    },
    [role, router],
  )
  useEffect(() => {
    mounted.current = true
    const supabase = createClient()
    let open = true
    let channel: RealtimeChannel | null = null
    // Joined only once the socket holds this person's token. A channel that asks before then
    // joins as nobody in particular, whom these tables are closed to, and the server refuses
    // it their changes: the bell went on hearing nothing but its own timer.
    void supabase.realtime
      .setAuth()
      .catch(() => undefined)
      .then(() => {
        if (!open) return
        let joining = supabase.channel(`study-updates:${accountId}:${++mounts}`)
        if (role === 'student')
          joining = joining.on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'student_notifications',
              filter: `student_id=eq.${accountId}`,
            },
            () => void refresh(),
          )
        channel = joining
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'notification_preferences',
              filter: `profile_id=eq.${accountId}`,
            },
            () => void refresh({ force: true, silent: true }),
          )
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'scheduled_reminders',
              filter: `recipient_id=eq.${accountId}`,
            },
            () => void refresh(),
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') void refresh()
          })
      })
    const focus = () => void refresh()
    const initialRefresh = setTimeout(focus, 0)
    const timer = setInterval(() => {
      if (!inInbox.current) focus()
    }, 15000)
    window.addEventListener('focus', focus)
    window.addEventListener('online', focus)
    document.addEventListener('visibilitychange', focus)
    return () => {
      open = false
      mounted.current = false
      request.current?.abort()
      request.current = null
      clearTimeout(initialRefresh)
      clearInterval(timer)
      window.removeEventListener('focus', focus)
      window.removeEventListener('online', focus)
      document.removeEventListener('visibilitychange', focus)
      if (channel) void supabase.removeChannel(channel)
    }
  }, [accountId, role, refresh])
  function markRead() {
    const unread = items.filter((item) => !item.readAt)
    if (!unread.length || pending) return
    transition(async () => {
      try {
        const result = await readStudyUpdates(
          unread.map(({ id, updatedAt }) => ({ id, updatedAt })),
        )
        if (!result.error)
          setItems((current) =>
            current.map((item) =>
              unread.some((read) => read.id === item.id && read.updatedAt === item.updatedAt)
                ? { ...item, readAt: new Date().toISOString() }
                : item,
            ),
          )
        else toast.error(t.reminders.readFailed)
      } catch {
        toast.error(t.reminders.readFailed)
      }
    })
  }
  const waiting = polled?.rendered === unreadMessages ? polled.unread : unreadMessages
  return (
    <Context.Provider value={{ role, items, failed, unreadMessages: waiting, refresh, markRead }}>
      {children}
    </Context.Provider>
  )
}

export function StudyUpdatesList({ t, onNavigate }: { t: Messages; onNavigate: () => void }) {
  const feed = useStudyUpdates()
  if (!feed) return null
  return (
    <div className="border-t">
      <div className="px-4 py-3">
        <h3 className="text-sm font-semibold">
          {feed.role === 'student' ? t.studentHome.updates : t.reminders.title}
        </h3>
        <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
          {feed.role === 'student' ? t.studentHome.updatesHint : t.reminders.hint}
        </p>
      </div>
      {feed.failed && (
        <div role="alert" className="px-4 pb-3">
          <p className="text-muted-foreground text-xs">{t.studentHome.loadingFailed}</p>
          <Button
            variant="ghost"
            size="sm"
            className="corner-brackets mt-2"
            onClick={() => void feed.refresh()}
          >
            {t.common.retry}
          </Button>
        </div>
      )}
      {!feed.items.length && !feed.failed && (
        <p className="text-muted-foreground px-4 pb-5 text-xs">{t.studentHome.noUpdates}</p>
      )}
      <ul className="divide-y">
        {feed.items.map((item) => {
          const Icon = item.kind.startsWith('lesson_') ? CalendarDaysIcon : ClipboardListIcon
          return (
            <li key={item.id}>
              <Link
                onClick={onNavigate}
                href={hrefFor(item, feed.role)}
                className="hover:bg-muted/60 focus-visible:ring-ring flex gap-3 px-4 py-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset"
              >
                <Icon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-medium">
                    {t.studentHome.notificationKinds[item.kind]}
                  </p>
                  <p className="text-muted-foreground mt-1 break-words text-xs">
                    {item.title || t.studentHome.lesson}
                  </p>
                  {item.scheduledAt && (
                    <p className="text-muted-foreground mt-1 text-xs tabular-nums">
                      {new Intl.DateTimeFormat('uk-UA', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                        timeZone: PLATFORM_TIME_ZONE,
                      }).format(new Date(item.scheduledAt))}
                    </p>
                  )}
                </div>
                {!item.readAt && (
                  <span className="bg-primary mt-1 size-1.5 shrink-0 rounded-full" />
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function ReminderNotificationBell({ t }: { t: Messages }) {
  const feed = useStudyUpdates()
  const [open, setOpen] = useState(false)
  if (!feed) return null
  const count = feed.items.filter((item) => !item.readAt).length
  return (
    <Popover
      open={open}
      onOpenChange={(value) => {
        setOpen(value)
        if (value) {
          feed.markRead()
          void feed.refresh()
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={`${t.studentHome.notifications}${count ? ` (${count})` : ''}`}
        >
          <BellIcon className="size-4" />
          {count > 0 && (
            <span className="bg-primary text-primary-foreground absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full px-1 text-[10px]">
              {count}
            </span>
          )}
          {feed.failed && (
            <span className="bg-muted-foreground absolute right-0.5 top-0.5 size-1.5 rounded-full" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="max-h-[75dvh] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto p-0"
      >
        <StudyUpdatesList t={t} onNavigate={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  )
}
