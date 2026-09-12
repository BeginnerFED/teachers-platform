'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FileTextIcon, Loader2Icon, RadioIcon } from 'lucide-react'
import { toast } from 'sonner'
import type { CalendarLesson, HostedLiveSession, MaterialListItem } from '@tp/shared'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { launchLive } from '@/features/live/actions'
import { LiveMaterialDialog } from '@/features/live/components/live-material-dialog'
import type { Messages } from '@/messages'

function LaunchDialog({
  lesson,
  t,
  onClose,
}: {
  lesson: CalendarLesson
  t: Messages
  onClose: () => void
}) {
  const [snapshot] = useState(lesson)
  const [material, setMaterial] = useState<MaterialListItem | null>(null)
  const [picking, setPicking] = useState(false)
  const [host, setHost] = useState<{
    session: HostedLiveSession | null
    loaded: boolean
    failed: boolean
  }>({ session: null, loaded: false, failed: false })
  const [retry, setRetry] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [pending, transition] = useTransition()
  const locked = useRef(false)
  const router = useRouter()
  const copy = t.calendar.live
  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/live/host', { signal: controller.signal, cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Host unavailable')
        const result = await response.json()
        if (!controller.signal.aborted)
          setHost({ session: result.data, loaded: true, failed: false })
      })
      .catch(() => {
        if (!controller.signal.aborted) setHost({ session: null, loaded: true, failed: true })
      })
    return () => controller.abort()
  }, [retry])

  function start() {
    if (!material || !host.loaded || host.failed || locked.current) return
    locked.current = true
    transition(async () => {
      try {
        setError(null)
        const result = await launchLive(material.id, host.session?.id ?? null, undefined, {
          lessonId: snapshot.id,
          expectedLessonUpdatedAt: snapshot.updatedAt,
        })
        if (result.error || !result.data) {
          setError(
            result.error === 'lesson_time_conflict'
              ? t.liveDesk.tracking.timeConflict
              : result.error === 'conflict'
                ? copy.changed
                : result.error === 'rule_violation'
                  ? copy.notScheduled
                  : t.errors[result.error ?? 'internal'],
          )
          if (result.error === 'conflict') router.refresh()
          return
        }
        toast.success(t.liveDesk.invited.replace('{count}', String(snapshot.students.length)))
        router.push(`/live/${result.data.id}`)
        onClose()
      } catch {
        setError(t.errors.upstream_unavailable)
      } finally {
        locked.current = false
      }
    })
  }
  const resuming = host.session?.calendarLesson?.id === snapshot.id
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !locked.current) onClose()
      }}
    >
      <DialogContent
        showCloseButton={!pending}
        className="max-h-[85dvh] overflow-y-auto sm:max-w-lg"
      >
        <DialogHeader>
          <DialogTitle>{copy.start}</DialogTitle>
          <DialogDescription>{copy.hint}</DialogDescription>
        </DialogHeader>
        <div className="bg-muted/30 space-y-2 rounded-xl border p-3">
          <p className="text-sm font-medium">{snapshot.topic || t.lessons.noTopic}</p>
          <p className="text-muted-foreground text-xs">
            {snapshot.students.map((student) => student.fullName || student.email).join(', ')}
          </p>
        </div>
        {!host.loaded ? (
          <p className="text-muted-foreground flex items-center gap-2 text-xs">
            <Loader2Icon className="size-4 animate-spin" />
            {t.common.loading}
          </p>
        ) : host.failed ? (
          <div role="alert" className="space-y-2">
            <p className="text-destructive text-xs">{t.teacherLive.activeFailedHint}</p>
            <Button
              variant="outline"
              className="corner-brackets"
              onClick={() => {
                setHost({ session: null, loaded: false, failed: false })
                setRetry((n) => n + 1)
              }}
            >
              {t.common.retry}
            </Button>
          </div>
        ) : resuming ? (
          <Button asChild className="corner-brackets">
            <Link href={`/live/${host.session!.id}`}>
              <RadioIcon />
              {t.teacherLive.resume}
            </Link>
          </Button>
        ) : (
          <>
            <Button
              variant="outline"
              className="corner-brackets h-auto min-h-12 w-full justify-start whitespace-normal py-3 text-left"
              disabled={pending}
              onClick={() => setPicking(true)}
            >
              <FileTextIcon className="shrink-0" />
              <span className="min-w-0 break-words">{material?.title || t.teacherLive.choose}</span>
            </Button>
            <p className="text-muted-foreground text-xs">{t.liveDesk.notificationHint}</p>
            {host.session && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                {t.liveDesk.replaceBody.replace('{current}', host.session.material.title)}
              </p>
            )}
          </>
        )}
        {error && (
          <p role="alert" className="text-destructive text-xs">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            className="corner-brackets"
            disabled={pending}
            onClick={onClose}
          >
            {t.accounts.form.cancel}
          </Button>
          {!resuming && (
            <Button
              className="corner-brackets"
              disabled={pending || !material || !host.loaded || host.failed}
              onClick={start}
            >
              {pending ? <Loader2Icon className="animate-spin" /> : <RadioIcon />}
              {host.session ? t.teacherLive.replaceConfirm : t.liveDesk.startAndInvite}
            </Button>
          )}
        </DialogFooter>
        {picking && (
          <LiveMaterialDialog
            initial={null}
            selectedId={material?.id}
            onSelect={setMaterial}
            onClose={() => setPicking(false)}
            t={t}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
export function StartScheduledLive({ lesson, t }: { lesson: CalendarLesson; t: Messages }) {
  const [open, setOpen] = useState(false)
  if (lesson.status !== 'scheduled') return null
  if (lesson.liveSession?.status === 'active')
    return (
      <Button asChild className="corner-brackets w-full">
        <Link href={`/live/${lesson.liveSession.id}`}>
          <RadioIcon />
          {t.teacherLive.resume}
        </Link>
      </Button>
    )
  return (
    <>
      <Button
        className="corner-brackets w-full"
        disabled={!lesson.students.length}
        onClick={() => setOpen(true)}
      >
        <RadioIcon />
        {t.calendar.live.start}
      </Button>
      {open && <LaunchDialog lesson={lesson} t={t} onClose={() => setOpen(false)} />}
    </>
  )
}
