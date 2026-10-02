'use client'

import { CheckIcon, ChevronDownIcon, Loader2Icon, SparklesIcon, XIcon } from 'lucide-react'
import { memo, useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAt, useCue, useScene, useTyped } from '../../engine/clock'
import { EASE, RISE_MS, staggered, stageRect } from '../../engine/motion'
import { PromoPointer, type PointerStep } from '../../engine/pointer'
import { LEAVING, SceneFrame } from '../../engine/scene-frame'
import type { DraftCopy } from './copy'
import { DRAFT, FIRST_STEP, NOTE, QUESTION, TOPIC } from './data'

/*
 * The beats, in ms from the scene's start. The dialog arrives with the fragment (1060)
 * already open on its form, the topic field focused as the product autofocuses it.
 */
const TYPE_AT = 1600
const TYPE_STEP = 40
const TYPED_AT = TYPE_AT + (TOPIC.length - 1) * TYPE_STEP
const POINTER_AT = 2860
const MOVE_AT = 2900
const MOVE_MS = 480
/** The eased glide is inside the button about a third of the way through. */
const HOVER_AT = 3080
const PRESS_AT = MOVE_AT + MOVE_MS + 260
const GENERATE_AT = PRESS_AT + 120
const POINTER_GONE_AT = GENERATE_AT + 200
/**
 * The preview is built, hidden, while the draft is "generating" — nothing on the main
 * thread is moving then — so revealing it later is one class, not a mount.
 */
const BUILD_AT = GENERATE_AT + 400
const FORM_OUT_AT = GENERATE_AT + 800
/** The form is all but gone 110ms into its 150ms exit; waiting longer leaves a blank card. */
const PREVIEW_AT = FORM_OUT_AT + 110

const POINTER: PointerStep[] = [
  // In from the panel's right margin, clear of the fields (an arrow over a text field
  // would be an I-beam in the product).
  { at: POINTER_AT, appear: { x: 498, y: 352 } },
  { at: MOVE_AT, to: 'generate', duration: MOVE_MS },
  { at: PRESS_AT, press: true },
  { at: POINTER_GONE_AT, leave: true },
]

/** Input's own look; focus and disabled are applied by state rather than by the browser. */
const INPUT =
  'border-input dark:bg-input/30 flex h-8 w-full min-w-0 items-center rounded-lg border bg-transparent px-2.5 py-1 text-sm whitespace-nowrap outline-none'
const FOCUSED = 'border-ring ring-ring/50 ring-3'
const DISABLED = 'bg-input/50 dark:bg-input/80 opacity-50'

/** The product swaps these looks at once; eased over 150ms the dim reads as one state change. */
const SETTLE = 'transition-[color,background-color,border-color,box-shadow,opacity] duration-150'

/**
 * From a topic to a lesson: the AI lesson dialog takes "Ordering food at a restaurant",
 * the teacher asks for a draft, and the draft comes back — steps, exercises and the answer
 * key — for review. Nothing in the lesson changes until the teacher replaces it.
 */
export function DraftScene({ copy }: { copy: DraftCopy }) {
  return (
    <SceneFrame title={copy.title} line={copy.line} overlay={<PromoPointer script={POINTER} />}>
      <AiDialog copy={copy} />
    </SceneFrame>
  )
}

/** DialogContent's surface, floating on the panel without its overlay. */
function AiDialog({ copy }: { copy: DraftCopy }) {
  const { mode } = useScene()
  // 0 the form, 1 the preview built behind it, 2 the preview.
  const stage = useCue([BUILD_AT, PREVIEW_AT])
  const preview = stage === 2
  const ref = useRef<HTMLDivElement>(null)
  const height = useRef<number | null>(null)

  // The preview is taller than the form, so the dialog grows to it — measured on both
  // sides of the swap, so it follows the copy in any language. A still frame just has it.
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return

    const next = stageRect(element)?.height ?? null
    const previous = height.current
    height.current = next
    if (mode === 'still' || previous === null || next === null || Math.abs(next - previous) < 1) {
      return
    }

    const grow = element.animate([{ height: `${previous}px` }, { height: `${next}px` }], {
      duration: RISE_MS,
      easing: EASE,
    })

    return () => grow.cancel()
  }, [stage, mode])

  return (
    <div
      ref={ref}
      className={cn(
        'bg-popover text-popover-foreground ring-foreground/10 relative flex flex-col overflow-hidden rounded-xl p-4 text-sm shadow-md ring-1',
        // Down to 32px above the player's chrome: the preview scrolls inside it.
        preview && 'h-[calc(100%-104px)]',
      )}
    >
      {preview ? null : <Form copy={copy} />}
      {/* Its entrances start when it is first displayed, not when it is built. */}
      {stage > 0 ? (
        <div className={preview ? 'contents' : 'hidden'}>
          <Preview copy={copy} />
        </div>
      ) : null}
    </div>
  )
}

/** The dialog's ghost close button; the product hides it while a draft is being made. */
function CloseButton({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        buttonVariants({ variant: 'ghost', size: 'icon-sm' }),
        'absolute right-2 top-2',
        className,
      )}
    >
      <XIcon />
    </span>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="group/field flex w-full flex-col gap-2">
      <span className="flex w-fit select-none items-center gap-2 text-sm font-medium leading-snug">
        {label}
      </span>
      {children}
    </div>
  )
}

function SelectLook({ value, disabled }: { value: string; disabled: boolean }) {
  return (
    <div
      className={cn(
        'border-input dark:bg-input/30 flex h-8 w-full select-none items-center justify-between gap-1.5 whitespace-nowrap rounded-lg border bg-transparent py-2 pl-2.5 pr-2 text-sm',
        SETTLE,
        disabled && 'opacity-50',
      )}
    >
      <span className="line-clamp-1 flex items-center gap-1.5">{value}</span>
      <ChevronDownIcon className="text-muted-foreground pointer-events-none size-4 shrink-0" />
    </div>
  )
}

/** The autofocused topic field: a blinking caret, the topic typed in, then disabled. */
function TopicInput({ placeholder }: { placeholder: string }) {
  const typed = useTyped(TOPIC, TYPE_AT, TYPE_STEP)
  // 0 waiting, 1 typing (the caret holds still), 2 typed, 3 pressed elsewhere (focus has
  // left with the mousedown), 4 generating.
  const state = useCue([TYPE_AT, TYPED_AT + 2 * TYPE_STEP, PRESS_AT, GENERATE_AT])
  const focused = state < 3

  const caret = focused ? (
    <span className={cn('bg-foreground h-4 w-px shrink-0', state !== 1 && 'animate-caret-blink')} />
  ) : null

  return (
    <div className={cn(INPUT, SETTLE, focused && FOCUSED, state === 4 && DISABLED)}>
      {typed ? (
        <>
          <span className="whitespace-pre">{typed}</span>
          {caret}
        </>
      ) : (
        <>
          {caret}
          <span className="text-muted-foreground -ml-px">{placeholder}</span>
        </>
      )}
    </div>
  )
}

/** The form stage, as ai-lesson-dialog.tsx lays it out (field hints left out). */
function Form({ copy }: { copy: DraftCopy }) {
  // 0 idle, 1 hovered, 2 pressed, 3 generating.
  const button = useCue([HOVER_AT, PRESS_AT, GENERATE_AT])
  const generating = button === 3
  const leaving = useAt(FORM_OUT_AT)

  return (
    <div className={cn('flex flex-col gap-5', leaving && LEAVING)}>
      {generating ? null : <CloseButton />}

      <div className="flex flex-col gap-2">
        <p className="font-heading flex items-center gap-2 text-base font-medium leading-none">
          <span className="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-full">
            <SparklesIcon className="size-4" />
          </span>
          {copy.dialogTitle}
        </p>
        <p className="text-muted-foreground text-sm">{copy.dialogDescription}</p>
      </div>

      <div className="grid gap-4">
        <Field label={copy.topic}>
          <TopicInput placeholder={copy.topicPlaceholder} />
        </Field>

        <Field label={copy.instructions}>
          <div
            className={cn(
              'border-input dark:bg-input/30 flex min-h-16 w-full rounded-lg border bg-transparent px-2.5 py-2 text-sm',
              SETTLE,
              generating && DISABLED,
            )}
          >
            <span className="text-muted-foreground">{copy.instructionsPlaceholder}</span>
          </div>
        </Field>

        <div className="grid grid-cols-3 gap-4">
          <Field label={copy.targetLanguage}>
            <div className={cn(INPUT, SETTLE, generating && DISABLED)}>{copy.language}</div>
          </Field>
          <Field label={copy.level}>
            <SelectLook value={DRAFT.level} disabled={generating} />
          </Field>
          <Field label={copy.stepCount}>
            <SelectLook value={String(DRAFT.stepCount)} disabled={generating} />
          </Field>
        </div>
      </div>

      <div className="bg-muted/50 -mx-4 -mb-4 flex flex-row justify-end gap-2 rounded-b-xl border-t p-4">
        <span
          className={cn(
            buttonVariants({ variant: 'outline' }),
            'corner-brackets',
            generating && 'opacity-50',
          )}
        >
          {copy.cancel}
        </span>
        <span
          data-hover={button === 1 || button === 2 || undefined}
          data-pressed={button === 2 || undefined}
          className={cn(
            buttonVariants(),
            'corner-brackets data-[hover]:bg-primary/80 data-[pressed]:translate-y-px data-[hover]:after:inset-[-4px] data-[hover]:after:opacity-100',
            generating && 'opacity-50',
          )}
        >
          {generating ? <Loader2Icon className="animate-spin" /> : <SparklesIcon />}
          {generating ? copy.generating : copy.generate}
          {/* Where the click lands: right of centre and low, so the arrow leaves the label legible. */}
          <span data-anchor="generate" className="absolute left-[62%] top-[74%] size-px" />
        </span>
      </div>
    </div>
  )
}

/**
 * The preview stage: the draft card with step 1 open, as the accordion opens it by
 * default. Cropped by the dialog's height and faded at the bottom, the way a long preview
 * scrolls inside the dialog. Memoised: revealing it re-renders the dialog, not all of this.
 */
const Preview = memo(function Preview({ copy }: { copy: DraftCopy }) {
  return (
    <>
      <CloseButton className="animate-rise-in" />

      <div className="min-h-0 flex-1 overflow-hidden [mask-image:linear-gradient(to_bottom,black_calc(100%-36px),transparent)]">
        <div className="flex flex-col gap-5">
          <div className="animate-rise-in flex flex-col gap-2">
            <p className="font-heading text-base font-medium leading-none">{copy.previewTitle}</p>
            <p className="text-muted-foreground text-sm">{copy.previewDescription}</p>
          </div>

          <div
            className="border-border/60 bg-card animate-rise-in flex flex-col gap-4 rounded-xl border p-4"
            style={staggered(1)}
          >
            <div className="animate-rise-in flex flex-col gap-1" style={staggered(2)}>
              <h3 className="font-medium">{DRAFT.title}</h3>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <Badge variant="outline">{DRAFT.level}</Badge>
                {DRAFT.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="border-border/60 flex w-full flex-col overflow-hidden rounded-lg border">
              <div className="not-last:border-b">
                <div className="animate-rise-in flex" style={staggered(3)}>
                  <div className="relative flex flex-1 items-start justify-between rounded-none border border-transparent px-3 py-3 text-left text-sm font-medium">
                    <span className="flex min-w-0 items-start gap-3 pr-3">
                      <span className="bg-muted text-muted-foreground flex size-6 shrink-0 items-center justify-center rounded-full text-xs tabular-nums">
                        1
                      </span>
                      <span className="min-w-0 text-left">
                        <span className="block text-sm font-medium">{FIRST_STEP.title}</span>
                        <span className="text-muted-foreground mt-0.5 block text-xs font-normal">
                          {copy.stepSummary}
                        </span>
                      </span>
                    </span>
                    <ChevronDownIcon className="text-muted-foreground pointer-events-none ml-auto size-4 shrink-0 rotate-180" />
                  </div>
                </div>

                <div className="overflow-hidden text-sm">
                  <div className="bg-muted/15 px-3 pb-3 pt-0">
                    <div className="grid gap-2">
                      <section
                        className="border-border/60 bg-background animate-rise-in flex flex-col gap-2.5 rounded-lg border p-3"
                        style={staggered(4)}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{copy.multipleChoice}</Badge>
                        </div>
                        <div className="flex flex-col gap-2.5">
                          <div className="whitespace-pre-wrap text-sm font-medium">
                            {QUESTION.prompt}
                          </div>
                          <ul className="grid gap-1.5">
                            {QUESTION.options.map((option, index) => (
                              <OptionRow
                                key={option.text}
                                text={option.text}
                                correct={option.correct}
                                label={copy.correct}
                                style={staggered(5 + index)}
                              />
                            ))}
                          </ul>
                        </div>
                      </section>

                      <section
                        className="border-border/60 bg-background animate-rise-in flex flex-col gap-2.5 rounded-lg border p-3"
                        style={staggered(8)}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{copy.callout}</Badge>
                        </div>
                        <div className="bg-muted/45 flex flex-col gap-1.5 rounded-lg border px-3 py-2.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium">{NOTE.title}</span>
                            <Badge variant="outline" className="bg-background">
                              {copy.grammar}
                            </Badge>
                          </div>
                          <div className="text-muted-foreground whitespace-pre-wrap text-sm leading-relaxed">
                            {NOTE.text}
                          </div>
                        </div>
                      </section>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
})

/** One option of the multiple-choice preview; the answer key marks the right one. */
function OptionRow({
  text,
  correct,
  label,
  style,
}: {
  text: string
  correct: boolean
  label: string
  style: CSSProperties
}) {
  return (
    <li
      className={cn(
        'animate-rise-in',
        correct
          ? 'border-primary/25 bg-primary/8 flex items-start gap-2 rounded-md border px-2.5 py-2 text-sm'
          : 'bg-muted/35 flex items-start gap-2 rounded-md border border-transparent px-2.5 py-2 text-sm',
      )}
      style={style}
    >
      {correct ? (
        <CheckIcon className="text-primary mt-0.5 size-3.5 shrink-0" />
      ) : (
        <span className="border-muted-foreground/40 mt-1 size-2.5 shrink-0 rounded-full border" />
      )}
      <span className="min-w-0 flex-1 whitespace-pre-wrap">{text}</span>
      {correct ? <span className="text-primary shrink-0 text-xs font-medium">{label}</span> : null}
    </li>
  )
}
