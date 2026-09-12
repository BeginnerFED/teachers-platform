'use client'

import { useRef, useState, useTransition } from 'react'
import { CheckCheckIcon, CheckIcon, Loader2Icon, PencilIcon, Undo2Icon, XIcon } from 'lucide-react'
import { toast } from 'sonner'
import type { CalendarLesson, RecordAttendanceBody } from '@tp/shared'
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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { Messages } from '@/messages'
import { recordAttendance } from '../attendance-actions'
import { StudentCredits } from './student-credits'

function failure(error: string, t: Messages) {
  if (error === 'lesson_changed') return t.calendar.edit.changed
  if (error === 'rule_violation') return t.calendar.attendance.tooEarly
  if (error === 'conflict') return t.calendar.create.conflict
  return t.errors[error as keyof Messages['errors']] ?? t.errors.internal
}

function AttendanceEditor({
  lesson,
  t,
  onDone,
}: {
  lesson: CalendarLesson
  t: Messages
  onDone: () => void
}) {
  // Freeze the version while editing; a refreshed page must not erase a draft.
  const [snapshot] = useState(lesson)
  const [students, setStudents] = useState(() =>
    lesson.students.map((student) => ({
      studentId: student.id,
      attendance: student.attendance,
      deductCredit: student.deductCredit,
    })),
  )
  const [pending, transition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const locked = useRef(false)
  const copy = t.calendar.attendance
  const complete =
    students.length > 0 && students.every((student) => student.attendance !== 'expected')
  function save() {
    if (locked.current || !complete) return
    locked.current = true
    transition(async () => {
      try {
        setError(null)
        const body: RecordAttendanceBody = {
          expectedUpdatedAt: snapshot.updatedAt,
          status: 'held',
          students: students.map((student) => ({
            ...student,
            attendance: student.attendance as 'present' | 'absent' | 'excused',
            deductCredit:
              student.attendance === 'present' ||
              (student.attendance === 'absent' && student.deductCredit),
          })),
        }
        const result = await recordAttendance(snapshot.id, body)
        if (result.error) {
          setError(failure(result.error, t))
          return
        }
        toast.success(copy.saved)
        onDone()
      } catch {
        setError(t.errors.upstream_unavailable)
      } finally {
        locked.current = false
      }
    })
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">{copy.title}</p>
        {students.length > 1 && (
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            className="corner-brackets"
            onClick={() =>
              setStudents((current) =>
                current.map((student) => ({
                  ...student,
                  attendance: 'present',
                  deductCredit: true,
                })),
              )
            }
          >
            <CheckCheckIcon />
            {copy.allPresent}
          </Button>
        )}
      </div>
      {snapshot.status === 'scheduled' && !snapshot.attendancePending && (
        <p className="text-muted-foreground text-xs">{copy.tooEarly}</p>
      )}
      <div className="space-y-3">
        {snapshot.students.map((student) => {
          const value = students.find((item) => item.studentId === student.id)!
          return (
            <div key={student.id} className="space-y-3 rounded-xl border p-3">
              <div>
                <p className="truncate text-xs font-medium">{student.fullName || student.email}</p>
                <p className="text-muted-foreground truncate text-[11px]">{student.email}</p>
              </div>
              <div
                role="group"
                aria-label={`${student.fullName || student.email} · ${copy.title}`}
                className="grid grid-cols-3 gap-1.5"
              >
                {(['present', 'absent', 'excused'] as const).map((status) => (
                  <Button
                    key={status}
                    type="button"
                    variant="outline"
                    disabled={pending}
                    aria-pressed={value.attendance === status}
                    className={cn(
                      'corner-brackets h-auto min-h-8 min-w-0 whitespace-normal px-1 py-1.5 text-[11px]',
                      value.attendance === status &&
                        'border-primary/40 bg-primary/10 text-primary hover:bg-primary/15',
                    )}
                    onClick={() =>
                      setStudents((current) =>
                        current.map((item) =>
                          item.studentId === student.id
                            ? { ...item, attendance: status, deductCredit: status === 'present' }
                            : item,
                        ),
                      )
                    }
                  >
                    {t.lessons.attendance[status]}
                  </Button>
                ))}
              </div>
              {value.attendance === 'absent' ? (
                <Label
                  htmlFor={`deduct-${student.id}`}
                  className="flex items-start gap-2 text-xs font-normal"
                >
                  <Checkbox
                    id={`deduct-${student.id}`}
                    checked={value.deductCredit}
                    disabled={pending}
                    onCheckedChange={(checked) =>
                      setStudents((current) =>
                        current.map((item) =>
                          item.studentId === student.id
                            ? { ...item, deductCredit: checked === true }
                            : item,
                        ),
                      )
                    }
                  />
                  {copy.deduct}
                </Label>
              ) : value.attendance !== 'expected' ? (
                <p className="text-muted-foreground text-[11px]">
                  {value.attendance === 'present' ? copy.willDeduct : copy.wontDeduct}
                </p>
              ) : null}
            </div>
          )
        })}
      </div>
      {error && (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}
      {!complete && <p className="text-muted-foreground text-xs">{copy.chooseAll}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" className="corner-brackets" disabled={pending} onClick={onDone}>
          {t.accounts.form.cancel}
        </Button>
        <Button className="corner-brackets" disabled={pending || !complete} onClick={save}>
          {pending ? <Loader2Icon className="animate-spin" /> : <CheckIcon />}
          {pending
            ? t.calendar.edit.saving
            : snapshot.status === 'held'
              ? copy.save
              : copy.complete}
        </Button>
      </div>
    </div>
  )
}

function CancelLesson({ lesson, t }: { lesson: CalendarLesson; t: Messages }) {
  const [open, setOpen] = useState(false)
  const [pending, transition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const locked = useRef(false)
  const restore = lesson.status === 'canceled'
  const copy = t.calendar.attendance
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!locked.current) {
          setOpen(next)
          setError(null)
        }
      }}
    >
      <AlertDialogTrigger asChild>
        <Button variant="ghost" className="corner-brackets text-muted-foreground" size="sm">
          {restore ? <Undo2Icon /> : <XIcon />}
          {restore ? copy.restore : copy.cancel}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{restore ? copy.restore : copy.cancel}</AlertDialogTitle>
          <AlertDialogDescription>
            {restore ? copy.restoreHint : copy.cancelHint}
          </AlertDialogDescription>
        </AlertDialogHeader>
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
            disabled={pending}
            className="corner-brackets"
            onClick={(event) => {
              event.preventDefault()
              if (locked.current) return
              locked.current = true
              transition(async () => {
                try {
                  const result = await recordAttendance(lesson.id, {
                    expectedUpdatedAt: lesson.updatedAt,
                    status: restore ? 'scheduled' : 'canceled',
                    students: [],
                  })
                  if (result.error) {
                    setError(failure(result.error, t))
                    return
                  }
                  setOpen(false)
                  toast.success(restore ? copy.restored : copy.canceled)
                } catch {
                  setError(t.errors.upstream_unavailable)
                } finally {
                  locked.current = false
                }
              })
            }}
          >
            {pending ? <Loader2Icon className="animate-spin" /> : null}
            {restore ? copy.restore : copy.cancel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function LessonAttendance({
  lesson,
  locale,
  t,
  initialEditing = false,
}: {
  lesson: CalendarLesson
  locale: string
  t: Messages
  initialEditing?: boolean
}) {
  const [editing, setEditing] = useState(
    initialEditing && lesson.status !== 'canceled' && lesson.liveSession?.status !== 'active',
  )
  const copy = t.calendar.attendance
  if (editing) return <AttendanceEditor lesson={lesson} t={t} onDone={() => setEditing(false)} />
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-muted-foreground text-[11px] font-medium uppercase tracking-widest">
          {t.calendar.detail.students}
        </h3>
        {lesson.attendancePending && (
          <Badge variant="outline" className="border-amber-300 text-amber-700">
            {copy.pending}
          </Badge>
        )}
      </div>
      <div className="divide-y rounded-xl border">
        {lesson.students.map((student) => (
          <div key={student.id} className="p-2">
            <StudentCredits student={student} locale={locale} t={t} />
            <div className="text-muted-foreground flex flex-wrap justify-end gap-2 px-2 pb-1 text-[11px]">
              <span>
                {lesson.status === 'canceled'
                  ? t.lessons.status.canceled
                  : t.lessons.attendance[student.attendance]}
              </span>
              {lesson.status === 'held' && (
                <span>
                  ·{' '}
                  {student.deductCredit
                    ? t.calendar.credits.deducted
                    : t.calendar.credits.notDeducted}
                </span>
              )}
            </div>
          </div>
        ))}
        {!lesson.students.length && (
          <p className="text-muted-foreground p-3 text-xs">{t.calendar.noStudents}</p>
        )}
      </div>
      {lesson.status !== 'canceled' && (
        <Button
          className="corner-brackets w-full"
          variant={lesson.status === 'held' ? 'outline' : 'default'}
          disabled={!lesson.students.length || lesson.liveSession?.status === 'active'}
          onClick={() => setEditing(true)}
        >
          {lesson.status === 'held' ? <PencilIcon /> : <CheckCheckIcon />}
          {lesson.status === 'held' ? copy.correct : copy.take}
        </Button>
      )}
      {lesson.liveSession?.status === 'active' ? (
        <p className="text-muted-foreground text-xs">{t.calendar.live.finishFirst}</p>
      ) : (
        <div className="flex justify-end">
          <CancelLesson lesson={lesson} t={t} />
        </div>
      )}
    </div>
  )
}
