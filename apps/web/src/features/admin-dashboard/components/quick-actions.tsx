'use client'

import { useId, useRef, useState, useTransition } from 'react'
import { CalendarPlusIcon, Loader2Icon } from 'lucide-react'
import { toast } from 'sonner'
import type { StudentListItem, TeacherListItem } from '@tp/shared'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { linkStudent, loadTeacherOptions } from '@/features/roster/actions'
import { PickPersonDialog } from '@/features/roster/components/pick-person-dialog'
import { initialTeacherActionState } from '@/features/teachers/action-state'
import { extendSubscription } from '@/features/teachers/actions'
import { counted, formatDate } from '@/lib/format'
import type { Messages } from '@/messages'

export function ExtendAccess({
  teacher,
  t,
  locale,
}: {
  teacher: TeacherListItem
  t: Messages
  locale: string
}) {
  const [open, setOpen] = useState(false)
  const [months, setMonths] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const submitting = useRef(false)
  const group = useId()
  const text = t.adminHome.quickActions
  const name = teacher.fullName ?? teacher.email

  function onOpenChange(next: boolean) {
    if (submitting.current) return
    setOpen(next)
    setError(null)
    setMonths(1)
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting.current) return
    submitting.current = true
    setError(null)
    const formData = new FormData()
    formData.set('teacherId', teacher.id)
    formData.set('months', String(months))

    startTransition(async () => {
      try {
        const result = await extendSubscription(initialTeacherActionState, formData)
        if (result.error) setError(t.errors[result.error])
        else if (result.done) {
          toast.success(t.teachers.toast.extended)
          setOpen(false)
        }
      } catch {
        setError(t.errors.internal)
      } finally {
        submitting.current = false
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 text-xs"
          aria-label={`${text.extend}: ${name}`}
        >
          <CalendarPlusIcon className="size-3.5" />
          {text.extend}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{text.extend}</DialogTitle>
          <DialogDescription className="break-words">{name}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5">
          <div className="bg-muted/40 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-xs">
            <span className="text-muted-foreground">{text.currentEnd}</span>
            <span className="font-medium tabular-nums">
              {formatDate(teacher.subscription?.accessEndsAt ?? null, locale)}
            </span>
          </div>
          <fieldset disabled={pending}>
            <legend className="mb-2 text-sm font-medium">{text.duration}</legend>
            <div className="grid grid-cols-4 gap-2">
              {[1, 3, 6, 12].map((value) => (
                <label key={value} className="cursor-pointer">
                  <input
                    type="radio"
                    name={group}
                    value={value}
                    checked={months === value}
                    onChange={() => setMonths(value)}
                    className="peer sr-only"
                  />
                  <span className="peer-checked:border-primary peer-checked:bg-primary/5 peer-checked:text-primary peer-focus-visible:ring-ring flex min-h-10 items-center justify-center rounded-lg border px-1 text-center text-xs font-medium transition-colors peer-focus-visible:ring-2 peer-disabled:opacity-60">
                    {counted(value, text.months, locale)}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <p className="text-muted-foreground text-xs leading-5">{text.extensionHint}</p>
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              {t.teachers.suspendConfirm.cancel}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2Icon className="size-4 animate-spin" />}
              {pending ? t.teachers.actions.working : text.extend}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function AssignTeacher({ student, t }: { student: StudentListItem; t: Messages }) {
  return (
    <PickPersonDialog
      label={t.adminHome.quickActions.assign}
      title={t.students.detail.pickTeacher.title}
      description={t.adminHome.quickActions.assignDescription.replace(
        '{name}',
        student.fullName ?? student.email,
      )}
      searchPlaceholder={t.students.detail.pickTeacher.search}
      emptyMessage={t.students.detail.pickTeacher.empty}
      exclude={student.teachers.map((teacher) => teacher.id)}
      load={loadTeacherOptions}
      onPick={(teacherId) => linkStudent(teacherId, student.id)}
      success={t.students.detail.linked}
      failure={t.errors.internal}
      retryLabel={t.common.retry}
    />
  )
}
