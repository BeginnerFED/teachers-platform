'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { lessonAttendanceHref } from '@/features/calendar/lesson-link'
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { LinkIcon, Loader2Icon, RadioIcon, SquareIcon, UsersIcon } from 'lucide-react'
import { toast } from 'sonner'
import {
  BOARD_ROOM_KEY,
  liveMediaState,
  liveTimerState,
  trustedResults,
  type BoardOp,
  type LiveCursor,
  type LiveGather,
  type LiveHint,
  type LiveMedia,
  type LivePresence,
  type LiveRoom as Room,
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
import { LiveMediaSessionContext } from '@/features/library/media'
import { counted } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Messages } from '@/messages'
import { endLive, gatherLive, setLiveMedia, setLiveStep, respondToLiveInvitation } from '../actions'
import { startTransition as startInvitationTransition } from 'react'
import { useAttention } from '../use-attention'
import { CursorLayer } from './cursor-layer'
import { useLiveBoard } from '../use-live-board'
import { useLiveRoom, type Person as Someone } from '../use-live-room'
import { ClassroomControls, ReactionBurst } from './classroom-controls'
import { colorFor, PresenceOverlay } from './presence-overlay'

/** Hints go out at most this often, the last one always. */
const HINT_INTERVAL_MS = 80
/** How long to keep following somebody who has dropped out of the room. */
const FOLLOW_GRACE_MS = 5_000

/**
 * The room: one board, everybody's. Anybody answers and everyone sees the answer; anybody
 * turns a page and goes where they like, and can follow another person's step by clicking
 * on them. Guests follow the teacher until they wander. The teacher can look over a
 * student's shoulder without taking the class along: the class stays where the teacher
 * led it, and "gather" brings everyone back.
 *
 * The board — the answers, the marks, the state of every block — lives in the database
 * and changes only through the API, which announces every change; browsers draw
 * announcements and peers' hints prompt an API read. Pointers, selections and the step
 * people say they are on are sent browser to browser and never kept. Media commands use
 * the authenticated API; following another participant follows their step.
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
  const router = useRouter()
  const attendanceHref = session.calendarLesson
    ? lessonAttendanceHref(session.calendarLesson)
    : null
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

  const [hub] = useState(() => createMediaHub(me.id))
  const lastMedia = useRef<string | null>(null)
  const mediaCommands = useRef<Promise<void>>(Promise.resolve())
  const onJoined = useCallback(() => {
    void resync()
    if (!anonymous && room.role === 'guest')
      startInvitationTransition(async () => {
        try {
          await respondToLiveInvitation(session.id, 'joined')
        } catch {
          /* Joining by a shared link does not require an invitation. */
        }
      })
  }, [resync, anonymous, room.role, session.id])

  // Only hints about lesson blocks may wake an API read. The hint's value is never drawn.
  const onHintEvent = useCallback(
    (hint: LiveHint) => {
      const ops = hint.ops.filter(
        (op) =>
          op !== null &&
          typeof op === 'object' &&
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
    watchCursors,
    selections,
    focuses,
    steps,
    hands,
    reactions,
    ownHandRaised,
    status,
    announce,
    sendCursor,
    sendSelection,
    sendFocus,
    sendHint,
    sendHand,
    sendReaction,
  } = useLiveRoom(session.id, presence, hostId, {
    onBoard,
    onState,
    onHint: onHintEvent,
    onJoined,
  })

  useEffect(() => {
    sendHintRef.current = sendHint
  }, [sendHint])
  const publishMedia = useCallback(
    (media: Omit<LiveMedia, 'from'>) => {
      // Preserve gesture order. Independent server actions could otherwise arrive as
      // pause -> play even when the teacher clicked play -> pause.
      mediaCommands.current = mediaCommands.current.then(async () => {
        try {
          const result = await setLiveMedia(session.id, media)
          if (result.error) onError()
        } catch {
          onError()
        }
      })
    },
    [onError, session.id],
  )
  useEffect(() => {
    hub.connect(hosting ? publishMedia : () => {})
    return () => hub.connect(() => {})
  }, [hosting, hub, publishMedia])

  const sharedMedia = board.board.ui?.[BOARD_ROOM_KEY]?.media
  useEffect(() => {
    const parsed = liveMediaState.safeParse(sharedMedia)
    if (!parsed.success) return
    const key = JSON.stringify(parsed.data)
    if (lastMedia.current === key) return
    lastMedia.current = key
    // The API stamps the command with its own clock. Players compare `at` with this
    // browser's Date.now(), so translate it with the offset measured by the room snapshot.
    hub.dispatch({ ...parsed.data, at: parsed.data.at - board.serverTimeOffsetMs })
  }, [board.serverTimeOffsetMs, hub, sharedMedia])

  const surface = useRef<HTMLDivElement>(null)

  /* ------------------------------------------------------------------ the step --- */

  // Whom this person follows, and where they are on their own: the step they last turned
  // to themselves — for the host, the step they lead the class on.
  const [chosen, setFollowing] = useState<string | null>(hosting ? null : hostId)
  const [ownStep, setOwnStep] = useState(() => snapshot.currentStepId ?? firstStep)
  const wantedStep = useRef(ownStep)
  const stepCommands = useRef<Promise<void>>(Promise.resolve())
  wantedStep.current = ownStep

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

  // The teacher's led step moves only after the authenticated API confirms it. A public
  // Realtime step packet can claim the teacher's id and must never turn a follower's page.
  const hostStep = board.currentStepId ?? firstStep

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
    const requestedStep = ownStep
    // A fast A -> B click must reach the database in that order; otherwise an older
    // request can arrive last and pull the whole class back to A.
    stepCommands.current = stepCommands.current.then(async () => {
      try {
        const { error } = await setLiveStep(session.id, requestedStep)
        if (error) {
          if (wantedStep.current === requestedStep) retract(['currentStepId'])
        } else {
          confirm({ currentStepId: requestedStep })
        }
      } catch {
        if (wantedStep.current === requestedStep) retract(['currentStepId'])
      }
    })
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
    if (followChainLoops(personId, me.id, people)) {
      toast(t.live.followCycle)
      return
    }
    setFollowing(personId)
  }

  // A cycle can also appear after the click when two people change whom they follow at
  // nearly the same time. Let go locally and stay on the page already in view.
  const trappedFollowing = chosen !== null && followChainLoops(chosen, me.id, people)
  useEffect(() => {
    if (!trappedFollowing) return
    const release = setTimeout(() => {
      setOwnStep(stepId)
      setFollowing(null)
      toast(t.live.followCycle)
    }, 0)
    return () => clearTimeout(release)
  }, [trappedFollowing, stepId, t.live.followCycle])

  // The host calls everyone to the step in front of them. It lands on the board through
  // the API — the channel is open to the link, and a call that moves a class must not be.
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

  // Somebody new in the room: the host repeats the room's current player state.
  const seen = useRef<Set<string>>(new Set())
  useEffect(() => {
    const ids = Object.keys(people)
    const fresh = ids.some((id) => id !== me.id && !seen.current.has(id))
    seen.current = new Set(ids)
    if (fresh) hub.joined()
  }, [people, me.id, hub])

  // Shared playback is the authenticated host's command. Guests may play locally, but
  // their public Realtime identity cannot be trusted to steer everybody else's player.
  const leads = hosting
  const mediaSync = useMemo(() => hub.withLeads(leads), [hub, leads])

  const results = useMemo(() => trustedResults(board.board.results), [board.board.results])
  const timer = useMemo(() => {
    const parsed = liveTimerState.safeParse(board.board.ui?.[BOARD_ROOM_KEY]?.timer)
    return parsed.success ? parsed.data : null
  }, [board.board.ui])

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
      const { error, calendarLesson } = await endLive(session.id).catch(() => ({
        error: 'failed',
        calendarLesson: null,
      }))

      if (error) {
        toast.error(t.live.failed)
        return
      }

      confirm({ status: 'ended' })
      if (calendarLesson) router.push(lessonAttendanceHref(calendarLesson))
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
  const hostHere = hostId in people
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
            <Button asChild variant="ghost" className="corner-brackets text-muted-foreground">
              <Link href={hosting ? (attendanceHref ?? `/library/${lesson.id}`) : '/student'}>
                {hosting
                  ? attendanceHref
                    ? t.calendar.attendance.take
                    : t.live.ended.toLesson
                  : t.live.ended.back}
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
            <Button
              type="button"
              variant="outline"
              onClick={gather}
              disabled={others.length === 0}
              className="corner-brackets"
              aria-label={t.live.gather}
            >
              <UsersIcon />
              <span className="hidden sm:inline">{t.live.gather}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={copyLink}
              className="corner-brackets"
              aria-label={t.live.copyLink}
            >
              <LinkIcon />
              <span className="hidden sm:inline">{t.live.copyLink}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setConfirming(true)}
              className="corner-brackets text-red-700 hover:text-red-700 dark:text-red-300 dark:hover:text-red-300"
              aria-label={pending ? t.live.ending : t.live.end}
            >
              {pending ? <Loader2Icon className="animate-spin" /> : <SquareIcon />}
              <span className="hidden sm:inline">{pending ? t.live.ending : t.live.end}</span>
            </Button>
          </div>
        ) : null}
      </div>

      <ClassroomControls
        sessionId={session.id}
        hosting={hosting}
        me={presence}
        people={people}
        hands={hands}
        ownHandRaised={ownHandRaised}
        reactions={reactions}
        focuses={focuses}
        following={following}
        stepId={stepId}
        stepIds={stepIds}
        timer={timer}
        serverTimeOffsetMs={board.serverTimeOffsetMs}
        status={status}
        returnToTeacher={strayed}
        onFollow={follow}
        onTimerChanged={resync}
        sendHand={sendHand}
        sendReaction={sendReaction}
        t={t}
      />

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
            <LiveMediaSessionContext.Provider value={session.id}>
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
            </LiveMediaSessionContext.Provider>
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
          <CursorLayer watch={watchCursors} stepId={stepId} />
          <ReactionBurst reactions={reactions} t={t} />
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

/** True when following this person would enter a chain that returns or already loops. */
function followChainLoops(personId: string, meId: string, people: Record<string, Someone>) {
  const visited = new Set<string>()
  let current: string | null = personId

  while (current) {
    if (current === meId || visited.has(current)) return true
    visited.add(current)
    current = people[current]?.following ?? null
  }

  return false
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

export type { LiveCursor }
