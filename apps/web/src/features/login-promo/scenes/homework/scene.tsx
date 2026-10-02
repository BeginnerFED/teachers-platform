'use client'

import { CircleCheckIcon, Loader2Icon, SendIcon, XIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { StatusDot } from '@/features/homework/components/status-badge'
import { cn } from '@/lib/utils'
import { useAt, useCue } from '../../engine/clock'
import { PromoPointer, type PointerStep } from '../../engine/pointer'
import { SceneFrame } from '../../engine/scene-frame'
import type { HomeworkCopy } from './copy'

/*
 * The beats, in ms of scene time. The frame mounts the dialog at 1060 and the scene
 * starts leaving at 5420. In between, one teacher gives one lesson to three students —
 * three ticks, one send — and the desk shows three separate copies, settled by ~4570.
 *
 * Every press comes 250 ms after its pointer arrives: 440 ms to the first box, 220 ms
 * hops down the list, 400 ms to the send button.
 */
const MOVES = [1290, 2060, 2610] as const
const PRESSES = [1980, 2530, 3080] as const
const TO_SEND = 3160
const PRESS_SEND = 3810
const CLOSE = 4190
/** The dialog's own close: fade-out and zoom-out-95 over 100 ms, the desk under it. */
const CLOSED = CLOSE + 100
const TOAST = CLOSED

/** A box flips at the bottom of its press, never before the pointer has pressed. */
const TICKS = PRESSES.map((at) => at + 50)
const SENDING = PRESS_SEND + 50

/**
 * The row under the pointer, measured along its eased path: the first once the pointer
 * crosses into it, each next one early in its hop, none once it heads for the button —
 * which it reaches 120 ms into that move.
 */
const ROW_HOVERS = [MOVES[0] + 160, MOVES[1] + 30, MOVES[2] + 30, TO_SEND + 30]
const BUTTON_HOVER = [TO_SEND + 120, SENDING]
const BUTTON_PRESS = [PRESS_SEND, PRESS_SEND + 120]

const POINTER: PointerStep[] = [
  { at: MOVES[0] - 40, appear: { x: 436, y: 604 } },
  { at: MOVES[0], to: 'student-0', duration: 440 },
  { at: PRESSES[0], press: true },
  { at: MOVES[1], to: 'student-1', duration: 220 },
  { at: PRESSES[1], press: true },
  { at: MOVES[2], to: 'student-2', duration: 220 },
  { at: PRESSES[2], press: true },
  { at: TO_SEND, to: 'send', duration: 400 },
  { at: PRESS_SEND, press: true },
  { at: CLOSE, leave: true },
]

type Status = HomeworkCopy['desk'][number]['status']

/** StatusBadge's chips (features/homework/components/status-badge.tsx). */
const CHIP: Record<Status, string> = {
  assigned: 'bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300',
  submitted: 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
  graded: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
}

/** Sonner sets its own face on the toaster: the system one, not the page's Inter. */
const SONNER_FONT =
  'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica Neue, Arial, Noto Sans, sans-serif'

export function HomeworkScene({ copy }: { copy: HomeworkCopy }) {
  return (
    <SceneFrame title={copy.title} line={copy.line} overlay={<PromoPointer script={POINTER} />}>
      <HomeworkFragment copy={copy} />
    </SceneFrame>
  )
}

/**
 * The dialog, then the desk it was opened over. The desk is already there when the
 * dialog starts to close, so closing reveals it the way it does in the product — no
 * empty moment between the two.
 */
function HomeworkFragment({ copy }: { copy: HomeworkCopy }) {
  const stage = useCue([CLOSE, CLOSED])

  return (
    <div className="relative">
      {stage > 0 ? <DeskLook copy={copy} /> : null}
      {stage < 2 ? <AssignDialogLook copy={copy} closing={stage === 1} /> : null}
    </div>
  )
}

/**
 * AssignDialog's recipients pane (assign-dialog.tsx): the DialogContent surface with its
 * close button, the header, the students section and the footer band. The optional
 * deadline and note are left out of the picture.
 */
function AssignDialogLook({ copy, closing }: { copy: HomeworkCopy; closing: boolean }) {
  const chosen = useCue(TICKS)
  const hoveredRow = useCue(ROW_HOVERS) - 1
  const sending = useAt(SENDING)
  const buttonHovered = useCue(BUTTON_HOVER) === 1
  const buttonPressed = useCue(BUTTON_PRESS) === 1

  return (
    <div
      className={cn(
        'bg-popover text-popover-foreground ring-foreground/10 relative grid w-full gap-6 rounded-2xl p-7 text-sm shadow-md ring-1',
        closing &&
          'animate-out fade-out-0 zoom-out-95 fill-mode-forwards absolute inset-x-0 top-0 duration-100',
      )}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h2 className="font-heading text-base font-medium leading-none">{copy.assignTitle}</h2>
          <p className="text-muted-foreground text-sm">{copy.assignBody}</p>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-0.5">
            <span className="flex select-none items-center gap-2 text-xs font-medium leading-none">
              {copy.studentsLabel}
            </span>
            <span className="text-muted-foreground text-xs">{copy.studentsHelp}</span>
          </div>

          <ul className="divide-border/60 border-border/60 divide-y overflow-hidden rounded-xl border">
            {copy.students.map((student, index) => (
              <li key={student.email}>
                <div
                  data-hover={hoveredRow === index || undefined}
                  className="data-[hover]:bg-muted/60 flex items-center gap-3 px-3 py-2 transition-colors"
                >
                  <Checkbox checked={chosen > index} data-anchor={`student-${index}`} />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm">{student.name}</span>
                    <span className="text-muted-foreground truncate text-xs">{student.email}</span>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-muted/50 -mx-4 -mb-4 flex flex-row items-center justify-between gap-2 rounded-b-xl border-t p-4">
          <span className="text-muted-foreground text-xs tabular-nums">
            {chosen} {copy.selected}
          </span>

          <span
            data-hover={(buttonHovered && !sending) || undefined}
            data-pressed={buttonPressed || undefined}
            className={cn(
              buttonVariants(),
              'corner-brackets data-[hover]:bg-primary/80 data-[pressed]:translate-y-px data-[hover]:after:inset-[-4px] data-[hover]:after:opacity-100',
              // Disabled until someone is chosen, and again while it sends.
              (chosen === 0 || sending) && 'opacity-50',
            )}
          >
            {sending ? <Loader2Icon className="animate-spin" /> : <SendIcon />}
            {sending ? copy.sending : copy.send}
            {/* Where the pointer presses: low in the pill, so the arrow hangs below the
                label and "Надсилаємо…" can be read the moment it replaces "Надіслати". */}
            <span aria-hidden data-anchor="send" className="absolute bottom-[7px] left-1/2" />
          </span>
        </div>
      </div>

      <span
        className={cn(
          buttonVariants({ variant: 'ghost', size: 'icon-sm' }),
          'absolute right-2 top-2',
        )}
      >
        <XIcon />
      </span>
    </div>
  )
}

/**
 * The homework desk under the dialog (homework-list.tsx), newest first: a row per
 * student for the lesson just given — each their own copy — over the work already in
 * hand, then the toast the send leaves behind.
 */
function DeskLook({ copy }: { copy: HomeworkCopy }) {
  const toast = useAt(TOAST)

  return (
    <div className="flex flex-col gap-4">
      <ul className="border-border/60 bg-card divide-border/60 divide-y rounded-2xl border">
        {copy.desk.map((row) => (
          <li
            key={`${row.name}-${row.lesson}`}
            className="relative flex items-center gap-3 px-4 py-3.5 first:rounded-t-[inherit] last:rounded-b-[inherit]"
          >
            <StatusDot status={row.status} />

            <div className="min-w-0 flex-1">
              <p className="flex min-w-0 items-baseline gap-1.5 text-sm">
                <span className="shrink-0 font-medium">{row.name}</span>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground truncate">{row.lesson}</span>
              </p>
              <p className="text-muted-foreground truncate text-xs tabular-nums">{row.line}</p>
            </div>

            <Badge
              variant="secondary"
              className={cn(
                'h-auto rounded-full px-2.5 py-1 text-xs font-medium',
                CHIP[row.status],
              )}
            >
              {copy.statuses[row.status]}
            </Badge>

            {/* The row's "⋯" menu keeps its place; it only shows to a pointer on the row. */}
            <span aria-hidden className="size-7 shrink-0" />
          </li>
        ))}
      </ul>

      {toast ? (
        <div className="flex justify-end">
          <div
            style={{ fontFamily: SONNER_FONT }}
            className="animate-rise-in bg-popover text-popover-foreground border-border flex w-[356px] items-center gap-1.5 rounded-[10px] border p-4 text-[13px] shadow-[0_4px_12px_rgba(0,0,0,0.1)]"
          >
            <span className="-ml-[3px] mr-1 flex size-4 shrink-0 items-center justify-start">
              <CircleCheckIcon className="-ml-px size-4 shrink-0" />
            </span>
            <span className="font-medium leading-normal">{copy.sent}</span>
          </div>
        </div>
      ) : null}
    </div>
  )
}
