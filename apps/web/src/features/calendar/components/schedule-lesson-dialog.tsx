'use client'

import { useRef, useState, useTransition, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarPlusIcon, Loader2Icon, SaveIcon, SearchIcon, UsersIcon } from 'lucide-react'
import { tr, uk } from 'react-day-picker/locale'
import { toast } from 'sonner'
import {
  PLATFORM_TIME_ZONE,
  scheduleLessonBody,
  updateLessonBody,
  type CalendarLesson,
  type MaterialOwner,
} from '@tp/shared'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DatePicker } from '@/components/ui/date-picker'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { TimePicker } from '@/components/ui/time-picker'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RefreshDashboard } from '@/features/admin-dashboard/components/refresh-dashboard'
import { initials } from '@/lib/format'
import { cn } from '@/lib/utils'
import { parseIsoDate, startOfWeek, toIsoDate, toZoned } from '@/lib/zoned-time'
import type { Messages } from '@/messages'
import { scheduleLesson, updateLesson } from '../actions'
import { scheduleInstant } from '../schedule-time'

export function ScheduleLessonDialog({
  students,
  defaultDate,
  locale,
  t,
}: {
  students: MaterialOwner[] | null
  defaultDate: string
  locale: string
  t: Messages
}) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button className="corner-brackets" onClick={() => setOpen(true)}>
        <CalendarPlusIcon />
        {t.calendar.create.button}
      </Button>
      {open && (
        <ScheduleForm
          students={students}
          defaultDate={defaultDate}
          locale={locale}
          t={t}
          onClose={() => setOpen(false)}
        />
      )}
    </Dialog>
  )
}

export function EditLessonDialog({
  lesson,
  students,
  locale,
  t,
  onClose,
  onSaved,
}: {
  lesson: CalendarLesson
  students: MaterialOwner[] | null
  locale: string
  t: Messages
  onClose: () => void
  onSaved: () => void
}) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <ScheduleForm
        lesson={lesson}
        students={students}
        defaultDate={toIsoDate(toZoned(new Date(lesson.scheduledAt), PLATFORM_TIME_ZONE))}
        locale={locale}
        t={t}
        onClose={onClose}
        onSaved={onSaved}
      />
    </Dialog>
  )
}

function ScheduleForm({
  lesson,
  students,
  defaultDate,
  locale,
  t,
  onClose,
  onSaved,
}: {
  lesson?: CalendarLesson
  students: MaterialOwner[] | null
  defaultDate: string
  locale: string
  t: Messages
  onClose: () => void
  onSaved?: () => void
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<string[]>(
    () => lesson?.students.map((student) => student.id) ?? [],
  )
  const [date, setDate] = useState(defaultDate)
  const [weekly, setWeekly] = useState(false)
  const [weeks, setWeeks] = useState(4)
  const firstWeekday = new Date(`${date}T12:00:00Z`).getUTCDay()
  const [extraDays, setExtraDays] = useState<number[]>([])
  const weekdays = [...new Set([firstWeekday, ...extraDays])].sort()
  const recurrenceWeeks = Math.min(weeks, Math.floor(104 / weekdays.length))
  const [scope, setScope] = useState<'single' | 'following' | 'upcoming'>('single')
  const [openedAt] = useState(() => Date.now())
  const [time, setTime] = useState(() => {
    if (!lesson) return '09:00'
    const time = toZoned(new Date(lesson.scheduledAt), PLATFORM_TIME_ZONE)
    return `${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}`
  })
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, transition] = useTransition()
  const locked = useRef(false)
  const request = useRef<{ key: string; id: string } | null>(null)
  const term = search.trim().toLocaleLowerCase(locale)
  // Keep former students visible until the teacher explicitly removes them.
  const candidates = [
    ...(students ?? []),
    ...(lesson?.students.filter(
      (student) => !students?.some((active) => active.id === student.id),
    ) ?? []),
  ]
  const visible =
    candidates.filter((student) =>
      `${student.fullName ?? ''} ${student.email}`.toLocaleLowerCase(locale).includes(term),
    ) ?? []
  const chosen = candidates.filter((student) => selected.includes(student.id))
  const copy = t.calendar.create
  const heading = lesson ? t.calendar.edit : copy

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (locked.current || !chosen.length) return
    if (
      !students ||
      chosen.some((student) => !students.some((active) => active.id === student.id))
    ) {
      setError(copy.studentsChanged)
      return
    }
    const form = new FormData(event.currentTarget)
    const date = String(form.get('date') ?? '')
    const instant = scheduleInstant(date, String(form.get('time') ?? ''))
    if (!instant) {
      setError(copy.invalidTime)
      return
    }
    const fields = {
      scheduledAt: instant,
      durationMinutes: Number(form.get('duration')),
      studentIds: chosen.map((student) => student.id).sort(),
      topic: String(form.get('topic') ?? '').trim(),
      notes: String(form.get('notes') ?? '').trim(),
    }
    const recurrence = weekly && !lesson ? { weeks: recurrenceWeeks, weekdays } : undefined
    const key = JSON.stringify({ ...fields, recurrence, scope })
    if (request.current?.key !== key) request.current = { key, id: crypto.randomUUID() }
    const parsed = scheduleLessonBody.safeParse({ ...fields, id: request.current.id, recurrence })
    const edited = lesson
      ? updateLessonBody.safeParse({
          ...fields,
          expectedUpdatedAt: lesson.updatedAt,
          ...(lesson.series && scope !== 'single'
            ? {
                seriesEdit: {
                  scope,
                  expectedUpdatedAt: lesson.series.updatedAt,
                  requestId: request.current.id,
                },
              }
            : {}),
        })
      : null
    if (!parsed.success || (edited && !edited.success)) {
      setError(t.errors.validation_failed)
      return
    }
    locked.current = true
    setError(null)
    transition(async () => {
      try {
        const result =
          lesson && edited?.success
            ? await updateLesson(lesson.id, edited.data)
            : await scheduleLesson(parsed.data)
        if (result.error || !result.data) {
          setError(
            result.error === 'lesson_changed'
              ? t.calendar.edit.changed
              : result.error === 'rule_violation'
                ? t.calendar.edit.notScheduled
                : result.error === 'conflict'
                  ? copy.conflict
                  : result.error === 'forbidden'
                    ? copy.studentsChanged
                    : t.errors[result.error ?? 'internal'],
          )
          return
        }
        toast.success(heading.saved)
        onSaved?.()
        onClose()
        // The teacher may have picked a date outside the week currently on screen.
        const day = parseIsoDate(date)!
        router.push(`/dashboard/calendar?week=${toIsoDate(startOfWeek(day))}`, { scroll: false })
      } catch {
        setError(t.errors.upstream_unavailable)
      } finally {
        locked.current = false
      }
    })
  }

  return (
    <DialogContent
      className="max-h-[90dvh] overflow-y-auto sm:max-w-xl"
      showCloseButton={!pending}
      onEscapeKeyDown={(event) => {
        if (locked.current) event.preventDefault()
      }}
      onInteractOutside={(event) => {
        if (locked.current) event.preventDefault()
      }}
    >
      <form onSubmit={submit} className="min-w-0 space-y-5">
        <DialogHeader>
          <DialogTitle>{heading.title}</DialogTitle>
          <DialogDescription>{heading.description}</DialogDescription>
        </DialogHeader>
        <fieldset disabled={pending} className="min-w-0 space-y-5">
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-sm font-medium">{t.calendar.detail.students}</h3>
              <span className="text-muted-foreground text-xs">
                {copy.selected.replace('{count}', String(chosen.length))}
              </span>
            </div>
            <div className="rounded-xl border">
              <div className="relative m-3">
                <SearchIcon className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t.liveDesk.searchStudent}
                  aria-label={t.liveDesk.searchStudent}
                  className="h-8 rounded-full pl-8"
                />
              </div>
              {students === null ? (
                <div
                  role="alert"
                  className="flex flex-col items-center gap-2 px-4 py-6 text-center"
                >
                  <p className="text-muted-foreground text-xs">{t.liveDesk.studentsFailed}</p>
                  <RefreshDashboard label={t.common.retry} />
                </div>
              ) : !candidates.length ? (
                <div className="flex flex-col items-center gap-2 px-4 py-6 text-center">
                  <UsersIcon className="text-muted-foreground size-6" />
                  <p className="text-sm">{t.liveDesk.noStudents}</p>
                  <p className="text-muted-foreground text-xs">{t.liveDesk.noStudentsHint}</p>
                </div>
              ) : !visible.length ? (
                <p className="text-muted-foreground px-4 py-6 text-center text-xs">
                  {t.liveDesk.noMatches}
                </p>
              ) : (
                <ul className="max-h-40 overflow-y-auto px-2 pb-2">
                  {visible.map((student) => {
                    const checked = selected.includes(student.id)
                    return (
                      <li key={student.id}>
                        <FieldLabel
                          htmlFor={`lesson-student-${student.id}`}
                          className={cn(
                            'has-[:focus-visible]:ring-ring flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors has-[:disabled]:opacity-50 has-[:focus-visible]:ring-2',
                            checked ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-muted/50',
                          )}
                        >
                          <Avatar className="rounded-lg">
                            <AvatarFallback className="bg-muted/40 rounded-lg text-[11px] font-normal">
                              {initials(student.fullName || student.email)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-medium">
                              {student.fullName || student.email}
                            </span>
                            <span className="text-muted-foreground mt-0.5 block truncate text-[11px] font-normal">
                              {student.email}
                            </span>
                            {!students.some((active) => active.id === student.id) && (
                              <span className="text-destructive mt-0.5 block text-[11px] font-normal">
                                {t.calendar.edit.unavailableStudent}
                              </span>
                            )}
                          </span>
                          <Checkbox
                            id={`lesson-student-${student.id}`}
                            checked={checked}
                            disabled={
                              pending ||
                              (!checked &&
                                (selected.length >= 50 ||
                                  !students.some((active) => active.id === student.id)))
                            }
                            onCheckedChange={(next) =>
                              setSelected((current) =>
                                next === true
                                  ? [...current, student.id]
                                  : current.filter((id) => id !== student.id),
                              )
                            }
                          />
                        </FieldLabel>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
          <div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1.3fr_1fr_1fr]">
              <Field className="col-span-2 min-w-0 sm:col-span-1">
                <FieldLabel htmlFor="lesson-date">{copy.date}</FieldLabel>
                <DatePicker
                  id="lesson-date"
                  name="date"
                  value={date}
                  onValueChange={setDate}
                  label={copy.date}
                  locale={t.common.pickerLocale === 'tr' ? tr : uk}
                  timeZone={PLATFORM_TIME_ZONE}
                  disabled={pending}
                />
              </Field>
              <Field className="min-w-0">
                <FieldLabel htmlFor="lesson-time">{copy.time}</FieldLabel>
                <TimePicker
                  id="lesson-time"
                  name="time"
                  value={time}
                  onValueChange={setTime}
                  label={copy.time}
                  hourLabel={copy.hour}
                  minuteLabel={copy.minute}
                  disabled={pending}
                />
              </Field>
              <Field className="min-w-0">
                <FieldLabel htmlFor="lesson-duration">{copy.duration}</FieldLabel>
                <Input
                  id="lesson-duration"
                  name="duration"
                  type="number"
                  defaultValue={lesson?.durationMinutes ?? 60}
                  min={15}
                  max={240}
                  step={1}
                  required
                />
              </Field>
            </div>
            <p className="text-muted-foreground mt-2 text-xs">{copy.timeZone}</p>
            <p className="text-muted-foreground mt-1 text-xs">{t.reminders.lessonHint}</p>
          </div>
          {!lesson ? (
            <div className="bg-muted/30 space-y-3 rounded-xl border p-3">
              <FieldLabel className="flex items-center gap-2">
                <Checkbox checked={weekly} onCheckedChange={(value) => setWeekly(value === true)} />
                {t.calendarRecurrence.weekly}
              </FieldLabel>
              {weekly ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    {[1, 2, 3, 4, 5, 6, 0].map((day) => (
                      <FieldLabel
                        key={day}
                        className="bg-background flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-2 text-xs"
                      >
                        <Checkbox
                          checked={weekdays.includes(day)}
                          disabled={day === firstWeekday}
                          onCheckedChange={(value) =>
                            setExtraDays((current) =>
                              value === true
                                ? [...current, day]
                                : current.filter((item) => item !== day),
                            )
                          }
                        />
                        {t.calendarRecurrence.days[day]}
                      </FieldLabel>
                    ))}
                  </div>
                  <Field>
                    <FieldLabel htmlFor="lesson-weeks">{t.calendarRecurrence.weeks}</FieldLabel>
                    <Select
                      value={String(recurrenceWeeks)}
                      onValueChange={(value) => setWeeks(Number(value))}
                    >
                      <SelectTrigger id="lesson-weeks" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from(
                          { length: Math.min(26, Math.floor(104 / weekdays.length)) - 1 },
                          (_, i) => i + 2,
                        ).map((count) => (
                          <SelectItem key={count} value={String(count)}>
                            {count}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <p className="text-muted-foreground text-xs">
                    {t.calendarRecurrence.preview.replace(
                      '{count}',
                      String(recurrenceWeeks * weekdays.length),
                    )}
                  </p>
                </>
              ) : null}
            </div>
          ) : lesson.series ? (
            <Field>
              <FieldLabel htmlFor="lesson-edit-scope">{t.calendarRecurrence.editScope}</FieldLabel>
              <Select value={scope} onValueChange={(value) => setScope(value as typeof scope)}>
                <SelectTrigger id="lesson-edit-scope" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">{t.calendarRecurrence.single}</SelectItem>
                  <SelectItem
                    value="following"
                    disabled={Date.parse(lesson.scheduledAt) < openedAt}
                  >
                    {t.calendarRecurrence.following}
                  </SelectItem>
                  <SelectItem value="upcoming" disabled={Date.parse(lesson.scheduledAt) < openedAt}>
                    {t.calendarRecurrence.upcoming}
                  </SelectItem>
                </SelectContent>
              </Select>
              {scope !== 'single' ? (
                <p className="text-muted-foreground text-xs">{t.calendarRecurrence.editHint}</p>
              ) : null}
            </Field>
          ) : null}
          <Field>
            <FieldLabel htmlFor="lesson-topic">{copy.topic}</FieldLabel>
            <Input
              id="lesson-topic"
              name="topic"
              defaultValue={lesson?.topic ?? ''}
              placeholder={copy.topicPlaceholder}
              maxLength={200}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="lesson-notes">{copy.notes}</FieldLabel>
            <Textarea
              id="lesson-notes"
              name="notes"
              defaultValue={lesson?.notes ?? ''}
              placeholder={copy.notesPlaceholder}
              maxLength={2000}
              rows={2}
              className="min-h-16 resize-y"
            />
          </Field>
        </fieldset>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="corner-brackets"
            disabled={pending}
            onClick={onClose}
          >
            {t.accounts.form.cancel}
          </Button>
          <Button
            type="submit"
            className="corner-brackets"
            disabled={pending || !chosen.length || students === null}
          >
            {pending ? (
              <Loader2Icon className="animate-spin" />
            ) : lesson ? (
              <SaveIcon />
            ) : (
              <CalendarPlusIcon />
            )}
            {pending ? heading.saving : heading.save}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}
