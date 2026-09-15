'use client'

import { useEffect, useMemo, useState, useTransition, type CSSProperties } from 'react'
import {
  EyeIcon,
  HandIcon,
  Loader2Icon,
  SmilePlusIcon,
  TimerIcon,
  UsersIcon,
  XIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import type { LivePresence, LiveReactionKind, LiveTimerState, SetLiveTimerBody } from '@tp/shared'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Progress } from '@/components/ui/progress'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { initials } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Messages } from '@/messages'
import { setLiveTimer } from '../actions'
import type { Person, RemoteFocus, RemoteReaction, RoomState } from '../use-live-room'
import { colorFor } from './presence-overlay'

const TIMER_PRESETS_MINUTES = [1, 3, 5, 10] as const

const REACTIONS = [
  { kind: 'thumbs_up', emoji: '👍', label: 'thumbsUp' },
  { kind: 'clap', emoji: '👏', label: 'clap' },
  { kind: 'heart', emoji: '❤️', label: 'heart' },
  { kind: 'celebrate', emoji: '🎉', label: 'celebrate' },
] as const satisfies ReadonlyArray<{
  kind: LiveReactionKind
  emoji: string
  label: 'thumbsUp' | 'clap' | 'heart' | 'celebrate'
}>

const emojiFor = (reaction: LiveReactionKind) =>
  REACTIONS.find((item) => item.kind === reaction)?.emoji ?? ''

/**
 * The small classroom layer around the shared lesson. Ephemeral gestures stay on the
 * Realtime channel; the timer goes through the host API and arrives back on the board.
 */
export function ClassroomControls({
  sessionId,
  hosting,
  me,
  people,
  hands,
  ownHandRaised,
  reactions,
  focuses,
  following,
  stepId,
  stepIds,
  timer,
  serverTimeOffsetMs,
  status,
  returnToTeacher,
  onFollow,
  onTimerChanged,
  sendHand,
  sendReaction,
  t,
}: {
  sessionId: string
  hosting: boolean
  me: LivePresence
  people: Record<string, Person>
  hands: RoomState['hands']
  ownHandRaised: boolean
  reactions: RoomState['reactions']
  focuses: RoomState['focuses']
  following: string | null
  stepId: string
  stepIds: string[]
  timer: LiveTimerState | null
  serverTimeOffsetMs: number
  status: RoomState['status']
  returnToTeacher: boolean
  onFollow: (personId: string | null) => void
  onTimerChanged: () => Promise<void>
  sendHand: (raised: boolean) => void
  sendReaction: (reaction: LiveReactionKind) => boolean
  t: Messages
}) {
  const connected = status === 'live'
  const participants = useMemo<Record<string, Person>>(
    () =>
      people[me.id]
        ? people
        : {
            ...people,
            [me.id]: { ...me, stepId },
          },
    [people, me, stepId],
  )
  const raisedCount = Object.keys(hands).filter((id) => id in participants).length

  return (
    <div className="border-border/60 bg-card/80 flex flex-wrap items-center justify-between gap-2 rounded-xl border p-2 shadow-sm backdrop-blur-sm">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <ParticipantSheet
          me={me}
          people={participants}
          hands={hands}
          reactions={reactions}
          focuses={focuses}
          following={following}
          stepId={stepId}
          stepIds={stepIds}
          raisedCount={raisedCount}
          onFollow={onFollow}
          t={t}
        />

        {returnToTeacher ? (
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              onFollow(Object.values(participants).find((p) => p.role === 'host')?.id ?? null)
            }
            className="corner-brackets"
          >
            <EyeIcon />
            {t.live.returnToTeacher}
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {!hosting ? (
          <Button
            type="button"
            variant={ownHandRaised ? 'default' : 'outline'}
            aria-pressed={ownHandRaised}
            disabled={!connected}
            onClick={() => sendHand(!ownHandRaised)}
            className="corner-brackets"
            data-testid="live-hand-button"
          >
            <HandIcon className={cn(ownHandRaised && 'animate-live-hand')} />
            {ownHandRaised ? t.live.classroom.lowerHand : t.live.classroom.raiseHand}
          </Button>
        ) : null}

        <ReactionPicker connected={connected} sendReaction={sendReaction} t={t} />
        <ClassTimer
          sessionId={sessionId}
          hosting={hosting}
          timer={timer}
          serverTimeOffsetMs={serverTimeOffsetMs}
          onTimerChanged={onTimerChanged}
          t={t}
        />
      </div>
    </div>
  )
}

function ParticipantSheet({
  me,
  people,
  hands,
  reactions,
  focuses,
  following,
  stepId,
  stepIds,
  raisedCount,
  onFollow,
  t,
}: {
  me: LivePresence
  people: Record<string, Person>
  hands: RoomState['hands']
  reactions: RoomState['reactions']
  focuses: RoomState['focuses']
  following: string | null
  stepId: string
  stepIds: string[]
  raisedCount: number
  onFollow: (personId: string | null) => void
  t: Messages
}) {
  const [open, setOpen] = useState(false)
  const list = useMemo(
    () =>
      Object.values(people).sort((left, right) => {
        const handOrder = Number(Boolean(hands[right.id])) - Number(Boolean(hands[left.id]))
        if (handOrder) return handOrder
        const hostOrder = Number(right.role === 'host') - Number(left.role === 'host')
        if (hostOrder) return hostOrder
        const selfOrder = Number(right.id === me.id) - Number(left.id === me.id)
        return selfOrder || left.name.localeCompare(right.name)
      }),
    [people, hands, me.id],
  )

  const choose = (person: Person) => {
    if (person.id === me.id) return
    onFollow(following === person.id ? null : person.id)
    setOpen(false)
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="corner-brackets"
          aria-label={`${t.live.classroom.openParticipants}: ${list.length}${
            raisedCount > 0 ? `, ${replaceCount(t.live.classroom.raisedHands, raisedCount)}` : ''
          }`}
          data-testid="live-participants-button"
        >
          <ParticipantStack people={list} />
          <UsersIcon />
          <span className="tabular-nums">{list.length}</span>
          {raisedCount > 0 ? (
            <span className="bg-primary/10 text-primary flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
              <HandIcon className="size-3" />
              {raisedCount}
            </span>
          ) : null}
        </Button>
      </SheetTrigger>
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {raisedCount > 0 ? replaceCount(t.live.classroom.raisedHands, raisedCount) : ''}
      </span>

      <SheetContent className="w-[min(92vw,28rem)] gap-0 sm:max-w-md" showCloseButton={false}>
        <SheetHeader className="border-border/60 border-b p-5 pr-14">
          <SheetTitle>{t.live.classroom.participants}</SheetTitle>
          <SheetDescription>
            {replaceCount(t.live.classroom.participantsDescription, list.length)}
          </SheetDescription>
          <SheetClose asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="corner-brackets absolute right-4 top-4"
            >
              <XIcon />
              <span className="sr-only">{t.live.classroom.close}</span>
            </Button>
          </SheetClose>
        </SheetHeader>

        {raisedCount > 0 ? (
          <div className="border-border/60 bg-primary/5 text-primary flex items-center gap-2 border-b px-5 py-2.5 text-xs font-medium">
            <HandIcon className="size-3.5" />
            {replaceCount(t.live.classroom.raisedHands, raisedCount)}
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto p-3" data-testid="live-participant-list">
          <div className="space-y-1">
            {list.map((person, index) => (
              <ParticipantRow
                key={person.id}
                person={person}
                self={person.id === me.id}
                hand={Boolean(hands[person.id])}
                reaction={reactions[person.id]}
                focus={focuses[person.id]}
                followed={following === person.id}
                currentStep={stepId}
                stepIds={stepIds}
                onClick={() => choose(person)}
                index={index}
                t={t}
              />
            ))}
          </div>
          {list.length === 1 ? (
            <p className="text-muted-foreground px-2 py-6 text-center text-xs">
              {t.live.classroom.noOneElse}
            </p>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function ParticipantStack({ people }: { people: Person[] }) {
  return (
    <span className="hidden -space-x-1.5 sm:flex" aria-hidden>
      {people.slice(0, 3).map((person) => (
        <span
          key={person.id}
          className="ring-background flex size-5 items-center justify-center rounded-full text-[8px] font-semibold text-white ring-2"
          style={{ backgroundColor: colorFor(person.id) }}
        >
          {initials(person.name)}
        </span>
      ))}
    </span>
  )
}

function ParticipantRow({
  person,
  self,
  hand,
  reaction,
  focus,
  followed,
  currentStep,
  stepIds,
  onClick,
  index,
  t,
}: {
  person: Person
  self: boolean
  hand: boolean
  reaction?: RemoteReaction
  focus?: RemoteFocus
  followed: boolean
  currentStep: string
  stepIds: string[]
  onClick: () => void
  index: number
  t: Messages
}) {
  const stepNumber = person.stepId ? stepIds.indexOf(person.stepId) + 1 : 0
  const status = followed
    ? t.live.classroom.following
    : focus?.typingAt !== undefined
      ? t.live.classroom.typing
      : person.stepId === currentStep
        ? t.live.classroom.workingHere
        : stepNumber > 0
          ? t.live.classroom.onStep.replace('{step}', String(stepNumber))
          : t.live.classroom.online

  const contents = (
    <>
      <span className="relative shrink-0">
        <span
          className="flex size-9 items-center justify-center rounded-full text-xs font-semibold text-white"
          style={{ backgroundColor: colorFor(person.id) }}
        >
          {initials(person.name)}
        </span>
        <span className="ring-background absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-emerald-500 ring-2" />
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-sm font-medium">{person.name}</span>
          {self ? (
            <span className="text-muted-foreground text-[10px]">{t.live.classroom.you}</span>
          ) : null}
          {person.role === 'host' ? (
            <span className="border-border/60 bg-muted text-muted-foreground rounded-full border px-1.5 py-0.5 text-[9px] font-medium">
              {t.live.hostTag}
            </span>
          ) : null}
        </span>
        <span className="text-muted-foreground mt-0.5 block truncate text-xs">{status}</span>
      </span>
      {reaction ? (
        <span className="animate-rise-in text-lg motion-reduce:animate-none" aria-hidden>
          {emojiFor(reaction.reaction)}
        </span>
      ) : null}
      {hand ? (
        <span className="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-full">
          <HandIcon className="animate-live-hand size-4" />
          <span className="sr-only">{t.live.classroom.handRaised}</span>
        </span>
      ) : null}
      {followed ? <EyeIcon className="text-primary size-4" /> : null}
    </>
  )
  const className = cn(
    'animate-rise-in flex h-auto min-h-14 w-full items-center justify-start gap-3 whitespace-normal rounded-lg px-2.5 py-2.5 font-normal motion-reduce:animate-none',
    followed && 'bg-primary/5 ring-primary/20 ring-1',
    self ? 'cursor-default' : 'corner-brackets hover:bg-muted/60 text-left transition-colors',
  )
  const style = { animationDelay: `${Math.min(index * 24, 144)}ms` }

  return self ? (
    <div className={className} style={style}>
      {contents}
    </div>
  ) : (
    <Button
      type="button"
      variant="ghost"
      className={className}
      style={style}
      onClick={onClick}
      aria-pressed={followed}
      aria-label={`${t.live.classroom.followParticipant}: ${person.name}`}
    >
      {contents}
    </Button>
  )
}

function ReactionPicker({
  connected,
  sendReaction,
  t,
}: {
  connected: boolean
  sendReaction: (reaction: LiveReactionKind) => boolean
  t: Messages
}) {
  const [open, setOpen] = useState(false)

  const choose = (reaction: LiveReactionKind) => {
    if (sendReaction(reaction)) setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={!connected}
          className="corner-brackets"
          aria-label={t.live.classroom.reactions}
          data-testid="live-reaction-button"
        >
          <SmilePlusIcon />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-3">
        <PopoverHeader className="px-1 pb-1">
          <PopoverTitle>{t.live.classroom.reactions}</PopoverTitle>
          <PopoverDescription>{t.live.classroom.reactionsDescription}</PopoverDescription>
        </PopoverHeader>
        <div className="grid grid-cols-4 gap-1">
          {REACTIONS.map((reaction) => (
            <Button
              key={reaction.kind}
              type="button"
              variant="ghost"
              size="icon-lg"
              onClick={() => choose(reaction.kind)}
              className="corner-brackets text-xl transition-transform hover:-translate-y-0.5 motion-reduce:transform-none"
              aria-label={t.live.classroom.reactionNames[reaction.label]}
              data-reaction={reaction.kind}
            >
              <span aria-hidden>{reaction.emoji}</span>
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function ClassTimer({
  sessionId,
  hosting,
  timer,
  serverTimeOffsetMs,
  onTimerChanged,
  t,
}: {
  sessionId: string
  hosting: boolean
  timer: LiveTimerState | null
  serverTimeOffsetMs: number
  onTimerChanged: () => Promise<void>
  t: Messages
}) {
  const countdown = useClassTimer(timer, serverTimeOffsetMs)

  if (!hosting) {
    return timer ? <TimerPill countdown={countdown} t={t} /> : null
  }

  return (
    <TimerPopover
      sessionId={sessionId}
      timer={timer}
      countdown={countdown}
      onTimerChanged={onTimerChanged}
      t={t}
    />
  )
}

function TimerPopover({
  sessionId,
  timer,
  countdown,
  onTimerChanged,
  t,
}: {
  sessionId: string
  timer: LiveTimerState | null
  countdown: Countdown
  onTimerChanged: () => Promise<void>
  t: Messages
}) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const change = (durationSeconds: number | null) => {
    let command: SetLiveTimerBody
    if (durationSeconds === null) {
      if (!timer) return
      command = { action: 'stop', timerId: timer.id }
    } else {
      command = {
        action: 'start',
        durationSeconds,
        expectedTimerId: timer?.id ?? null,
      }
    }

    startTransition(async () => {
      const result = await setLiveTimer(sessionId, command).catch(() => ({
        error: 'failed' as const,
      }))
      if (result.error) {
        await onTimerChanged().catch(() => undefined)
        toast.error(t.live.failed)
        return
      }
      await onTimerChanged()
      setOpen(false)
    })
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="corner-brackets min-w-8"
          aria-label={
            timer
              ? `${t.live.classroom.timer}: ${
                  countdown.done ? t.live.classroom.timerDone : countdown.label
                }`
              : t.live.classroom.timer
          }
          aria-busy={pending}
          data-testid="live-timer-button"
        >
          {pending ? <Loader2Icon className="animate-spin" /> : <TimerIcon />}
          {timer ? (
            <span className="tabular-nums" data-testid="live-timer-value">
              {countdown.done ? t.live.classroom.timerDone : countdown.label}
            </span>
          ) : (
            <span className="hidden sm:inline">{t.live.classroom.timer}</span>
          )}
        </Button>
      </PopoverTrigger>
      {countdown.done ? (
        <span className="sr-only" aria-live="polite">
          {t.live.classroom.timerDone}
        </span>
      ) : null}
      <PopoverContent align="end" className="w-72 p-3">
        <PopoverHeader className="px-1 pb-1">
          <PopoverTitle>{t.live.classroom.timer}</PopoverTitle>
          <PopoverDescription>{t.live.classroom.timerDescription}</PopoverDescription>
        </PopoverHeader>

        {timer ? (
          <div className="border-border/60 bg-muted/30 space-y-2 rounded-lg border px-3 py-2.5">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="text-muted-foreground">{t.live.classroom.timerRunning}</span>
              <span className="font-medium tabular-nums">
                {countdown.done ? t.live.classroom.timerDone : countdown.label}
              </span>
            </div>
            <Progress value={countdown.progress} aria-label={t.live.classroom.timerRunning} />
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          {TIMER_PRESETS_MINUTES.map((minutes) => (
            <Button
              key={minutes}
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => change(minutes * 60)}
              className="corner-brackets"
            >
              <TimerIcon />
              {t.live.classroom.timerMinutes.replace('{minutes}', String(minutes))}
            </Button>
          ))}
        </div>

        {timer ? (
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={() => change(null)}
            className="corner-brackets text-muted-foreground w-full"
          >
            <XIcon />
            {t.live.classroom.timerStop}
          </Button>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}

type Countdown = { label: string; progress: number; done: boolean }

function useClassTimer(timer: LiveTimerState | null, serverTimeOffsetMs: number): Countdown {
  const [now, setNow] = useState(0)

  useEffect(() => {
    if (!timer) return
    let timeout: ReturnType<typeof setTimeout> | null = null
    const tick = () => {
      const current = Date.now() + serverTimeOffsetMs
      setNow(current)
      if (current < timer.endsAt) timeout = setTimeout(tick, 250)
    }
    timeout = setTimeout(tick, 0)
    return () => {
      if (timeout) clearTimeout(timeout)
    }
  }, [timer, serverTimeOffsetMs])

  if (!timer) return { label: '00:00', progress: 0, done: false }
  const clock = now > timer.startedAt ? now : timer.startedAt
  const remaining = Math.max(0, timer.endsAt - clock)
  const seconds = Math.ceil(remaining / 1_000)
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return {
    label: `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`,
    progress: timer.durationSeconds > 0 ? (remaining / (timer.durationSeconds * 1_000)) * 100 : 0,
    done: remaining === 0,
  }
}

function TimerPill({ countdown, t }: { countdown: Countdown; t: Messages }) {
  return (
    <div
      className={cn(
        'border-border/60 bg-background relative flex h-8 min-w-24 items-center gap-2 overflow-hidden rounded-full border px-3 text-xs font-medium shadow-sm',
        countdown.done && 'border-primary/30 text-primary',
      )}
      role="timer"
      aria-label={`${t.live.classroom.timer}: ${
        countdown.done ? t.live.classroom.timerDone : countdown.label
      }`}
      data-testid="live-timer-value"
    >
      <TimerIcon className="size-3.5" />
      <span className="tabular-nums">
        {countdown.done ? t.live.classroom.timerDone : countdown.label}
      </span>
      <span
        className="bg-primary/15 absolute inset-x-0 bottom-0 h-0.5 origin-left transition-transform duration-300 motion-reduce:transition-none"
        style={{ transform: `scaleX(${Math.max(0, Math.min(1, countdown.progress / 100))})` }}
      />
      {countdown.done ? (
        <span className="sr-only" aria-live="polite">
          {t.live.classroom.timerDone}
        </span>
      ) : null}
    </div>
  )
}

/** Reactions live over the board long enough to be noticed, then the room hook expires them. */
export function ReactionBurst({
  reactions,
  t,
}: {
  reactions: Record<string, RemoteReaction>
  t: Messages
}) {
  const visible = Object.values(reactions)
  const latest = visible.reduce<RemoteReaction | undefined>(
    (current, reaction) => (!current || reaction.at > current.at ? reaction : current),
    undefined,
  )
  const announcement = latest ? `${latest.name}: ${reactionName(latest.reaction, t)}` : ''

  return (
    <>
      <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden" aria-hidden>
        {visible.map((reaction) => (
          <span
            key={reaction.eventId}
            className="animate-live-reaction absolute bottom-12 flex items-center gap-1.5 rounded-full border border-white/60 bg-white/95 px-2.5 py-1.5 text-sm font-medium text-slate-900 shadow-lg"
            style={
              {
                left: `${reactionLane(reaction.eventId)}%`,
                '--live-reaction-color': colorFor(reaction.id),
              } as CSSProperties
            }
          >
            <span className="text-xl">{emojiFor(reaction.reaction)}</span>
            <span className="max-w-28 truncate text-xs">{reaction.name}</span>
          </span>
        ))}
      </div>
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </span>
    </>
  )
}

function reactionName(reaction: LiveReactionKind, t: Messages): string {
  const key = REACTIONS.find((item) => item.kind === reaction)?.label ?? 'thumbsUp'
  return t.live.classroom.reactionNames[key]
}

function reactionLane(eventId: string): number {
  let hash = 0
  for (const char of eventId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return 12 + (hash % 77)
}

const replaceCount = (value: string, count: number) => value.replace('{count}', String(count))
