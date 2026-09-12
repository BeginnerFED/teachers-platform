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
import { BellIcon, CalendarDaysIcon, ClipboardListIcon } from 'lucide-react'
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
  refresh: (options?: RefreshOptions) => Promise<void>
  markRead: () => void
}
const Context = createContext<Feed | null>(null)
export const useStudyUpdates = () => useContext(Context)

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
  accountId,
  role,
  t,
  children,
}: {
  initial: StudyUpdate[] | null
  accountId: string
  role: Role
  t: Messages
  children: ReactNode
}) {
  const router = useRouter()
  const [items, setItems] = useState(initial ?? [])
  const [failed, setFailed] = useState(initial === null)
  const [pending, transition] = useTransition()
  const seen = useRef(new Map((initial ?? []).map((item) => [item.id, item.updatedAt])))
  const loaded = useRef(initial !== null)
  const request = useRef<AbortController | null>(null)
  const mounted = useRef(false)
  const refresh = useCallback(
    async (options?: RefreshOptions) => {
      if (document.visibilityState === 'hidden') return
      if (request.current && !options?.force) return
      request.current?.abort()
      const controller = new AbortController()
      request.current = controller
      try {
        const response = await fetch('/api/notifications', {
          cache: 'no-store',
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]),
        })
        if (!response.ok) throw new Error('Updates unavailable')
        const { data } = (await response.json()) as { data: StudyUpdate[] }
        if (!mounted.current || controller.signal.aborted) return
        let changed = [...seen.current.keys()].some((id) => !data.some((item) => item.id === id))
        for (const item of data) {
          if (seen.current.get(item.id) !== item.updatedAt) {
            changed = true
            if (loaded.current && !item.readAt && !options?.silent)
              toast(t.studentHome.notificationKinds[item.kind], {
                description: item.title ?? undefined,
                action: { label: t.homework.open, onClick: () => router.push(hrefFor(item, role)) },
              })
          }
        }
        seen.current = new Map(data.map((item) => [item.id, item.updatedAt]))
        loaded.current = true
        setItems(data)
        setFailed(false)
        if (changed) router.refresh()
      } catch {
        if (mounted.current && !controller.signal.aborted) setFailed(true)
      } finally {
        if (request.current === controller) request.current = null
      }
    },
    [role, router, t],
  )
  useEffect(() => {
    mounted.current = true
    const supabase = createClient()
    let channel = supabase.channel(`study-updates:${accountId}`)
    if (role === 'student')
      channel = channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'student_notifications',
          filter: `student_id=eq.${accountId}`,
        },
        () => void refresh(),
      )
    channel = channel
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
    const focus = () => void refresh()
    const initialRefresh = setTimeout(focus, 0)
    const timer = setInterval(focus, 15000)
    window.addEventListener('focus', focus)
    window.addEventListener('online', focus)
    document.addEventListener('visibilitychange', focus)
    return () => {
      mounted.current = false
      request.current?.abort()
      request.current = null
      clearTimeout(initialRefresh)
      clearInterval(timer)
      window.removeEventListener('focus', focus)
      window.removeEventListener('online', focus)
      document.removeEventListener('visibilitychange', focus)
      void supabase.removeChannel(channel)
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
  return (
    <Context.Provider value={{ role, items, failed, refresh, markRead }}>
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
