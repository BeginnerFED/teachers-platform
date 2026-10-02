'use client'

import {
  CheckCircle2Icon,
  CircleCheckIcon,
  ClipboardCheckIcon,
  Loader2Icon,
  SparklesIcon,
} from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldLabel } from '@/components/ui/field'
import { cn } from '@/lib/utils'
import { useAt, useCue } from '../../engine/clock'
import { COLUMN_WIDTH } from '../../engine/motion'
import { PromoPointer } from '../../engine/pointer'
import { SceneFrame } from '../../engine/scene-frame'
import type { FeedbackCopy } from './copy'
import { DRAFT } from './data'

/**
 * The moments of the scene, in ms from its start. The card arrives at 1060 (the frame's
 * default) with the assistant already drafting — after the consent the product asks for.
 */
const AT = {
  /** The draft lands in the field all at once, the way `setFeedback` puts it there. */
  draft: 2300,
  pointer: 3050,
  travel: 3100,
  /** The pointer is over the button and slowing: the brackets settle around it. */
  hover: 3350,
  press: 3900,
  saving: 4000,
  leave: 4250,
  /** The save has come back: the toast, and the assistant free again. */
  saved: 4550,
  /** The refresh after it: under the toast, the button now offers 'Оновити відгук'. */
  refreshed: 4870,
}

/**
 * The real card is taller than the space under the caption, so it is drawn at a wider
 * authored width and zoomed to the column — shown a little smaller rather than different.
 */
const SCALE = 0.88

/** Where the review stands: 0 drafting, 1 draft in the field, 2 saving, 3 saved, 4 refreshed. */
const PHASES = [AT.draft, AT.saving, AT.saved, AT.refreshed]

/** The pointer on 'Завершити перевірку' until the click turns it into saving. */
const HOVER = [AT.hover, AT.saving]
const PRESS = [AT.press, AT.saving]

/**
 * The review card of handed-in homework (features/homework/components/review-panel.tsx,
 * FeedbackCard): the exercises are already marked, the assistant drafts the feedback for
 * the written answer, and the teacher is the one who completes the review.
 */
export function FeedbackScene({ copy }: { copy: FeedbackCopy }) {
  return (
    <SceneFrame
      title={copy.title}
      line={copy.line}
      overlay={
        <PromoPointer
          script={[
            { at: AT.pointer, appear: { x: 500, y: 552 } },
            { at: AT.travel, to: 'complete', duration: 500 },
            { at: AT.press, press: true },
            { at: AT.leave, leave: true },
          ]}
        />
      }
    >
      <div className="relative">
        <div style={{ width: COLUMN_WIDTH / SCALE, zoom: SCALE }}>
          <ReviewCard copy={copy} />
        </div>
        <SavedToast copy={copy} />
      </div>
    </SceneFrame>
  )
}

function ReviewCard({ copy }: { copy: FeedbackCopy }) {
  const phase = useCue(PHASES)
  const hover = useCue(HOVER) === 1
  const pressed = useCue(PRESS) === 1

  const drafting = phase === 0
  /** The draft waits for the teacher: the assistant stays disabled until the review is saved. */
  const assistantFree = phase >= 3

  return (
    <Card size="sm">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <ClipboardCheckIcon className="text-muted-foreground size-4" />
          {copy.evaluation}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="bg-muted/35 rounded-lg border px-3 py-2.5">
          <div className="flex items-center gap-2 text-sm font-medium">
            <CheckCircle2Icon className="size-4 shrink-0 text-emerald-600" />
            {copy.exercises}
          </div>
          <p className="text-muted-foreground mt-1.5 pl-6 text-xs leading-relaxed">
            {copy.exercisesHint}
          </p>
        </div>

        <div className="bg-primary/5 ring-primary/10 rounded-lg p-3 ring-1">
          <div className="flex items-start gap-3">
            <span className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-full">
              <SparklesIcon className="size-4" />
            </span>
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-medium">{copy.assistantTitle}</p>
              <p className="text-muted-foreground text-xs leading-relaxed">{copy.assistantHint}</p>
            </div>
          </div>

          <span
            className={cn(
              buttonVariants({ variant: 'outline', size: 'sm' }),
              'corner-brackets mt-3 w-full',
              !assistantFree && 'opacity-50',
            )}
          >
            {drafting ? <Loader2Icon className="animate-spin" /> : <SparklesIcon />}
            {drafting ? copy.generating : copy.assistantAction}
          </span>
        </div>

        <Field>
          <FieldLabel>{copy.feedback}</FieldLabel>
          <div className="border-input dark:bg-input/30 flex min-h-36 w-full rounded-lg border bg-transparent px-2.5 py-2 text-sm">
            {drafting ? (
              <p className="text-muted-foreground">{copy.feedbackPlaceholder}</p>
            ) : (
              <p className="animate-in fade-in-0 whitespace-pre-wrap duration-200">{DRAFT}</p>
            )}
          </div>
        </Field>
      </CardContent>

      <CardFooter className="flex-col gap-2">
        <span
          data-hover={hover || undefined}
          data-pressed={pressed || undefined}
          className={cn(
            buttonVariants(),
            'corner-brackets w-full',
            'data-[hover]:bg-primary/80 data-[pressed]:translate-y-px data-[hover]:after:inset-[-4px] data-[hover]:after:opacity-100',
            phase !== 1 && 'opacity-50',
          )}
        >
          {/* Where the pointer comes to rest: on the button, clear of its label. */}
          <span data-anchor="complete" className="absolute right-[24%] top-1/2 size-0" />
          {phase === 2 || phase === 3 ? <Loader2Icon className="animate-spin" /> : null}
          {phase === 2 || phase === 3 ? copy.saving : phase === 4 ? copy.update : copy.complete}
        </span>
      </CardFooter>
    </Card>
  )
}

/**
 * The product's success toast (components/ui/sonner.tsx over sonner's own styles), where a
 * laptop screen puts it: over the foot of the card. Wide enough to cover the button it
 * answers, so no stub of it shows beside the toast.
 */
function SavedToast({ copy }: { copy: FeedbackCopy }) {
  const saved = useAt(AT.saved)
  if (!saved) return null

  return (
    <div className="animate-rise-in bg-popover text-popover-foreground absolute inset-x-2 -bottom-[7px] flex items-center gap-1.5 rounded-[10px] border p-4 font-[ui-sans-serif,system-ui,sans-serif] text-[13px] shadow-[0_4px_12px_rgba(0,0,0,0.1)]">
      <span className="-ml-[3px] mr-1 flex size-4 shrink-0 items-center">
        <CircleCheckIcon className="-ml-px size-4" />
      </span>
      <span className="font-medium leading-normal">{copy.saved}</span>
    </div>
  )
}
