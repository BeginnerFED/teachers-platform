'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CalendarDaysIcon, Loader2Icon, RadioIcon } from 'lucide-react'
import { toast } from 'sonner'
import { PLATFORM_TIME_ZONE, type MaterialListItem, type MaterialOwner } from '@tp/shared'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldLabel } from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { lessonAttendanceHref } from '@/features/calendar/lesson-link'
import type { Messages } from '@/messages'
import { launchLive } from '../actions'
import { prepareLiveLesson } from '../prepare-actions'

type Preparation = NonNullable<Awaited<ReturnType<typeof prepareLiveLesson>>['data']>

export function PrepareTrackedLiveDialog({
  students,
  material,
  locale,
  t,
  onClose,
}: {
  students: MaterialOwner[]
  material: MaterialListItem
  locale: string
  t: Messages
  onClose: () => void
}) {
  const [snapshot] = useState({ students, material })
  const [context, setContext] = useState<Preparation | null>(null)
  const [loading, setLoading] = useState(true)
  const [retry, setRetry] = useState(0)
  const [selectedId, setSelectedId] = useState('')
  const [duration, setDuration] = useState('60')
  const [error, setError] = useState<string | null>(null)
  const [pending, transition] = useTransition()
  const request = useRef<{ key: string; id: string } | null>(null)
  const locked = useRef(false)
  const router = useRouter()
  const copy = t.liveDesk.tracking
  const clock = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: PLATFORM_TIME_ZONE,
  })

  useEffect(() => {
    let stopped = false
    prepareLiveLesson(snapshot.students.map((student) => student.id))
      .then((result) => {
        if (stopped) return
        if (result.error) setError(t.errors[result.error])
        else {
          setContext(result.data)
          // An ambiguous choice belongs to the teacher. Never guess which of two
          // lessons with the same students should consume a credit.
          setSelectedId(
            result.data.lessons.length === 1
              ? result.data.lessons[0].id
              : result.data.lessons.length === 0
                ? 'new'
                : '',
          )
        }
      })
      .catch(() => {
        if (!stopped) setError(t.errors.upstream_unavailable)
      })
      .finally(() => {
        if (!stopped) setLoading(false)
      })
    return () => {
      stopped = true
    }
  }, [snapshot, retry, t])

  function reload() {
    setLoading(true)
    setContext(null)
    setSelectedId('')
    setError(null)
    setRetry((n) => n + 1)
  }
  const selected = context?.lessons.find((lesson) => lesson.id === selectedId)
  const active = context?.session
  const samePeople =
    active?.invitations.length === snapshot.students.length &&
    active.invitations.every((invitation) =>
      snapshot.students.some((student) => student.id === invitation.student.id),
    )
  const sameMaterial = active?.material.id === snapshot.material.id
  const resuming =
    !!active &&
    sameMaterial &&
    samePeople &&
    !!selected &&
    active.calendarLesson?.id === selected.id
  const attaching = !!active && !active.calendarLesson && sameMaterial && samePeople
  const replacing = !!active && !resuming && !attaching

  function start() {
    if (!context || loading || !selectedId || locked.current) return
    if (selectedId !== 'new' && !selected) return
    const body = selected
      ? { lessonId: selected.id, expectedLessonUpdatedAt: selected.updatedAt }
      : (() => {
          const key = JSON.stringify([
            snapshot.material.id,
            snapshot.students.map((s) => s.id).sort(),
            duration,
          ])
          if (request.current?.key !== key) request.current = { key, id: crypto.randomUUID() }
          return { newLesson: { id: request.current.id, durationMinutes: Number(duration) } }
        })()
    locked.current = true
    transition(async () => {
      try {
        setError(null)
        const result = await launchLive(
          snapshot.material.id,
          active?.id ?? null,
          snapshot.students.map((s) => s.id),
          body,
        )
        if (result.error || !result.data) {
          setError(
            result.error === 'lesson_time_conflict'
              ? copy.timeConflict
              : result.error === 'conflict'
                ? copy.changed
                : result.error === 'rule_violation'
                  ? t.calendar.live.notScheduled
                  : t.errors[result.error ?? 'internal'],
          )
          return
        }
        toast.success(copy.started)
        router.push(
          result.data.status === 'ended' && result.data.calendarLesson
            ? lessonAttendanceHref(result.data.calendarLesson)
            : `/live/${result.data.id}`,
        )
        onClose()
      } catch {
        setError(t.errors.upstream_unavailable)
      } finally {
        locked.current = false
      }
    })
  }
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
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>
        <div className="bg-muted/30 space-y-1 rounded-xl border p-3">
          <p className="text-sm font-medium">{snapshot.material.title}</p>
          <p className="text-muted-foreground text-xs">
            {snapshot.students.map((student) => student.fullName || student.email).join(', ')}
          </p>
        </div>
        {loading ? (
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2Icon className="size-4 animate-spin" />
            {t.common.loading}
          </p>
        ) : (
          context && (
            <div className="space-y-4">
              {context.lessons.length ? (
                <Field>
                  <FieldLabel htmlFor="tracked-live-lesson">{copy.lesson}</FieldLabel>
                  <Select value={selectedId} onValueChange={setSelectedId} disabled={pending}>
                    <SelectTrigger
                      id="tracked-live-lesson"
                      className="h-auto min-h-9 w-full text-left [&_[data-slot=select-value]]:whitespace-normal"
                    >
                      <SelectValue placeholder={copy.choose} />
                    </SelectTrigger>
                    <SelectContent>
                      {context.lessons.map((lesson) => (
                        <SelectItem key={lesson.id} value={lesson.id}>
                          {clock.format(new Date(lesson.scheduledAt))} ·{' '}
                          {lesson.topic || t.lessons.noTopic}
                        </SelectItem>
                      ))}
                      <SelectItem value="new">{copy.newLesson}</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              ) : (
                <p className="flex items-center gap-2 text-sm">
                  <CalendarDaysIcon className="text-muted-foreground size-4" />
                  {copy.newLesson}
                </p>
              )}
              {selected ? (
                <p className="text-muted-foreground text-xs">
                  {copy.existingHint
                    .replace('{time}', clock.format(new Date(selected.scheduledAt)))
                    .replace('{duration}', String(selected.durationMinutes))}
                </p>
              ) : selectedId === 'new' ? (
                <Field>
                  <FieldLabel htmlFor="tracked-live-duration">
                    {t.calendar.create.duration}
                  </FieldLabel>
                  <Select value={duration} onValueChange={setDuration} disabled={pending}>
                    <SelectTrigger id="tracked-live-duration" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 16 }, (_, i) => (i + 1) * 15).map((minutes) => (
                        <SelectItem value={String(minutes)} key={minutes}>
                          {minutes} {t.lessons.minutes}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-muted-foreground text-xs">{copy.newHint}</p>
                </Field>
              ) : null}
              {replacing && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  {t.liveDesk.replaceBody.replace('{current}', active.material.title)}
                </p>
              )}
              {attaching && <p className="text-muted-foreground text-xs">{copy.attachHint}</p>}
            </div>
          )
        )}
        {error && (
          <div role="alert" className="space-y-2">
            <p className="text-destructive text-xs">{error}</p>
            <Button
              variant="outline"
              className="corner-brackets"
              disabled={pending || loading}
              onClick={reload}
            >
              {copy.reload}
            </Button>
            {context && (
              <Button asChild variant="ghost" className="corner-brackets">
                <Link href="/dashboard/calendar">{t.calendar.title}</Link>
              </Button>
            )}
          </div>
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
          {resuming ? (
            <Button asChild className="corner-brackets">
              <Link href={`/live/${active.id}`}>
                <RadioIcon />
                {t.teacherLive.resume}
              </Link>
            </Button>
          ) : (
            <Button
              className="corner-brackets h-auto min-h-9 whitespace-normal py-2"
              disabled={pending || loading || !context || !selectedId}
              onClick={start}
            >
              {pending ? <Loader2Icon className="animate-spin" /> : <RadioIcon />}
              {pending
                ? t.live.starting
                : replacing
                  ? t.teacherLive.replaceConfirm
                  : attaching
                    ? copy.attach
                    : t.liveDesk.startAndInvite}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
