'use client'

import { useState, useTransition } from 'react'
import { Loader2Icon, SendIcon } from 'lucide-react'
import { toast } from 'sonner'
import type { MaterialOwner } from '@tp/shared'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import { Textarea } from '@/components/ui/textarea'
import type { Messages } from '@/messages'
import { assignMaterial } from '../actions'

/**
 * "Give this lesson to…" — the one place a dialog is right, because the question is who,
 * and the answer is a list of people. Nothing is created here that you would want to land
 * inside of; the homework lands on the students' side.
 *
 * Controlled from outside, so a button on the lesson page and a menu item on a card can
 * both open the same dialog.
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
  materialId: string
  /** The teacher's active students, fetched by the page so this opens with them ready. */
  recipients: MaterialOwner[]
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
      const { created, skipped, error } = await assignMaterial({
        materialId,
        studentIds: [...chosen],
        // The end of the chosen day, in the teacher's own time zone.
        dueAt: due ? new Date(`${due}T23:59:00`).toISOString() : null,
        ...(note.trim() ? { note: note.trim() } : {}),
      })

      if (error) {
        toast.error(t.homework.failed)
        return
      }

      toast.success(`${t.homework.sent}: ${created}`)
      if (skipped > 0) toast.info(`${skipped} ${t.homework.alreadyHad}`)

      onOpenChange(false)
      setChosen(new Set())
      setDue('')
      setNote('')
    })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t.homework.assignTitle}</DialogTitle>
          <DialogDescription>{t.homework.assignBody}</DialogDescription>
        </DialogHeader>

        {recipients.length === 0 ? (
          <p className="text-muted-foreground rounded-md border border-dashed p-6 text-center text-sm">
            {t.homework.noStudents}
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              {recipients.length > 6 ? (
                <Input
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                  placeholder={t.homework.filterStudents}
                  className="h-8 text-sm"
                />
              ) : null}

              <ul className="max-h-60 divide-y overflow-y-auto rounded-md border">
                {shown.map((student) => (
                  <li key={student.id}>
                    <label className="hover:bg-muted/60 flex cursor-pointer items-center gap-3 px-3 py-2">
                      <Checkbox
                        checked={chosen.has(student.id)}
                        onCheckedChange={(on) => toggle(student.id, on === true)}
                      />
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-sm">
                          {student.fullName ?? student.email}
                        </span>
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
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`homework-due-${materialId}`} className="text-xs">
                  {t.homework.dueAt}
                </Label>
                <Input
                  id={`homework-due-${materialId}`}
                  type="date"
                  value={due}
                  onChange={(event) => setDue(event.target.value)}
                  className="h-8 text-sm"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`homework-note-${materialId}`} className="text-xs">
                  {t.homework.note}
                </Label>
                <Textarea
                  id={`homework-note-${materialId}`}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder={t.homework.notePlaceholder}
                  maxLength={500}
                  rows={2}
                  className="min-h-8 text-sm"
                />
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="items-center sm:justify-between">
          <span className="text-muted-foreground text-xs tabular-nums">
            {chosen.size} {t.homework.selected}
          </span>

          <Button
            type="button"
            size="sm"
            disabled={pending || chosen.size === 0}
            onClick={send}
            className="corner-brackets"
          >
            {pending ? <Loader2Icon className="size-4 animate-spin" /> : <SendIcon />}
            {pending ? t.homework.sending : t.homework.send}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
