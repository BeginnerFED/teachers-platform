'use client'

import { flushPendingSaves } from '@/features/library/editor/editor-flush'

import { useEffect, useState, useTransition } from 'react'
import { BookOpenIcon, Loader2Icon, SearchIcon, SendIcon } from 'lucide-react'
import { tr, uk } from 'react-day-picker/locale'
import { toast } from 'sonner'
import type { MaterialOwner } from '@tp/shared'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import type { Messages } from '@/messages'
import { assignMaterial, loadLessonOptions, type LessonOption } from '../actions'

const SEARCH_DEBOUNCE_MS = 300

/**
 * "Give this lesson to…" — the one place a dialog is right, because the question is who,
 * and the answer is a list of people. Nothing is created here that you would want to land
 * inside of; the homework lands on the students' side.
 *
 * Controlled from outside, so a button on the lesson page and a menu item on a card can
 * both open the same dialog. Opened without a lesson — from the homework desk — it asks
 * for that first, in the same frame, and then asks who.
 */
export function AssignDialog({
  open,
  onOpenChange,
  materialId,
  recipients,
  t,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Known when opened from a lesson; chosen inside when opened from the desk. */
  materialId?: string
  /** The teacher's active students, fetched by the page so this opens with them ready. */
  recipients: MaterialOwner[]
  t: Messages
}) {
  const [lesson, setLesson] = useState<LessonOption | null>(null)
  const chosenMaterialId = materialId ?? lesson?.id ?? null

  function close(next: boolean) {
    onOpenChange(next)
    if (!next) setLesson(null)
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="gap-6 rounded-2xl p-7 sm:max-w-md">
        {chosenMaterialId === null ? (
          <LessonPane onPick={setLesson} t={t} />
        ) : (
          <RecipientsPane
            materialId={chosenMaterialId}
            lesson={materialId ? null : lesson}
            onChangeLesson={() => setLesson(null)}
            recipients={recipients}
            onDone={() => close(false)}
            t={t}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

/**
 * Which lesson. Type to narrow, click the row, and the dialog moves on — no confirm step,
 * because the next pane names the lesson and offers to change it.
 */
function LessonPane({ onPick, t }: { onPick: (lesson: LessonOption) => void; t: Messages }) {
  const [query, setQuery] = useState('')
  const [lessons, setLessons] = useState<LessonOption[] | null>(null)
  const [, startTransition] = useTransition()

  // Fetched at once, and again after a pause in typing. A request per keystroke would race
  // itself; the last one to land would win, and it is not always the latest.
  useEffect(() => {
    const timer = setTimeout(
      () => {
        startTransition(async () => {
          const found = await loadLessonOptions(query).catch(() => [])
          setLessons(found)
        })
      },
      lessons === null ? 0 : SEARCH_DEBOUNCE_MS,
    )

    return () => clearTimeout(timer)
    // `lessons` is read only to skip the debounce on the very first load; depending on it
    // would refetch after every result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  return (
    <div className="animate-in fade-in-0 slide-in-from-left-2 flex flex-col gap-4 duration-200 motion-reduce:animate-none">
      <DialogHeader>
        <DialogTitle>{t.homework.pickLesson.title}</DialogTitle>
        <DialogDescription>{t.homework.pickLesson.body}</DialogDescription>
      </DialogHeader>

      <div className="relative">
        <SearchIcon className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t.homework.pickLesson.search}
          aria-label={t.homework.pickLesson.search}
          autoFocus
          className="h-8 pl-8 text-sm"
        />
      </div>

      <div className="divide-border/60 border-border/60 max-h-72 divide-y overflow-y-auto rounded-xl border">
        {lessons === null ? (
          Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="flex items-center gap-3 px-3 py-2">
              <Skeleton className="size-7 rounded-md" />
              <div className="grid flex-1 gap-1">
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          ))
        ) : lessons.length === 0 ? (
          <p className="text-muted-foreground px-3 py-6 text-center text-sm">
            {t.homework.pickLesson.empty}
          </p>
        ) : (
          lessons.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => onPick(option)}
              className="hover:bg-muted/60 flex w-full items-center gap-3 px-3 py-2 text-left transition-colors"
            >
              <span className="bg-muted text-muted-foreground flex size-7 shrink-0 items-center justify-center rounded-md">
                <BookOpenIcon className="size-3.5" />
              </span>

              <span className="grid min-w-0 flex-1">
                <span className="truncate text-sm">{option.title}</span>
                <span className="text-muted-foreground truncate text-xs tabular-nums">
                  {option.level} · {option.stepCount} {t.library.card.steps}
                </span>
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

/** A small label and a helper line over a control — how every part of a modal is named. */
function Section({
  label,
  help,
  htmlFor,
  children,
}: {
  label: string
  help: string
  htmlFor?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <Label htmlFor={htmlFor} className="text-xs font-medium">
          {label}
        </Label>
        <span className="text-muted-foreground text-xs">{help}</span>
      </div>
      {children}
    </div>
  )
}

/** Who, by when, and a line to go with it. */
function RecipientsPane({
  materialId,
  lesson,
  onChangeLesson,
  recipients,
  onDone,
  t,
}: {
  materialId: string
  /** Named here only when it was chosen here; opened from a lesson, the lesson is the page. */
  lesson: LessonOption | null
  onChangeLesson: () => void
  recipients: MaterialOwner[]
  onDone: () => void
  t: Messages
}) {
  const [chosen, setChosen] = useState<Set<string>>(() => new Set())
  const [filter, setFilter] = useState('')
  const [due, setDue] = useState('')
  const [note, setNote] = useState('')
  const [pending, startTransition] = useTransition()

  const shown = recipients.filter((student) => {
    const term = filter.trim().toLowerCase()
    if (!term) return true

    return (
      (student.fullName ?? '').toLowerCase().includes(term) ||
      student.email.toLowerCase().includes(term)
    )
  })

  const toggle = (id: string, on: boolean) =>
    setChosen((current) => {
      const next = new Set(current)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })

  const send = () =>
    startTransition(async () => {
      try {
        await flushPendingSaves()
      } catch {
        toast.error(t.editorRecovery.blocked)
        return
      }
      const { created, skipped, error } = await assignMaterial({
        materialId,
        studentIds: [...chosen],
        // The end of the chosen day, in the teacher's own time zone.
        dueAt: due ? new Date(`${due}T23:59:00`).toISOString() : null,
        ...(note.trim() ? { note: note.trim() } : {}),
      })

      if (error) {
        toast.error(
          error === 'subscription_required' ? t.errors.subscription_required : t.homework.failed,
        )
        return
      }

      toast.success(`${t.homework.sent}: ${created}`)
      if (skipped > 0) toast.info(`${skipped} ${t.homework.alreadyHad}`)

      onDone()
    })

  return (
    <div className="animate-in fade-in-0 slide-in-from-right-2 flex flex-col gap-4 duration-200 motion-reduce:animate-none">
      <DialogHeader>
        <DialogTitle>{t.homework.assignTitle}</DialogTitle>
        <DialogDescription>{t.homework.assignBody}</DialogDescription>
      </DialogHeader>

      {/* The lesson that was just picked, and the way back to picking another. */}
      {lesson ? (
        <div className="bg-muted/40 border-border/60 flex items-center gap-3 rounded-xl border px-3 py-2">
          <BookOpenIcon className="text-muted-foreground size-4 shrink-0" />
          <span className="grid min-w-0 flex-1">
            <span className="truncate text-sm font-medium">{lesson.title}</span>
            <span className="text-muted-foreground truncate text-xs tabular-nums">
              {lesson.level} · {lesson.stepCount} {t.library.card.steps}
            </span>
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onChangeLesson}
            className="text-muted-foreground"
          >
            {t.homework.pickLesson.change}
          </Button>
        </div>
      ) : null}

      {recipients.length === 0 ? (
        <p className="text-muted-foreground border-border/60 rounded-xl border border-dashed p-6 text-center text-sm">
          {t.homework.noStudents}
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          <Section label={t.homework.sections.students} help={t.homework.sections.studentsHelp}>
            {recipients.length > 6 ? (
              <Input
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder={t.homework.filterStudents}
                className="h-8 text-sm"
              />
            ) : null}

            <ul className="divide-border/60 border-border/60 max-h-60 divide-y overflow-y-auto rounded-xl border">
              {shown.map((student) => (
                <li key={student.id}>
                  <label className="hover:bg-muted/60 flex cursor-pointer items-center gap-3 px-3 py-2 transition-colors">
                    <Checkbox
                      checked={chosen.has(student.id)}
                      onCheckedChange={(on) => toggle(student.id, on === true)}
                    />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-sm">{student.fullName ?? student.email}</span>
                      {student.fullName ? (
                        <span className="text-muted-foreground truncate text-xs">
                          {student.email}
                        </span>
                      ) : null}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </Section>

          <div className="grid gap-5 sm:grid-cols-[1fr_1.4fr]">
            <Section
              label={t.homework.dueAt}
              help={t.homework.sections.dueHelp}
              htmlFor={`homework-due-${materialId}`}
            >
              <DatePicker
                id={`homework-due-${materialId}`}
                name="due"
                value={due}
                onValueChange={setDue}
                label={t.homework.dueAt}
                locale={t.common.pickerLocale === 'tr' ? tr : uk}
                timeZone={Intl.DateTimeFormat().resolvedOptions().timeZone}
                required={false}
                clearLabel={t.homework.clearDue}
                disabled={pending}
              />
            </Section>

            <Section
              label={t.homework.note}
              help={t.homework.sections.noteHelp}
              htmlFor={`homework-note-${materialId}`}
            >
              <Textarea
                id={`homework-note-${materialId}`}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder={t.homework.notePlaceholder}
                maxLength={500}
                rows={2}
                className="min-h-8 text-sm"
              />
            </Section>
          </div>
        </div>
      )}

      <DialogFooter className="items-center sm:justify-between">
        <span className="text-muted-foreground text-xs tabular-nums">
          {chosen.size} {t.homework.selected}
        </span>

        <Button
          type="button"
          className="corner-brackets"
          disabled={pending || chosen.size === 0}
          onClick={send}
        >
          {pending ? <Loader2Icon className="animate-spin" /> : <SendIcon />}
          {pending ? t.homework.sending : t.homework.send}
        </Button>
      </DialogFooter>
    </div>
  )
}
