'use client'

import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, UsersIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { buttonVariants } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ExerciseShell } from '@/features/library/blocks/shell'
import { PALETTE } from '@/features/live/palette'
import { cn } from '@/lib/utils'
import { useAt, useCue } from '../../engine/clock'
import { EASE } from '../../engine/motion'
import { PromoPointer } from '../../engine/pointer'
import { SceneFrame } from '../../engine/scene-frame'
import type { LiveCopy } from './copy'

/** Everyone in the room, in the colour the room gives them. */
const HOST_COLOR = PALETTE[6]!
const OLYA_COLOR = PALETTE[1]!
const MAKSYM_COLOR = PALETTE[3]!

/** The step on the board: the same block the editor scene has just made. */
const LESSON = { step: 'Paying the bill', prompt: 'Complete the dialogue.' }

/** The scene's moments, in ms from its start. The caption has the first second. */
const T = {
  /** Оля comes into the room: her disc joins the stack, the count goes from 2 to 3. */
  join: 1500,
  /** Максим, already in the room, takes the first gap and starts typing. */
  maksymIn: 1700,
  maksymTyping: 2340,
  /** Оля comes onto the board from the right and takes the second. */
  olyaIn: 1850,
  olyaTyping: 2470,
  /** The room sends typing a word at a time, so each answer lands whole. */
  have: 2950,
  card: 3120,
  /** The teacher's own pointer goes to "Перевірити". Only the host can press it. */
  teacherIn: 3450,
  hover: 4000,
  press: 4300,
  /** The step locks; the focus boxes go. */
  locked: 4350,
  /** The marks land on the board, for everyone at once. */
  marks: 4750,
  teacherOut: 5000,
} as const

/** A student at the board: their colour, and when they are in their gap, typing. */
type Person = { color: string; typing: number }

const MAKSYM: Person = { color: MAKSYM_COLOR, typing: T.maksymTyping }
const OLYA: Person = { color: OLYA_COLOR, typing: T.olyaTyping }

/**
 * A disc joining the stack makes its own room: it comes out from under its neighbour
 * while the stack widens, instead of the stack jumping a disc's width.
 */
const JOIN_KEYFRAMES =
  '@keyframes promo-live-join{from{opacity:0;margin-inline-start:-14px}to{opacity:1;margin-inline-start:0}}'

/**
 * The live room, from the host's chair: the room's sentence and who is in it, then the
 * shared board — the player in its compact form — with the class's pointers and focus
 * boxes over it. Two students fill two gaps at once, the words arrive whole, and the
 * check that only the host can press marks the step for everyone.
 */
export function LiveScene({ copy }: { copy: LiveCopy }) {
  return (
    <SceneFrame title={copy.title} line={copy.line} overlay={<Pointers copy={copy} />}>
      <div className="flex flex-col gap-5">
        <style>{JOIN_KEYFRAMES}</style>
        <RoomStatus copy={copy} />
        <Board copy={copy} />
      </div>
    </SceneFrame>
  )
}

function Pointers({ copy }: { copy: LiveCopy }) {
  return (
    <>
      <PromoPointer
        remote={{ color: MAKSYM_COLOR, name: copy.maksym }}
        script={[
          { at: T.maksymIn, appear: { x: 58, y: 598 } },
          { at: T.maksymIn + 60, to: 'maksym', duration: 560 },
        ]}
        still="maksym"
      />
      <PromoPointer
        remote={{ color: OLYA_COLOR, name: copy.olya }}
        script={[
          { at: T.olyaIn, appear: { x: 470, y: 336 } },
          { at: T.olyaIn + 60, to: 'olya', duration: 540 },
        ]}
        still="olya"
      />
      <PromoPointer
        script={[
          { at: T.teacherIn, appear: { x: 470, y: 612 } },
          { at: T.teacherIn + 50, to: 'check', duration: 500 },
          { at: T.press, press: true },
          { at: T.teacherOut, leave: true },
        ]}
      />
    </>
  )
}

/** live-room.tsx's sentence with the live dot, and the participants pill beside it. */
function RoomStatus({ copy }: { copy: LiveCopy }) {
  const joined = useAt(T.join)

  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-muted-foreground flex min-w-0 items-center gap-2 text-sm tabular-nums">
        <span className="relative flex size-2 shrink-0">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-500 opacity-60" />
          <span className="relative inline-flex size-2 rounded-full bg-red-500" />
        </span>
        <span className="truncate">{joined ? copy.roomAfter : copy.roomBefore}</span>
      </p>

      <span className={cn(buttonVariants({ variant: 'outline' }), 'corner-brackets shrink-0')}>
        <span className="flex -space-x-1.5">
          <Disc color={HOST_COLOR}>{copy.hostInitials}</Disc>
          <Disc color={MAKSYM_COLOR}>{copy.maksymInitials}</Disc>
          {joined ? (
            <Disc color={OLYA_COLOR} joining>
              {copy.olyaInitials}
            </Disc>
          ) : null}
        </span>
        <UsersIcon />
        <span className="tabular-nums">{joined ? 3 : 2}</span>
      </span>
    </div>
  )
}

/** classroom-controls.tsx's ParticipantStack disc. */
function Disc({
  color,
  joining = false,
  children,
}: {
  color: string
  joining?: boolean
  children: ReactNode
}) {
  return (
    <span
      className="ring-background flex size-5 items-center justify-center rounded-full text-[8px] font-semibold text-white ring-2"
      style={{
        backgroundColor: color,
        animation: joining ? `promo-live-join 280ms ${EASE} both` : undefined,
      }}
    >
      {children}
    </span>
  )
}

/** material-player.tsx with `compactHeader`, on step 2 of 4. */
function Board({ copy }: { copy: LiveCopy }) {
  const marked = useAt(T.marks)

  return (
    <div className="flex flex-col gap-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span />
          <span className="text-muted-foreground text-xs tabular-nums">{copy.step}</span>
        </div>
        <Progress value={50} aria-label={copy.step} className="lesson-progress h-1" />
      </header>

      <div className="flex flex-col gap-6">
        <h2 className="-mt-2 text-lg font-medium">{LESSON.step}</h2>

        <div className="flex flex-col gap-5">
          {/* The board is the page's own surface, so on the panel it takes the page's
              white; its compact padding leaves the room row its air above the board. */}
          <ExerciseShell label={copy.fillGaps} prompt={LESSON.prompt} className="bg-card sm:p-4">
            <p className="text-[15px] leading-[2.4]">
              <span className="whitespace-pre-wrap">Could I </span>
              <Gap
                word="have"
                lands={T.have}
                person={MAKSYM}
                label={`${copy.maksym} ${copy.typing}`}
                anchor="maksym"
                rest="top-3 right-1.5"
              />
              <span className="whitespace-pre-wrap">
                {' the bill, please?\nOf course. Would you like to pay by '}
              </span>
              <Gap
                word="card"
                lands={T.card}
                person={OLYA}
                label={`${copy.olya} ${copy.typing}`}
                anchor="olya"
                rest="top-[18px] right-2"
              />
              <span className="whitespace-pre-wrap">?</span>
            </p>
          </ExerciseShell>
        </div>

        {marked ? <Verdict copy={copy} /> : null}
      </div>

      <Footer copy={copy} />
    </div>
  )
}

/**
 * writing.tsx's gap: an underline as wide as a word, which takes the emerald tone when
 * the step is marked. Whoever is in it is drawn round it the way presence-overlay.tsx
 * draws them: a 2px box 3px out, their name and "пише…" hung above its right end.
 */
function Gap({
  word,
  lands,
  person,
  label,
  anchor,
  rest,
}: {
  word: string
  lands: number
  person: Person
  /** "Оля пише…" */
  label: string
  anchor: string
  /** Where this person's pointer rests while they type, clear of the words. */
  rest: string
}) {
  const landed = useAt(lands)
  const marked = useAt(T.marks)

  return (
    <span className="relative mx-1 inline-flex">
      <input
        readOnly
        tabIndex={-1}
        value={word}
        aria-label={word}
        style={{ width: `${Math.max(6, word.length + 2)}ch` }}
        className={cn(
          'border-input border-0 border-b-2 bg-transparent px-1 text-center text-[15px] outline-none transition-colors duration-200',
          !landed && 'text-transparent',
          marked && 'border-emerald-500 text-emerald-700 dark:text-emerald-300',
        )}
      />
      <Presence person={person} label={label} />
      <span data-anchor={anchor} className={cn('absolute size-0', rest)} />
    </span>
  )
}

function Presence({ person, label }: { person: Person; label: string }) {
  // Typing in the gap, leaving as the step locks, gone.
  const cue = useCue([person.typing, T.locked, T.locked + 160])
  if (cue === 0 || cue === 3) return null

  const motion =
    cue === 2
      ? 'animate-out fade-out-0 fill-mode-forwards duration-150'
      : 'animate-in fade-in-0 duration-150'

  return (
    <>
      <span
        className={cn('pointer-events-none absolute -inset-[3px] rounded-md border-2', motion)}
        style={{ borderColor: person.color }}
      />
      <span
        className={cn(
          'absolute -top-[25px] right-0 inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium leading-normal text-white shadow-sm',
          motion,
        )}
        style={{ backgroundColor: person.color }}
      >
        {label}
      </span>
    </>
  )
}

/** The step's result, as the player draws it once every answer is right. */
function Verdict({ copy }: { copy: LiveCopy }) {
  return (
    <div className="lesson-feedback-enter bg-card rounded-lg">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-4 text-sm">
        <CheckIcon className="lesson-result-icon size-4 text-emerald-600" />
        <span className="font-medium">{copy.allCorrect}</span>
      </div>
    </div>
  )
}

/**
 * The player's footer. "Перевірити" is there because the host may mark the step; once
 * marked it goes, and "Далі" becomes the way on. When the verdict arrives above it, the
 * footer glides down by the verdict's height rather than jumping.
 */
function Footer({ copy }: { copy: LiveCopy }) {
  // Idle, hovered, pressed, checking, marked.
  const stage = useCue([T.hover, T.press, T.press + 120, T.marks])
  const checking = stage === 2 || stage === 3
  const marked = stage === 4

  return (
    <footer
      className={cn(
        'bg-background flex items-center justify-between gap-3 rounded-lg border px-4 py-3',
        marked &&
          'animate-in slide-in-from-top-[78px] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
      )}
    >
      <span className={buttonVariants({ variant: 'ghost' })}>
        <ChevronLeftIcon className="size-4" />
        {copy.previous}
      </span>

      <div className="flex items-center gap-2">
        {marked ? null : (
          <span
            data-anchor="check"
            data-hover={stage === 1 || undefined}
            data-pressed={stage === 2 || undefined}
            className={cn(
              buttonVariants({ size: 'sm' }),
              'corner-brackets data-[pressed]:translate-y-px data-[hover]:after:inset-[-4px] data-[hover]:after:opacity-100',
              checking && 'opacity-50',
            )}
          >
            {checking ? copy.checking : copy.check}
          </span>
        )}
        <span
          className={cn(
            buttonVariants({ size: 'sm', variant: marked ? 'default' : 'outline' }),
            'corner-brackets',
          )}
        >
          {copy.next}
          <ChevronRightIcon className="size-4" />
        </span>
      </div>
    </footer>
  )
}
