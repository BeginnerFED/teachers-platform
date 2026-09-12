'use client'

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from 'react'
import { Loader2Icon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { lessonAttendanceHref } from '@/features/calendar/lesson-link'
import { toast } from 'sonner'
import type { HostedLiveSession } from '@tp/shared'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { Messages } from '@/messages'
import { endLive } from '../actions'

type Host = {
  session: HostedLiveSession | null
  failed: boolean
  pending: boolean
  end: () => void
  t: Messages
}
const Context = createContext<Host | null>(null)
export function useLiveLauncher() {
  const value = useContext(Context)
  if (!value) throw new Error('LiveLaunchProvider is required')
  return value
}
export function LiveLaunchProvider({
  session,
  failed = false,
  t,
  children,
}: {
  session: HostedLiveSession | null
  failed?: boolean
  t: Messages
  children: ReactNode
}) {
  const router = useRouter()
  const [state, setState] = useState({ source: session, sourceFailed: failed, session, failed })
  if (state.source !== session || state.sourceFailed !== failed)
    setState({ source: session, sourceFailed: failed, session, failed })
  const [endingId, setEndingId] = useState<string | null>(null)
  const [pending, transition] = useTransition()
  const locked = useRef(false)
  useEffect(() => {
    let stopped = false
    let controller: AbortController | null = null
    async function refresh() {
      if (document.visibilityState === 'hidden' || controller) return
      controller = new AbortController()
      try {
        const response = await fetch('/api/live/host', {
          signal: controller.signal,
          cache: 'no-store',
        })
        if (!response.ok) throw new Error('Host lookup failed')
        const result = await response.json()
        if (!stopped)
          setState({ source: session, sourceFailed: failed, session: result.data, failed: false })
      } catch {
        if (!stopped) setState((current) => ({ ...current, failed: true }))
      } finally {
        controller = null
      }
    }
    const interval = setInterval(() => void refresh(), 8000)
    const onFocus = () => void refresh()
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      stopped = true
      controller?.abort()
      clearInterval(interval)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [session, failed])
  function finish() {
    if (!endingId || locked.current) return
    const id = endingId
    locked.current = true
    transition(async () => {
      try {
        const result = await endLive(id)
        if (result.error) toast.error(t.live.failed)
        else {
          setState((current) => ({
            ...current,
            session: current.session?.id === id ? null : current.session,
          }))
          toast.success(t.teacherLive.ended)
          if (result.calendarLesson) router.push(lessonAttendanceHref(result.calendarLesson))
        }
      } catch {
        toast.error(t.live.failed)
      } finally {
        locked.current = false
        setEndingId(null)
      }
    })
  }
  return (
    <Context.Provider
      value={{
        session: state.session,
        failed: state.failed,
        pending,
        end: () => {
          if (!locked.current && state.session) setEndingId(state.session.id)
        },
        t,
      }}
    >
      {children}
      <Dialog
        open={!!endingId}
        onOpenChange={(open) => {
          if (!open && !locked.current) setEndingId(null)
        }}
      >
        <DialogContent showCloseButton={!pending}>
          <DialogHeader>
            <DialogTitle>{t.live.confirmEnd.title}</DialogTitle>
            <DialogDescription>{t.live.confirmEnd.body}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              className="corner-brackets"
              disabled={pending}
              onClick={() => setEndingId(null)}
            >
              {t.live.confirmEnd.cancel}
            </Button>
            <Button
              variant="destructive"
              className="corner-brackets"
              disabled={pending}
              onClick={finish}
            >
              {pending && <Loader2Icon className="animate-spin" />}
              {t.live.confirmEnd.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Context.Provider>
  )
}
