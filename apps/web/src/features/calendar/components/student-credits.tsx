'use client'

import { useRef, useState, useTransition, type FormEvent } from 'react'
import { ChevronDownIcon, Loader2Icon, PlusIcon } from 'lucide-react'
import { toast } from 'sonner'
import type { LessonCreditSummary, MaterialOwner } from '@tp/shared'
import { PLATFORM_TIME_ZONE } from '@tp/shared'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { initials } from '@/lib/format'
import type { Messages } from '@/messages'
import { grantLessonCredits, loadLessonCredits, reverseLessonCredits } from '../attendance-actions'

export function StudentCredits({
  student,
  locale,
  t,
  initialSummary,
}: {
  student: MaterialOwner
  locale: string
  t: Messages
  initialSummary?: LessonCreditSummary
}) {
  const [open, setOpen] = useState(!!initialSummary)
  const [summary, setSummary] = useState<LessonCreditSummary | null>(initialSummary ?? null)
  const [reversing, setReversing] = useState<LessonCreditSummary['grants'][number] | null>(null)
  const [reverseError, setReverseError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, transition] = useTransition()
  const locked = useRef(false)
  const request = useRef<{ key: string; id: string } | null>(null)
  const copy = t.calendar.credits
  const date = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: PLATFORM_TIME_ZONE,
  })
  function reverse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!reversing || locked.current) return
    const grantId = reversing.id
    const reason = String(new FormData(event.currentTarget).get('reason') ?? '').trim()
    if (reason.length < 3) {
      setReverseError(copy.reasonRequired)
      return
    }
    locked.current = true
    transition(async () => {
      try {
        setReverseError(null)
        const result = await reverseLessonCredits(student.id, grantId, { reason })
        if (result.error)
          setReverseError(t.errors[result.error === 'lesson_changed' ? 'conflict' : result.error])
        else {
          setSummary(result.data)
          setReversing(null)
          toast.success(copy.reversed)
        }
      } catch {
        setReverseError(t.errors.upstream_unavailable)
      } finally {
        locked.current = false
      }
    })
  }
  function load() {
    transition(async () => {
      try {
        setError(null)
        const result = await loadLessonCredits(student.id)
        if (result.error)
          setError(t.errors[result.error === 'lesson_changed' ? 'conflict' : result.error])
        else setSummary(result.data)
      } catch {
        setError(t.errors.upstream_unavailable)
      }
    })
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (locked.current) return
    const form = event.currentTarget
    const values = new FormData(form)
    const body = {
      units: Number(values.get('units')),
      note: String(values.get('note') ?? '').trim(),
    }
    const key = JSON.stringify(body)
    if (request.current?.key !== key) request.current = { key, id: crypto.randomUUID() }
    const id = request.current.id
    locked.current = true
    transition(async () => {
      try {
        setError(null)
        const result = await grantLessonCredits(student.id, { ...body, id })
        if (result.error)
          setError(t.errors[result.error === 'lesson_changed' ? 'conflict' : result.error])
        else {
          setSummary(result.data)
          request.current = null
          form.reset()
          toast.success(copy.added)
        }
      } catch {
        setError(t.errors.upstream_unavailable)
      } finally {
        locked.current = false
      }
    })
  }
  return (
    <Collapsible
      open={open}
      onOpenChange={(next) => {
        if (pending) return
        setOpen(next)
        if (next) load()
      }}
    >
      {!initialSummary && (
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="corner-brackets h-auto w-full justify-start gap-3 rounded-lg px-2 py-2 text-left"
            aria-label={`${student.fullName || student.email} · ${copy.title}`}
          >
            <Avatar className="size-8 rounded-lg">
              <AvatarFallback className="rounded-lg text-[10px]">
                {initials(student.fullName || student.email)}
              </AvatarFallback>
            </Avatar>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium">
                {student.fullName || student.email}
              </span>
              <span className="text-muted-foreground block truncate text-[11px] font-normal">
                {copy.title}
              </span>
            </span>
            <ChevronDownIcon
              className={`size-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
            />
          </Button>
        </CollapsibleTrigger>
      )}
      <CollapsibleContent>
        <div className="space-y-4 px-2 pb-3 pt-2">
          {pending && !summary ? (
            <p className="text-muted-foreground flex items-center gap-2 text-xs">
              <Loader2Icon className="size-3.5 animate-spin" />
              {t.common.loading}
            </p>
          ) : null}
          {summary && (
            <>
              <div className="bg-muted/40 grid grid-cols-3 gap-2 rounded-lg border p-3">
                {[
                  { label: copy.granted, value: summary.granted },
                  { label: copy.used, value: summary.used },
                  { label: copy.remaining, value: summary.remaining },
                ].map((item) => (
                  <div key={item.label}>
                    <p className="text-lg font-semibold tabular-nums">{item.value}</p>
                    <p className="text-muted-foreground text-[10px]">{item.label}</p>
                  </div>
                ))}
              </div>
              {summary.remaining < 0 && (
                <p className="text-destructive text-xs">
                  {copy.overdrawn.replace('{count}', String(-summary.remaining))}
                </p>
              )}
              {summary.canGrant && (
                <form onSubmit={submit} className="space-y-3">
                  {summary.granted === 0 && summary.used === 0 && (
                    <p className="text-muted-foreground text-xs">{copy.setupHint}</p>
                  )}
                  <div className="flex items-end gap-2">
                    <Field className="min-w-0 flex-1">
                      <FieldLabel htmlFor={`credits-${student.id}`}>{copy.amount}</FieldLabel>
                      <Input
                        id={`credits-${student.id}`}
                        name="units"
                        type="number"
                        min={1}
                        max={1000}
                        step={1}
                        required
                        defaultValue={8}
                        disabled={pending}
                      />
                    </Field>
                    <Button type="submit" disabled={pending} className="corner-brackets">
                      <PlusIcon />
                      {copy.add}
                    </Button>
                  </div>
                  <Input
                    name="note"
                    maxLength={200}
                    placeholder={copy.note}
                    aria-label={copy.note}
                    disabled={pending}
                  />
                </form>
              )}
              <div className="space-y-2">
                <p className="text-xs font-medium">{copy.history}</p>
                {!summary.history.length ? (
                  <p className="text-muted-foreground text-xs">{copy.empty}</p>
                ) : (
                  <ul className="max-h-52 divide-y overflow-y-auto">
                    {summary.history.map((lesson) => (
                      <li
                        key={lesson.id}
                        className="flex items-start justify-between gap-2 py-2 text-xs"
                      >
                        <span className="min-w-0">
                          <span className="block truncate">
                            {lesson.topic || t.lessons.noTopic}
                          </span>
                          <span className="text-muted-foreground block text-[10px]">
                            {date.format(new Date(lesson.scheduledAt))}
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="block">
                            {lesson.status === 'held'
                              ? t.lessons.attendance[lesson.attendance]
                              : t.lessons.status[lesson.status]}
                          </span>
                          <span className="text-muted-foreground block text-[10px]">
                            {lesson.deducted ? copy.deducted : copy.notDeducted}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {!!summary.grants.length && (
                <div className="space-y-2">
                  <p className="text-xs font-medium">{copy.grants}</p>
                  <ul className="-mx-1 max-h-32 divide-y overflow-y-auto overflow-x-hidden px-1">
                    {summary.grants.map((grant) => (
                      <li
                        key={grant.id}
                        className="flex items-start justify-between gap-2 py-2 text-xs"
                      >
                        <span className="min-w-0">
                          <span className="block">{date.format(new Date(grant.createdAt))}</span>
                          {grant.note && (
                            <span className="text-muted-foreground block break-words text-[10px]">
                              {grant.note}
                            </span>
                          )}
                          {grant.reversedAt && (
                            <span className="text-muted-foreground mt-1 block break-words text-[10px]">
                              {date.format(new Date(grant.reversedAt))} · {grant.reversalReason}
                            </span>
                          )}
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-1">
                          <span
                            className={`tabular-nums ${grant.reversedAt ? 'text-muted-foreground line-through' : ''}`}
                          >
                            +{grant.units}
                          </span>
                          {grant.reversedAt ? (
                            <Badge variant="outline">{copy.reversedLabel}</Badge>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="corner-brackets h-6 px-2 text-[11px]"
                              disabled={pending}
                              onClick={() => {
                                setReversing(grant)
                                setReverseError(null)
                              }}
                            >
                              {copy.reverse}
                            </Button>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
          {error && (
            <div role="alert" className="space-y-2">
              <p className="text-destructive text-xs">{error}</p>
              {!summary && (
                <Button
                  variant="outline"
                  className="corner-brackets"
                  onClick={load}
                  disabled={pending}
                >
                  {t.common.retry}
                </Button>
              )}
            </div>
          )}
        </div>
      </CollapsibleContent>
      <Dialog
        open={!!reversing}
        onOpenChange={(next) => {
          if (!next && !locked.current) setReversing(null)
        }}
      >
        <DialogContent showCloseButton={!pending}>
          <DialogHeader>
            <DialogTitle>{copy.reverseTitle}</DialogTitle>
            <DialogDescription>
              {copy.reverseHint.replace('{count}', String(reversing?.units ?? 0))}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={reverse} className="space-y-4">
            <Field>
              <FieldLabel htmlFor={`reverse-reason-${student.id}`}>{copy.reason}</FieldLabel>
              <Input
                id={`reverse-reason-${student.id}`}
                name="reason"
                minLength={3}
                maxLength={200}
                required
                disabled={pending}
                autoFocus
              />
            </Field>
            {reverseError && (
              <p role="alert" className="text-destructive text-xs">
                {reverseError}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="corner-brackets"
                disabled={pending}
                onClick={() => setReversing(null)}
              >
                {t.accounts.form.cancel}
              </Button>
              <Button
                type="submit"
                variant="destructive"
                className="corner-brackets"
                disabled={pending}
              >
                {pending && <Loader2Icon className="animate-spin" />}
                {copy.reverse}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Collapsible>
  )
}
