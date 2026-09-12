'use client'

import { useRef, useState, useTransition } from 'react'
import { Loader2Icon, Undo2Icon, XIcon } from 'lucide-react'
import { toast } from 'sonner'
import {
  PLATFORM_TIME_ZONE,
  type CalendarLesson,
  type LessonSeriesCancellationPreview,
} from '@tp/shared'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Messages } from '@/messages'
import {
  cancelFollowingLessons,
  previewSeriesCancellation,
  recordAttendance,
} from '../attendance-actions'

export function CancelLesson({
  lesson,
  locale,
  t,
}: {
  lesson: CalendarLesson
  locale: string
  t: Messages
}) {
  const [open, setOpen] = useState(false)
  const [openedAt, setOpenedAt] = useState(0)
  const [snapshot, setSnapshot] = useState(lesson)
  const [scope, setScope] = useState<'single' | 'following'>('single')
  const [preview, setPreview] = useState<LessonSeriesCancellationPreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, transition] = useTransition()
  const locked = useRef(false)
  const requestId = useRef<string | null>(null)
  const previewRequest = useRef(0)
  const copy = t.calendar.attendance
  const series = t.calendarCancellation
  const restore = snapshot.status === 'canceled'
  const canCancelSeries =
    snapshot.series &&
    snapshot.status === 'scheduled' &&
    Date.parse(snapshot.scheduledAt) > openedAt
  const dates = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeZone: PLATFORM_TIME_ZONE,
  })

  function failure(code: string) {
    if (code === 'lesson_changed' || code === 'not_found') return series.changed
    if (code === 'rule_violation') return series.unavailable
    if (code === 'conflict') return t.calendar.create.conflict
    return t.errors[code as keyof Messages['errors']] ?? t.errors.internal
  }

  async function loadPreview() {
    const current = ++previewRequest.current
    setLoading(true)
    setError(null)
    setPreview(null)
    requestId.current = null
    try {
      const result = await previewSeriesCancellation(snapshot.id)
      if (previewRequest.current !== current) return
      if (result.error) setError(failure(result.error))
      else setPreview(result.data)
    } catch {
      if (previewRequest.current === current) setError(t.errors.upstream_unavailable)
    } finally {
      if (previewRequest.current === current) setLoading(false)
    }
  }

  function confirm() {
    if (
      locked.current ||
      loading ||
      (scope === 'following' && (!preview || preview.hasActiveLesson))
    )
      return
    locked.current = true
    setError(null)
    transition(async () => {
      try {
        if (scope === 'following' && preview) {
          requestId.current ??= crypto.randomUUID()
          const result = await cancelFollowingLessons(snapshot.id, {
            requestId: requestId.current,
            expectedUpdatedAt: preview.expectedUpdatedAt,
            expectedSeriesUpdatedAt: preview.expectedSeriesUpdatedAt,
          })
          if (result.error) {
            setError(failure(result.error))
            if (
              result.error === 'lesson_changed' ||
              result.error === 'not_found' ||
              result.error === 'rule_violation'
            )
              setPreview(null)
            return
          }
          toast.success(series.canceled.replace('{count}', String(result.data.count)))
        } else {
          const result = await recordAttendance(snapshot.id, {
            expectedUpdatedAt: snapshot.updatedAt,
            status: restore ? 'scheduled' : 'canceled',
            students: [],
          })
          if (result.error) {
            setError(failure(result.error))
            return
          }
          toast.success(restore ? copy.restored : copy.canceled)
        }
        setOpen(false)
        previewRequest.current++
      } catch {
        setError(t.errors.upstream_unavailable)
      } finally {
        locked.current = false
      }
    })
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(value) => {
        if (locked.current) return
        previewRequest.current++
        setOpen(value)
        setError(null)
        setLoading(false)
        setPreview(null)
        if (value) {
          setOpenedAt(Date.now())
          setSnapshot(lesson)
          setScope('single')
          requestId.current = null
        }
      }}
    >
      <AlertDialogTrigger asChild>
        <Button variant="ghost" className="corner-brackets text-muted-foreground" size="sm">
          {lesson.status === 'canceled' ? <Undo2Icon /> : <XIcon />}
          {lesson.status === 'canceled' ? copy.restore : copy.cancel}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>{restore ? copy.restore : copy.cancel}</AlertDialogTitle>
          <AlertDialogDescription>
            {restore ? copy.restoreHint : scope === 'following' ? series.hint : copy.cancelHint}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {canCancelSeries && (
          <div className="min-w-0 space-y-2">
            <Label htmlFor={`cancel-scope-${snapshot.id}`}>{series.scope}</Label>
            <Select
              value={scope}
              disabled={pending}
              onValueChange={(value) => {
                const next = value as typeof scope
                setScope(next)
                if (next === 'following') void loadPreview()
                else {
                  previewRequest.current++
                  setLoading(false)
                  setError(null)
                  setPreview(null)
                }
              }}
            >
              <SelectTrigger id={`cancel-scope-${snapshot.id}`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="single">{t.calendarRecurrence.single}</SelectItem>
                <SelectItem value="following">{t.calendarRecurrence.following}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        {scope === 'following' && (
          <div className="bg-muted/40 space-y-2 rounded-xl border p-3" aria-live="polite">
            {loading ? (
              <p className="text-muted-foreground flex items-center gap-2 text-sm">
                <Loader2Icon className="size-4 animate-spin" />
                {series.loading}
              </p>
            ) : preview ? (
              <>
                <p className="text-sm font-medium">
                  {series.preview.replace('{count}', String(preview.count))}
                </p>
                <p className="text-muted-foreground text-xs">
                  {dates.format(new Date(preview.from))} – {dates.format(new Date(preview.to))}
                </p>
                {preview.hasActiveLesson && (
                  <p className="text-destructive text-xs">{t.calendar.live.finishFirst}</p>
                )}
              </>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="corner-brackets"
                onClick={() => void loadPreview()}
              >
                {t.common.retry}
              </Button>
            )}
          </div>
        )}
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending} className="corner-brackets">
            {t.accounts.form.cancel}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={
              pending || loading || (scope === 'following' && (!preview || preview.hasActiveLesson))
            }
            className="corner-brackets"
            onClick={(event) => {
              event.preventDefault()
              confirm()
            }}
          >
            {pending && <Loader2Icon className="animate-spin" />}
            {restore ? copy.restore : scope === 'following' ? series.confirm : copy.cancel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
