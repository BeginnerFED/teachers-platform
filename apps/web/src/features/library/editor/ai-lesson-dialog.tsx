'use client'

import { useId, useState } from 'react'
import { ArrowRightIcon, CheckIcon, Loader2Icon, SparklesIcon, XIcon } from 'lucide-react'
import {
  LEVELS,
  type AiLessonBlock,
  type AiLimitDetails,
  type GenerateLessonDraftBody,
  type GeneratedLessonDraft,
  type Level,
} from '@tp/shared'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
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
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { aiLimitMessage } from '@/features/ai/components/ai-usage-meter'
import type { Messages } from '@/messages'
import { generateLessonDraft } from '../actions'

type Stage = 'form' | 'preview'

function DraftBlockContent({ block, t }: { block: AiLessonBlock; t: Messages }) {
  const fields = t.library.editor.fields

  switch (block.type) {
    case 'heading':
      return (
        <div className={block.level === 2 ? 'text-base font-semibold' : 'text-sm font-semibold'}>
          {block.text}
        </div>
      )

    case 'text':
      return <div className="whitespace-pre-wrap text-sm leading-relaxed">{block.text}</div>

    case 'callout':
      return (
        <div className="bg-muted/45 flex flex-col gap-1.5 rounded-lg border px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            {block.title ? <span className="text-sm font-medium">{block.title}</span> : null}
            <Badge variant="outline" className="bg-background">
              {fields.tones[block.tone]}
            </Badge>
          </div>
          <div className="text-muted-foreground whitespace-pre-wrap text-sm leading-relaxed">
            {block.text}
          </div>
        </div>
      )

    case 'divider':
      return <Separator className="my-2" />

    case 'multiple_choice':
      return (
        <div className="flex flex-col gap-2.5">
          <div className="whitespace-pre-wrap text-sm font-medium">{block.prompt}</div>
          <ul className="grid gap-1.5" aria-label={fields.options}>
            {block.options.map((option) => {
              const correct = block.correctIds.includes(option.id)

              return (
                <li
                  key={option.id}
                  className={
                    correct
                      ? 'border-primary/25 bg-primary/8 flex items-start gap-2 rounded-md border px-2.5 py-2 text-sm'
                      : 'bg-muted/35 flex items-start gap-2 rounded-md border border-transparent px-2.5 py-2 text-sm'
                  }
                >
                  {correct ? (
                    <CheckIcon
                      className="text-primary mt-0.5 size-3.5 shrink-0"
                      aria-hidden="true"
                    />
                  ) : (
                    <span
                      className="border-muted-foreground/40 mt-1 size-2.5 shrink-0 rounded-full border"
                      aria-hidden="true"
                    />
                  )}
                  <span className="min-w-0 flex-1 whitespace-pre-wrap">{option.text}</span>
                  {correct ? (
                    <span className="text-primary shrink-0 text-xs font-medium">
                      {fields.correct}
                    </span>
                  ) : null}
                </li>
              )
            })}
          </ul>
          {block.explanation ? (
            <div className="text-muted-foreground border-l-primary/40 border-l-2 pl-2.5 text-xs leading-relaxed">
              <span className="text-foreground font-medium">{fields.explanation}: </span>
              {block.explanation}
            </div>
          ) : null}
        </div>
      )

    case 'gap_fill':
      return (
        <div className="flex flex-col gap-2.5">
          {block.prompt ? (
            <div className="whitespace-pre-wrap text-sm font-medium">{block.prompt}</div>
          ) : null}
          <div className="bg-muted/30 flex flex-wrap items-baseline gap-x-1 gap-y-1.5 rounded-md px-3 py-2.5 text-sm leading-7">
            {block.segments.map((segment, index) =>
              segment.kind === 'text' ? (
                <span key={`${index}-${segment.text}`} className="whitespace-pre-wrap">
                  {segment.text}
                </span>
              ) : (
                <span
                  key={segment.id}
                  className="border-primary/25 bg-primary/8 text-primary inline-flex min-h-7 items-center rounded-md border px-2 font-medium"
                >
                  <span className="sr-only">{fields.answer}: </span>
                  {segment.answers.join(' / ')}
                  {segment.hint ? (
                    <span className="text-muted-foreground ml-1.5 text-xs font-normal">
                      · {fields.hint}: {segment.hint}
                    </span>
                  ) : null}
                </span>
              ),
            )}
          </div>
        </div>
      )

    case 'matching':
      return (
        <div className="flex flex-col gap-2.5">
          {block.prompt ? (
            <div className="whitespace-pre-wrap text-sm font-medium">{block.prompt}</div>
          ) : null}
          <ul className="grid gap-1.5" aria-label={fields.pairs}>
            {block.pairs.map((pair) => (
              <li
                key={pair.id}
                className="bg-muted/30 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 rounded-md px-2.5 py-2 text-sm"
              >
                <span className="min-w-0 whitespace-pre-wrap">{pair.left}</span>
                <ArrowRightIcon className="text-muted-foreground size-3.5" aria-hidden="true" />
                <span className="min-w-0 whitespace-pre-wrap">{pair.right}</span>
              </li>
            ))}
          </ul>
        </div>
      )

    case 'true_false':
      return (
        <div className="flex flex-col gap-2.5">
          {block.prompt ? (
            <div className="whitespace-pre-wrap text-sm font-medium">{block.prompt}</div>
          ) : null}
          <ul className="grid gap-1.5" aria-label={fields.statements}>
            {block.statements.map((statement) => (
              <li
                key={statement.id}
                className="bg-muted/30 flex items-start justify-between gap-3 rounded-md px-2.5 py-2 text-sm"
              >
                <span className="min-w-0 whitespace-pre-wrap">{statement.text}</span>
                <Badge variant={statement.isTrue ? 'default' : 'secondary'}>
                  {statement.isTrue ? t.library.blocks.isTrue : t.library.blocks.isFalse}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      )

    case 'flashcards':
      return (
        <div className="flex flex-col gap-2.5">
          {block.prompt ? (
            <div className="whitespace-pre-wrap text-sm font-medium">{block.prompt}</div>
          ) : null}
          <ul className="grid gap-1.5" aria-label={fields.cards}>
            {block.cards.map((card) => (
              <li
                key={card.id}
                className="bg-muted/30 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-2 rounded-md px-2.5 py-2 text-sm"
              >
                <span className="min-w-0 whitespace-pre-wrap font-medium">{card.front}</span>
                <ArrowRightIcon
                  className="text-muted-foreground mt-0.5 size-3.5"
                  aria-hidden="true"
                />
                <span className="min-w-0 whitespace-pre-wrap">
                  {card.back}
                  {card.hint ? (
                    <span className="text-muted-foreground mt-0.5 block text-xs">
                      {fields.hint}: {card.hint}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )

    case 'reading':
      return (
        <div className="flex flex-col gap-1.5">
          {block.title ? <div className="text-sm font-medium">{block.title}</div> : null}
          <div className="text-muted-foreground whitespace-pre-wrap text-sm leading-relaxed">
            {block.passage}
          </div>
        </div>
      )

    case 'free_writing':
      return (
        <div className="flex flex-col gap-2.5">
          <div className="whitespace-pre-wrap text-sm font-medium">{block.prompt}</div>
          {block.minWords || block.maxWords ? (
            <div className="flex flex-wrap gap-1.5">
              {block.minWords ? (
                <Badge variant="secondary">
                  {fields.minWords}: {block.minWords}
                </Badge>
              ) : null}
              {block.maxWords ? (
                <Badge variant="secondary">
                  {fields.maxWords}: {block.maxWords}
                </Badge>
              ) : null}
            </div>
          ) : null}
          {block.rubric ? (
            <div className="text-muted-foreground border-l-primary/40 border-l-2 pl-2.5 text-xs leading-relaxed">
              <span className="text-foreground font-medium">{fields.rubric}: </span>
              {block.rubric}
            </div>
          ) : null}
        </div>
      )
  }
}

function DraftBlockPreview({ block, t }: { block: AiLessonBlock; t: Messages }) {
  return (
    <section
      className="border-border/60 bg-background flex flex-col gap-2.5 rounded-lg border p-3"
      aria-label={t.library.editor.blocks[block.type]}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{t.library.editor.blocks[block.type]}</Badge>
      </div>
      <DraftBlockContent block={block} t={t} />
    </section>
  )
}

export function AiLessonDialog({
  defaultLevel,
  hasExistingSteps,
  onFlush,
  onApply,
  locale,
  t,
}: {
  defaultLevel: Level
  hasExistingSteps: boolean
  onFlush: () => Promise<void>
  onApply: (draft: GeneratedLessonDraft) => Promise<string | null>
  locale: string
  t: Messages
}) {
  const copy = t.library.editor.ai
  const topicId = useId()
  const instructionsId = useId()
  const languageId = useId()
  const levelId = useId()
  const stepCountId = useId()
  const [open, setOpen] = useState(false)
  const [stage, setStage] = useState<Stage>('form')
  const [topic, setTopic] = useState('')
  const [instructions, setInstructions] = useState('')
  const [targetLanguage, setTargetLanguage] = useState(copy.defaultTargetLanguage)
  const [level, setLevel] = useState<Level>(defaultLevel)
  const [stepCount, setStepCount] = useState(4)
  const [draft, setDraft] = useState<GeneratedLessonDraft | null>(null)
  const [generating, setGenerating] = useState(false)
  const [applying, setApplying] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [discarding, setDiscarding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const busy = generating || applying

  const reset = () => {
    setStage('form')
    setDraft(null)
    setError(null)
    setConfirming(false)
    setDiscarding(false)
  }

  const setDialogOpen = (next: boolean) => {
    if (busy || confirming || discarding) return
    if (!next && draft) {
      // An accidental Escape, overlay click or close must not silently discard a paid draft.
      setDiscarding(true)
      return
    }
    setOpen(next)
    if (!next) reset()
  }

  const messageFor = (code: string, limit?: AiLimitDetails | null) => {
    if (limit) return aiLimitMessage({ details: limit, feature: 'lessonDraft', locale, t })
    if (code === 'unsaved_changes') return copy.unsavedChanges
    if (code in t.errors) return t.errors[code as keyof typeof t.errors]
    return copy.failed
  }

  const generate = async () => {
    const request: GenerateLessonDraftBody = {
      topic: topic.trim(),
      instructions: instructions.trim() || undefined,
      targetLanguage: targetLanguage.trim(),
      level,
      stepCount,
    }

    if (request.topic.length < 2 || request.targetLanguage.length < 2) {
      setError(copy.required)
      return
    }

    setGenerating(true)
    setError(null)

    try {
      await onFlush()
    } catch {
      setError(copy.unsavedChanges)
      setGenerating(false)
      return
    }

    try {
      const result = await generateLessonDraft(request)

      if (result.error || !result.draft) {
        setError(messageFor(result.error ?? 'internal', result.limit))
        return
      }

      setDraft(result.draft)
      setStage('preview')
    } catch {
      setError(copy.failed)
    } finally {
      setGenerating(false)
    }
  }

  const apply = async () => {
    if (!draft) return

    setApplying(true)
    setError(null)

    try {
      const applyError = await onApply(draft)

      if (applyError) {
        setError(messageFor(applyError))
        setConfirming(false)
        return
      }

      setConfirming(false)
      setOpen(false)
      reset()
    } catch {
      setError(copy.failed)
      setConfirming(false)
    } finally {
      setApplying(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <Button type="button" variant="outline" className="corner-brackets">
            <SparklesIcon />
            {copy.trigger}
          </Button>
        </DialogTrigger>

        <DialogContent
          className="max-h-[min(760px,calc(100vh-2rem))] overflow-y-auto sm:max-w-2xl"
          showCloseButton={false}
        >
          {!busy ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="absolute right-2 top-2"
              aria-label={copy.close}
              onClick={() => setDialogOpen(false)}
            >
              <XIcon aria-hidden="true" />
            </Button>
          ) : null}
          {stage === 'form' ? (
            <form
              className="flex flex-col gap-5"
              onSubmit={(event) => {
                event.preventDefault()
                void generate()
              }}
            >
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span className="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-full">
                    <SparklesIcon className="size-4" />
                  </span>
                  {copy.title}
                </DialogTitle>
                <DialogDescription>{copy.description}</DialogDescription>
              </DialogHeader>

              <div className="grid gap-4">
                <Field>
                  <FieldLabel htmlFor={topicId}>{copy.topic}</FieldLabel>
                  <Input
                    id={topicId}
                    value={topic}
                    onChange={(event) => setTopic(event.target.value)}
                    placeholder={copy.topicPlaceholder}
                    maxLength={500}
                    disabled={generating}
                    autoFocus
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor={instructionsId}>{copy.instructions}</FieldLabel>
                  <Textarea
                    id={instructionsId}
                    value={instructions}
                    onChange={(event) => setInstructions(event.target.value)}
                    placeholder={copy.instructionsPlaceholder}
                    maxLength={2000}
                    rows={3}
                    disabled={generating}
                  />
                  <FieldDescription>{copy.instructionsHint}</FieldDescription>
                  <FieldDescription>{copy.dataNotice}</FieldDescription>
                </Field>

                <div className="grid gap-4 sm:grid-cols-3">
                  <Field className="sm:col-span-1">
                    <FieldLabel htmlFor={languageId}>{copy.targetLanguage}</FieldLabel>
                    <Input
                      id={languageId}
                      value={targetLanguage}
                      onChange={(event) => setTargetLanguage(event.target.value)}
                      placeholder={copy.languagePlaceholder}
                      maxLength={80}
                      disabled={generating}
                    />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor={levelId}>{copy.level}</FieldLabel>
                    <Select
                      value={level}
                      onValueChange={(next) => setLevel(next as Level)}
                      disabled={generating}
                    >
                      <SelectTrigger id={levelId} className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LEVELS.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor={stepCountId}>{copy.stepCount}</FieldLabel>
                    <Select
                      value={String(stepCount)}
                      onValueChange={(next) => setStepCount(Number(next))}
                      disabled={generating}
                    >
                      <SelectTrigger id={stepCountId} className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 8 }, (_, index) => index + 1).map((count) => (
                          <SelectItem key={count} value={String(count)}>
                            {count}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>

                {error ? <FieldError>{error}</FieldError> : null}
              </div>

              <DialogFooter>
                {draft ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="corner-brackets"
                    disabled={generating}
                    onClick={() => {
                      setError(null)
                      setStage('preview')
                    }}
                  >
                    {copy.backToPreview}
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  className="corner-brackets"
                  disabled={generating}
                  onClick={() => setDialogOpen(false)}
                >
                  {copy.cancel}
                </Button>
                <Button type="submit" className="corner-brackets" disabled={generating}>
                  {generating ? <Loader2Icon className="animate-spin" /> : <SparklesIcon />}
                  {generating ? copy.generating : copy.generate}
                </Button>
              </DialogFooter>
            </form>
          ) : draft ? (
            <div className="flex flex-col gap-5">
              <DialogHeader>
                <DialogTitle>{copy.previewTitle}</DialogTitle>
                <DialogDescription>{copy.previewDescription}</DialogDescription>
              </DialogHeader>

              <div className="border-border/60 bg-card flex flex-col gap-4 rounded-xl border p-4">
                <div className="flex flex-col gap-1">
                  <h3 className="font-medium">{draft.title}</h3>
                  {draft.description ? (
                    <p className="text-muted-foreground whitespace-pre-wrap text-sm leading-relaxed">
                      {draft.description}
                    </p>
                  ) : null}
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <Badge variant="outline">{draft.level}</Badge>
                    {draft.tags.length > 0
                      ? draft.tags.map((tag, index) => (
                          <Badge key={`${tag}-${index}`} variant="secondary">
                            {tag}
                          </Badge>
                        ))
                      : null}
                  </div>
                </div>

                <Accordion
                  type="multiple"
                  defaultValue={draft.steps.length > 0 ? ['step-0'] : []}
                  className="border-border/60 overflow-hidden rounded-lg border"
                >
                  {draft.steps.map((step, index) => (
                    <AccordionItem key={`${index}-${step.title}`} value={`step-${index}`}>
                      <AccordionTrigger className="hover:bg-muted/35 rounded-none px-3 py-3 hover:no-underline">
                        <span className="flex min-w-0 items-start gap-3 pr-3">
                          <span className="bg-muted text-muted-foreground flex size-6 shrink-0 items-center justify-center rounded-full text-xs tabular-nums">
                            {index + 1}
                          </span>
                          <span className="min-w-0 text-left">
                            <span className="block text-sm font-medium">{step.title}</span>
                            <span className="text-muted-foreground mt-0.5 block text-xs font-normal">
                              {step.blocks.length} {copy.blocks}
                              {step.blocks.length > 0
                                ? ` · ${[
                                    ...new Set(
                                      step.blocks.map(
                                        (block) => t.library.editor.blocks[block.type],
                                      ),
                                    ),
                                  ].join(', ')}`
                                : ''}
                            </span>
                          </span>
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="bg-muted/15 px-3 pb-3 [&_p:not(:last-child)]:mb-0">
                        <div className="grid gap-2">
                          {step.blocks.map((block) => (
                            <DraftBlockPreview key={block.id} block={block} t={t} />
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>

              {error ? <FieldError>{error}</FieldError> : null}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  className="corner-brackets"
                  disabled={applying}
                  onClick={() => {
                    setError(null)
                    setStage('form')
                  }}
                >
                  {copy.editRequest}
                </Button>
                <Button
                  type="button"
                  className="corner-brackets"
                  disabled={applying}
                  onClick={() => setConfirming(true)}
                >
                  {applying ? <Loader2Icon className="animate-spin" /> : <SparklesIcon />}
                  {applying ? copy.applying : copy.replace}
                </Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirming} onOpenChange={(next) => !applying && setConfirming(next)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy.confirm.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {hasExistingSteps ? copy.confirm.withExistingSteps : copy.confirm.emptyLesson}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="corner-brackets" disabled={applying}>
              {copy.confirm.cancel}
            </AlertDialogCancel>
            <AlertDialogAction
              className="corner-brackets"
              disabled={applying}
              onClick={(event) => {
                event.preventDefault()
                void apply()
              }}
            >
              {applying ? <Loader2Icon className="animate-spin" /> : null}
              {applying ? copy.applying : copy.confirm.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={discarding} onOpenChange={(next) => setDiscarding(next)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy.discard.title}</AlertDialogTitle>
            <AlertDialogDescription>{copy.discard.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="corner-brackets">{copy.discard.cancel}</AlertDialogCancel>
            <AlertDialogAction
              className="corner-brackets"
              onClick={() => {
                setOpen(false)
                reset()
              }}
            >
              {copy.discard.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
