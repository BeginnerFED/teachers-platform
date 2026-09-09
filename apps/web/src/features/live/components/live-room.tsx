'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import {
  EyeIcon,
  LinkIcon,
  Loader2Icon,
  MousePointer2Icon,
  RadioIcon,
  SquareIcon,
  UsersIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  BOARD_ROOM_KEY,
  trustedResults,
  type BoardOp,
  type LiveCursor,
  type LiveGather,
  type LiveHint,
  type LiveMedia,
  type LivePresence,
  type LiveRoom as Room,
  type LiveView,
} from '@tp/shared'
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
import { Button } from '@/components/ui/button'
import { createMediaHub, MediaSyncContext } from '@/features/library/blocks/media-sync'
import { MaterialPlayer } from '@/features/library/components/material-player'
import { counted, initials } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Messages } from '@/messages'
import { endLive, gatherLive, setLiveStep } from '../actions'
import { useAttention } from '../use-attention'
import { useFollowView } from '../use-follow-view'
import { useLiveBoard } from '../use-live-board'
import { useLiveRoom, type Person as Someone, type RemoteCursor } from '../use-live-room'
import { colorFor, PresenceOverlay } from './presence-overlay'

/** Hints go out at most this often, the last one always. */
const HINT_INTERVAL_MS = 80
/** How long the host's word on their step is taken over the API's before the API wins. */
const HOST_STEP_GRACE_MS = 3_000
/** How long to keep following somebody who has dropped out of the room. */
const FOLLOW_GRACE_MS = 5_000

/**
 * The room: one board, everybody's. Anybody answers and everyone sees the answer; anybody
 * presses play and every video plays; anybody turns a page and goes where they like —
 * and anybody can follow anybody else, the way one follows a person in Figma, by clicking
 * on them. Guests follow the teacher until they wander. The teacher can look over a
 * student's shoulder without taking the class along: the class stays where the teacher
 * led it, and "gather" brings everyone back.
 *
 * The board — the answers, the marks, the state of every block — lives in the database
 * and changes only through the API, which announces every change; browsers draw
 * announcements and their peers' hints at once and take the API's word a moment later.
 * Pointers, selections, where a video is up to and who is on which step are the moment,
 * sent browser to browser and never kept.
 */
export function LiveRoom({
  room,
  anonymous = false,
  t,
  locale,
}: {
  room: Room
  /** In by the link alone, with no account behind the name. */
  anonymous?: boolean
  t: Messages
  locale: string
}) {
  const { session, lesson, role, me, snapshot } = room
  const hosting = role === 'host'
  const hostId = session.teacher.id

  const stepIds = useMemo(() => lesson.steps.map((step) => step.id), [lesson.steps])
  const firstStep = stepIds[0] ?? ''
  // Every block of every step: what a hint may speak of.
  const blocks = useMemo(
    () =>
      new Set(lesson.steps.flatMap((step) => step.blocks.map((block) => `${step.id} ${block.id}`))),
    [lesson.steps],
  )
  const [confirming, setConfirming] = useState(false)
  const [pending, startTransition] = useTransition()

  const presence = useMemo<LivePresence>(
    () => ({ id: me.id, name: me.name, role }),
    [me.id, me.name, role],
  )

  /* ----------------------------------------------------------------- the board --- */

  // Hints are sent a beat behind the gesture, coalesced, so a burst of typing is a few
  // messages rather than a message per letter.
  const hintQueue = useRef<Map<string, BoardOp>>(new Map())
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sendHintRef = useRef<(ops: BoardOp[]) => void>(() => {})
  const onOps = useCallback((ops: BoardOp[]) => {
    for (const op of ops) hintQueue.current.set(JSON.stringify(op.path), op)
    if (hintTimer.current) return
    hintTimer.current = setTimeout(() => {
      hintTimer.current = null
      const queued = [...hintQueue.current.values()]
      hintQueue.current.clear()
      if (queued.length > 0) sendHintRef.current(queued)
    }, HINT_INTERVAL_MS)
  }, [])
  useEffect(
    () => () => {
      if (hintTimer.current) clearTimeout(hintTimer.current)
    },
    [],
  )

  const onError = useCallback(() => toast.error(t.live.failed), [t.live.failed])
  const board = useLiveBoard(session.id, snapshot, me.id, { onError, onOps })
  const { onBoard, onState, onHint, resync, assume, confirm, retract } = board
  const ended = board.status === 'ended'

  /* ------------------------------------------------------------------ the room --- */

  const [hub] = useState(createMediaHub)
  const onMedia = useCallback((media: LiveMedia) => hub.dispatch(media), [hub])
  const onJoined = useCallback(() => void resync(), [resync])

  // Where the followed person's window is, honoured by the follow hook below.
  const followingRef = useRef<string | null>(null)
  const applyViewRef = useRef<(view: LiveView) => void>(() => {})
  const onView = useCallback((id: string, view: LiveView) => {
    if (id === followingRef.current) applyViewRef.current(view)
  }, [])

  // A hint may speak only of what the API would accept: a block that is in the lesson.
  // Anything else on the channel is noise, whoever sent it.
  const onHintEvent = useCallback(
    (hint: LiveHint) => {
      const ops = hint.ops.filter(
        (op) =>
          Array.isArray(op.path) &&
          op.path.every((part) => typeof part === 'string') &&
          blocks.has(`${op.path[1]} ${op.path[2]}`),
      )
      if (ops.length > 0) onHint({ ...hint, ops })
    },
    [blocks, onHint],
  )

  const {
    people,
    cursors,
    selections,
    focuses,
    steps,
    status,
    announce,
    sendCursor,
    sendSelection,
    sendFocus,
    sendHint,
    sendMedia,
    sendView,
  } = useLiveRoom(session.id, presence, hostId, {
    onBoard,
    onState,
    onHint: onHintEvent,
    onMedia,
    onView,
    onJoined,
  })

  useEffect(() => {
    sendHintRef.current = sendHint
  }, [sendHint])
  useEffect(() => hub.connect(sendMedia), [hub, sendMedia])

  const surface = useRef<HTMLDivElement>(null)

  /* ------------------------------------------------------------------ the step --- */

  // Whom this person follows, and where they are on their own: the step they last turned
  // to themselves — for the host, the step they lead the class on.
  const [chosen, setFollowing] = useState<string | null>(hosting ? null : hostId)
  const [ownStep, setOwnStep] = useState(() => snapshot.currentStepId ?? firstStep)

  // The host's last call to gather, as it sits on the board. A call not yet answered —
  // by turning a page or choosing whom to follow — means following the host.
  const call = board.board.ui?.[BOARD_ROOM_KEY]?.gather as LiveGather | undefined
  const callAt = call?.at
  const [answeredCall, setAnsweredCall] = useState(callAt)
  const summoned = !hosting && callAt !== undefined && callAt !== answeredCall
  const following = summoned ? hostId : chosen
  const toldOfCall = useRef(callAt)
  useEffect(() => {
    if (callAt === toldOfCall.current) return
    toldOfCall.current = callAt
    if (!hosting && callAt !== undefined) toast(t.live.gathered)
  }, [callAt, hosting, t.live.gathered])

  // The host's word on their step is taken at once, so the page turns for everyone the
  // instant it turns for them — but only as long as the API agrees within a moment. A
  // "host" step the API never confirms was not the host's.
  const hostSaid = people[hostId]?.stepId
  const hostConfirmed = board.currentStepId
  const [disagreement, setDisagreement] = useState<{ said: string; confirmed: string } | null>(null)
  useEffect(() => {
    if (!hostSaid || !hostConfirmed || hostSaid === hostConfirmed) return
    const timer = setTimeout(
      () => setDisagreement({ said: hostSaid, confirmed: hostConfirmed }),
      HOST_STEP_GRACE_MS,
    )
    return () => clearTimeout(timer)
  }, [hostSaid, hostConfirmed])
  const hostDistrusted =
    disagreement !== null &&
    disagreement.said === hostSaid &&
    disagreement.confirmed === hostConfirmed
  const hostStep = (hostDistrusted ? hostConfirmed : hostSaid) ?? hostConfirmed ?? firstStep

  // Where the followed person is. Somebody who follows this person back is anchored here,
  // so two people following each other do not chase each other round the lesson.
  const followed: Someone | undefined = following ? people[following] : undefined
  const followedStep =
    following === null
      ? undefined
      : following === hostId
        ? hostStep
        : followed?.following === me.id
          ? ownStep
          : steps[following]
  const stepId = followedStep ?? ownStep
  const index = Math.max(0, stepIds.indexOf(stepId))

  // Somebody followed who has left the room: after a moment, stay where they left you.
  const followedGone = following !== null && following !== hostId && !followed
  const parked = following ? steps[following] : undefined
  useEffect(() => {
    if (!followedGone) return
    const timer = setTimeout(() => {
      if (parked) setOwnStep(parked)
      setFollowing(null)
    }, FOLLOW_GRACE_MS)
    return () => clearTimeout(timer)
  }, [followedGone, parked])

  // Everyone hears where this person is and whom they follow. The host says the step
  // they lead on, whatever they are looking at; a guest says what they see.
  const announced = hosting ? ownStep : stepId
  useEffect(() => {
    if (!ended) announce({ stepId: announced, following })
  }, [announced, following, ended, announce])

  // The host's led step is the room's, remembered by the API for whoever arrives later.
  const roomStep = board.currentStepId
  useEffect(() => {
    if (!hosting || ended || ownStep === roomStep) return
    assume({ currentStepId: ownStep })
    setLiveStep(session.id, ownStep).then(
      ({ error }) => {
        if (error) retract(['currentStepId'])
        else confirm({ currentStepId: ownStep })
      },
      () => retract(['currentStepId']),
    )
  }, [hosting, ended, ownStep, roomStep, session.id, assume, confirm, retract])

  // Turning a page yourself is leaving whoever you were following.
  const move = (next: number) => {
    const id = stepIds[next]
    if (!id) return
    setAnsweredCall(callAt)
    setFollowing(null)
    setOwnStep(id)
  }

  const follow = (personId: string | null) => {
    setAnsweredCall(callAt)
    if (personId === null) {
      // Letting go means staying where you are, on your own.
      setOwnStep(stepId)
      setFollowing(null)
      return
    }
    const person = people[personId]
    if (person?.following === me.id) {
      toast(`${person.name} ${t.live.alreadyFollowing}`)
      return
    }
    setFollowing(personId)
  }

  // The host calls everyone to the step in front of them. It lands on the board through
  // the API — the channel is open to the link, and a call that moves a class must not be.
  // Following is following the window too: the followed person's scrolling is mirrored
  // here, and scrolling here on one's own is letting go.
  const followers = Object.values(people).filter(
    (person) => person.id !== me.id && person.following === me.id,
  ).length
  const { apply: applyView } = useFollowView({
    surface,
    stepId,
    following: followed ? following : null,
    followers,
    send: sendView,
    onLetGo: () => follow(null),
  })
  useEffect(() => {
    followingRef.current = followed ? following : null
    applyViewRef.current = applyView
  }, [followed, following, applyView])

  const gather = () => {
    setFollowing(null)
    setOwnStep(stepId)
    void gatherLive(session.id, stepId).then(
      ({ error }) => (error ? toast.error(t.live.failed) : toast.success(t.live.gathered)),
      () => toast.error(t.live.failed),
    )
  }

  /* ------------------------------------------------------------- the surface --- */

  useAttention(surface, stepId, { selection: sendSelection, focus: sendFocus })

  // Somebody new in the room: the players say where the room's videos are.
  const seen = useRef<Set<string>>(new Set())
  useEffect(() => {
    const ids = Object.keys(people)
    const fresh = ids.some((id) => id !== me.id && !seen.current.has(id))
    seen.current = new Set(ids)
    if (fresh) hub.joined()
  }, [people, me.id, hub])

  // Clocks in timed games, and the word on where a video is, are one browser's to give.
  const hostHere = hostId in people
  const leads = hosting || (!hostHere && Object.keys(people).sort()[0] === me.id)
  const mediaSync = useMemo(() => hub.withLeads(leads), [hub, leads])

  const results = useMemo(() => trustedResults(board.board.results), [board.board.results])

  // Where the pointer is over the lesson, as fractions of it — the same spot on a
  // narrower or wider screen.
  const onPointerMove = (event: React.PointerEvent) => {
    const rect = surface.current?.getBoundingClientRect()
    if (!rect || rect.width === 0 || rect.height === 0) return

    sendCursor({
      stepId,
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height,
    })
  }

  const finish = () =>
    startTransition(async () => {
      const { error } = await endLive(session.id).catch(() => ({ error: 'failed' }))

      if (error) {
        toast.error(t.live.failed)
        return
      }

      confirm({ status: 'ended' })
    })

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      toast.success(t.live.linkCopied)
    } catch {
      toast.error(t.live.failed)
    }
  }

  const others = Object.values(people).filter((person) => person.id !== me.id)
  const headcount = Object.keys(people).length
  const teacherName = session.teacher.fullName || session.teacher.email || t.live.hostTag
  const strayed = !hosting && hostHere && following !== hostId && stepId !== hostStep

  if (ended) {
    return (
      <>
        <Heading title={lesson.title} sentence={t.live.ended.title} />

        <div className="border-border/60 bg-card flex flex-col items-center gap-3 rounded-2xl border px-6 py-14 text-center">
          <span className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-full">
            <SquareIcon className="size-4" />
          </span>
          <div className="space-y-1">
            <p className="text-sm font-medium">{t.live.ended.title}</p>
            <p className="text-muted-foreground text-sm">
              {hosting ? t.live.ended.hostBody : t.live.ended.body}
            </p>
          </div>
          {/* Somebody in by the link alone has no home here to go back to. */}
          {anonymous ? null : (
            <Button asChild variant="ghost" className="text-muted-foreground">
              <Link href={hosting ? `/library/${lesson.id}` : '/student'}>
                {hosting ? t.live.ended.toLesson : t.live.ended.back}
              </Link>
            </Button>
          )}
        </div>
      </>
    )
  }

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Heading
          title={lesson.title}
          sentence={[
            hosting ? t.live.hosting : `${t.live.withTeacher} ${teacherName}`,
            status === 'live'
              ? counted(headcount, t.live.people, locale)
              : status === 'connecting'
                ? t.live.connecting
                : t.live.reconnecting,
          ].join(' · ')}
          live={status === 'live'}
        />

        {hosting ? (
          <div className="flex shrink-0 items-center gap-2">
            <Button type="button" variant="outline" onClick={gather} disabled={others.length === 0}>
              <UsersIcon />
              {t.live.gather}
            </Button>
            <Button type="button" variant="outline" onClick={copyLink}>
              <LinkIcon />
              {t.live.copyLink}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setConfirming(true)}
              className="text-red-700 hover:text-red-700 dark:text-red-300 dark:hover:text-red-300"
            >
              {pending ? <Loader2Icon className="animate-spin" /> : <SquareIcon />}
              {pending ? t.live.ending : t.live.end}
            </Button>
          </div>
        ) : null}
      </div>

      {/* Who is here, and where. Click somebody to go where they go. */}
      <div className="flex flex-wrap items-center gap-2">
        <PersonChip person={presence} self myStep={stepId} stepIds={stepIds} t={t} />
        {others.map((person) => (
          <PersonChip
            key={person.id}
            person={person}
            followed={following === person.id}
            myStep={stepId}
            stepIds={stepIds}
            onClick={() => follow(following === person.id ? null : person.id)}
            t={t}
          />
        ))}
        {others.length === 0 && hosting ? (
          <span className="text-muted-foreground text-xs">{t.live.alone}</span>
        ) : null}
        {followed ? (
          <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <EyeIcon className="size-3.5" />
            {t.live.following} {followed.name}
          </span>
        ) : null}
        {strayed ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => follow(hostId)}
            className="ml-auto"
          >
            <EyeIcon />
            {t.live.returnToTeacher}
          </Button>
        ) : null}
      </div>

      <div className="flex flex-col gap-3">
        {/* The lesson, with everyone's pointer, selection and attention over it. */}
        <div
          ref={surface}
          onPointerMove={onPointerMove}
          onPointerLeave={() => sendCursor(null)}
          className={cn(
            'relative rounded-xl transition-shadow',
            followed && 'ring-2 ring-offset-4',
          )}
          style={
            followed && following
              ? ({ '--tw-ring-color': colorFor(following) } as React.CSSProperties)
              : undefined
          }
        >
          <MediaSyncContext.Provider value={mediaSync}>
            <MaterialPlayer
              material={lesson}
              backHref={hosting ? `/library/${lesson.id}` : anonymous ? '/' : '/student'}
              index={index}
              onIndexChange={move}
              answers={board.board.answers ?? {}}
              onAnswer={(step, block, value) =>
                // A keystroke is not a gesture; a word is.
                board.setValue('answers', step, block, value, { debounce: hasTypedText(value) })
              }
              results={results}
              ui={board.board.ui ?? {}}
              onUi={(step, block, value) => board.setValue('ui', step, block, value)}
              leads={leads}
              // Marking locks the step for the whole room, so it is the host's call; the
              // marks land on the board for everyone.
              canCheck={hosting}
              onCheck={board.check}
              // On the last step, "finish" is the way to close the room — not a way out
              // that leaves it open behind the host. A guest has no last page to leave by.
              onExit={hosting ? () => setConfirming(true) : undefined}
              canFinish={hosting}
              compactHeader
              t={t}
            />
          </MediaSyncContext.Provider>

          <PresenceOverlay
            surface={surface}
            stepId={stepId}
            people={people}
            selections={selections}
            focuses={focuses}
            meId={me.id}
            typingLabel={t.live.typing}
          />
          <Cursors cursors={Object.values(cursors)} stepId={stepId} />
        </div>

        <p className="text-muted-foreground px-1 text-xs">
          {hosting ? t.live.hostFollowHint : t.live.followHint}
        </p>
      </div>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent className="rounded-2xl p-7">
          <AlertDialogHeader>
            <AlertDialogTitle>{t.live.confirmEnd.title}</AlertDialogTitle>
            <AlertDialogDescription>{t.live.confirmEnd.body}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.live.confirmEnd.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={finish}
              className="bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950/70"
            >
              {t.live.confirmEnd.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

/**
 * Typed answers — a gap fill, a crossword, an essay — arrive a letter at a time and are
 * sent a word at a time. Lists are taps (options picked, tokens placed) and go at once.
 */
function hasTypedText(value: unknown): boolean {
  if (typeof value === 'string') return true
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false

  return Object.values(value as Record<string, unknown>).some(hasTypedText)
}

/** The page's title and its one sentence, with a live dot when the room is connected. */
function Heading({ title, sentence, live }: { title: string; sentence: string; live?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-muted-foreground flex items-center gap-2 text-sm tabular-nums">
        {live ? (
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-500 opacity-60 motion-reduce:animate-none" />
            <span className="relative inline-flex size-2 rounded-full bg-red-500" />
          </span>
        ) : (
          <RadioIcon className="size-3.5" />
        )}
        {sentence}
      </p>
    </div>
  )
}

/**
 * One person in the room: their colour, their name, and — if they are on another page —
 * which. Clicking somebody else follows them, the way it does in Figma; clicking them
 * again lets go.
 */
function PersonChip({
  person,
  self = false,
  followed = false,
  myStep,
  stepIds,
  onClick,
  t,
}: {
  person: LivePresence
  self?: boolean
  followed?: boolean
  myStep: string
  stepIds: string[]
  onClick?: () => void
  t: Messages
}) {
  const color = colorFor(person.id)
  const elsewhere = !self && person.stepId !== undefined && person.stepId !== myStep
  const stepNumber = person.stepId ? stepIds.indexOf(person.stepId) + 1 : 0

  const body = (
    <>
      <span
        className="flex size-6 items-center justify-center rounded-full text-[10px] font-semibold text-white"
        style={{ backgroundColor: color }}
      >
        {initials(person.name)}
      </span>
      <span className="font-medium">{person.name}</span>
      {self ? <span className="text-muted-foreground">· {t.live.you}</span> : null}
      {person.role === 'host' && !self ? (
        <span className="text-muted-foreground">· {t.live.hostTag}</span>
      ) : null}
      {elsewhere && stepNumber > 0 ? (
        <span className="text-muted-foreground tabular-nums">
          · {t.live.stepTag} {stepNumber}
        </span>
      ) : null}
      {followed ? <EyeIcon className="size-3.5" style={{ color }} /> : null}
    </>
  )

  const className = cn(
    'border-border/60 bg-card flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-xs transition-colors',
    followed && 'ring-2 ring-offset-1',
    onClick && 'hover:bg-muted/60 cursor-pointer',
  )

  if (!onClick) return <span className={className}>{body}</span>

  return (
    <button
      type="button"
      onClick={onClick}
      title={followed ? t.live.unfollow : t.live.follow}
      aria-pressed={followed}
      className={className}
      style={followed ? ({ '--tw-ring-color': color } as React.CSSProperties) : undefined}
    >
      {body}
    </button>
  )
}

/** Everyone else's pointer, drawn over the lesson in their colour, with their name. */
function Cursors({ cursors, stepId }: { cursors: RemoteCursor[]; stepId: string }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {cursors
        .filter((cursor) => cursor.stepId === stepId)
        .map((cursor) => {
          const color = colorFor(cursor.id)

          return (
            <div
              key={cursor.id}
              className="absolute transition-[left,top] duration-100 ease-linear will-change-[left,top]"
              style={{ left: `${cursor.x * 100}%`, top: `${cursor.y * 100}%` }}
            >
              <MousePointer2Icon
                className="size-4 -rotate-12 drop-shadow-sm"
                style={{ color, fill: color }}
              />
              <span
                className="ml-3 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium text-white shadow-sm"
                style={{ backgroundColor: color }}
              >
                {cursor.name}
              </span>
            </div>
          )
        })}
    </div>
  )
}

export type { LiveCursor }
