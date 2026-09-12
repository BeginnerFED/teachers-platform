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
import { CalendarDaysIcon, ClipboardListIcon } from 'lucide-react'
import { toast } from 'sonner'
import { PLATFORM_TIME_ZONE, type StudyUpdate } from '@tp/shared'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { startOfWeek, toIsoDate, toZoned } from '@/lib/zoned-time'
import type { Messages } from '@/messages'
import { readStudyUpdates } from '../actions'

type Feed = {
  items: StudyUpdate[]
  failed: boolean
  refresh: () => Promise<void>
  markRead: () => void
}
const Context = createContext<Feed | null>(null)
export const useStudyUpdates = () => useContext(Context)

function hrefFor(item: StudyUpdate) {
  if (item.kind === 'lesson_removed') return '/student/calendar'
  if (item.kind === 'homework_removed') return '/student/homework'
  if (item.kind.startsWith('homework_')) return `/student/homework/${item.entityId}`
  const week = item.scheduledAt
    ? toIsoDate(startOfWeek(toZoned(new Date(item.scheduledAt), PLATFORM_TIME_ZONE)))
    : ''
  return `/student/calendar?${new URLSearchParams({ week, lesson: item.entityId })}`
}

export function StudyUpdatesProvider({
  initial,
  accountId,
  t,
  children,
}: {
  initial: StudyUpdate[] | null
  accountId: string
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
  const refresh = useCallback(async () => {
    if (request.current || document.visibilityState === 'hidden') return
    const controller = new AbortController()
    request.current = controller
    try {
      const response = await fetch('/api/student/notifications', {
        cache: 'no-store',
        signal: controller.signal,
      })
      if (!response.ok) throw new Error('Updates unavailable')
      const { data } = (await response.json()) as { data: StudyUpdate[] }
      if (!mounted.current || controller.signal.aborted) return
      let changed = false
      for (const item of data) {
        if (seen.current.get(item.id) !== item.updatedAt) {
          changed = true
          if (loaded.current && !item.readAt)
            toast(t.studentHome.notificationKinds[item.kind], {
              description: item.title ?? undefined,
              action: { label: t.homework.open, onClick: () => router.push(hrefFor(item)) },
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
  }, [router, t])
  useEffect(() => {
    mounted.current = true
    const supabase = createClient()
    const channel = supabase
      .channel(`student-updates:${accountId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'student_notifications',
          filter: `student_id=eq.${accountId}`,
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
    document.addEventListener('visibilitychange', focus)
    return () => {
      mounted.current = false
      request.current?.abort()
      request.current = null
      clearTimeout(initialRefresh)
      clearInterval(timer)
      window.removeEventListener('focus', focus)
      document.removeEventListener('visibilitychange', focus)
      void supabase.removeChannel(channel)
    }
  }, [accountId, refresh])
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
      } catch {
        /* Keep unread markers when the connection fails. */
      }
    })
  }
  return (
    <Context.Provider value={{ items, failed, refresh, markRead }}>{children}</Context.Provider>
  )
}

export function StudyUpdatesList({ t, onNavigate }: { t: Messages; onNavigate: () => void }) {
  const feed = useStudyUpdates()
  if (!feed) return null
  return (
    <div className="border-t">
      <div className="px-4 py-3">
        <h3 className="text-sm font-semibold">{t.studentHome.updates}</h3>
        <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
          {t.studentHome.updatesHint}
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
                href={hrefFor(item)}
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
