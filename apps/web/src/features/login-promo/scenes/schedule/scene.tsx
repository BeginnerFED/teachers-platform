'use client'

import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import type { CSSProperties } from 'react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAt } from '../../engine/clock'
import { staggered } from '../../engine/motion'
import { PromoPointer, type PointerStep } from '../../engine/pointer'
import { SceneFrame } from '../../engine/scene-frame'
import type { ScheduleCopy } from './copy'

/** The week grid's own measures (features/calendar/components/week-grid.tsx). */
const HOUR = 64
const AVATAR = 28

/** The afternoon, where this teacher's lessons are: the page scrolled to 14:30–18:30. */
const FROM = 14 * 60 + 30
const TO = 18 * 60 + 30
const HOURS = [15, 16, 17, 18]

/** Where a moment of the day sits in the cropped body, as the grid's `offset` measures it. */
const offset = (minutes: number) => ((minutes - FROM) / 60) * HOUR

const COLUMNS = 'grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))]'

type Person = keyof ScheduleCopy['faces']

/**
 * The tint each student wears — buckets of features/calendar/tint.ts — matched to the
 * colours the same people have in the other chapters (Оля sky, Максим violet).
 */
const TINT: Record<Person, string> = {
  olya: 'bg-sky-100 text-sky-800',
  maksym: 'bg-violet-100 text-violet-800',
  iryna: 'bg-emerald-100 text-emerald-800',
  dmytro: 'bg-amber-100 text-amber-800',
  anna: 'bg-rose-100 text-rose-800',
}

const time = (hour: number, minute = 0) => hour * 60 + minute

type Lesson = { day: number; start: number; person: Person; reminded?: true }

/**
 * Оля's lessons repeat every week on Monday, Wednesday and Thursday at 16:00 — one weekly
 * series, the way the schedule dialog sets one up. Thursday is today, and its 16:00 is the
 * lesson the reminder is about.
 */
const SERIES: Lesson[] = [
  { day: 0, start: time(16), person: 'olya' },
  { day: 2, start: time(16), person: 'olya' },
  { day: 3, start: time(16), person: 'olya', reminded: true },
]

/** The rest of the week, Monday first. */
const OTHERS: Lesson[] = [
  { day: 0, start: time(17, 30), person: 'maksym' },
  { day: 1, start: time(15), person: 'iryna' },
  { day: 1, start: time(18), person: 'dmytro' },
  { day: 3, start: time(17, 30), person: 'maksym' },
  { day: 4, start: time(15, 30), person: 'iryna' },
  { day: 4, start: time(18), person: 'dmytro' },
  { day: 5, start: time(16, 30), person: 'anna' },
]

/** The reminded lesson's topic, which the reminder carries. Lesson content stays English. */
const LESSON_TITLE = 'Ordering food at a restaurant'

// Beats, in ms from the scene's start. The frame brings the page in at 1060. The series lands
// first, as one row, so the repeat reads before anything else; the rest of the week follows
// once it has settled. The week gets a moment to be read, the pointer comes for today's
// lesson (arriving at 3070, the face lifting as it lands) and the reminder follows a beat
// later, with 1.6 s left to read it before the scene leaves at 5420.
const SERIES_AT = 1280
const WEEK_AT = 1600
const POINTER_AT = 2450
const HOVER_AT = 3010
const REMINDER_AT = 3500

const POINTER: PointerStep[] = [
  { at: POINTER_AT, appear: { x: 470, y: 600 } },
  { at: POINTER_AT + 100, to: 'reminded', duration: 520 },
]

/**
 * The teacher's week, a quarter of an hour before a lesson.
 *
 * The calendar page on a Thursday afternoon: the week toolbar, then the grid with each lesson
 * drawn as its student's face at the minute it starts and today's date in the brand circle.
 * The pointer comes to rest on today's 16:00 lesson with Оля, and the platform's own reminder
 * for it arrives in the corner — the toast the teacher and the lesson's students get fifteen
 * minutes before it starts, with the lesson's title and a way to open it.
 */
export function ScheduleScene({ copy }: { copy: ScheduleCopy }) {
  return (
    <SceneFrame
      title={copy.title}
      line={copy.line}
      overlay={<PromoPointer script={POINTER} still="reminded" />}
    >
      <Week copy={copy} />
    </SceneFrame>
  )
}

function Week({ copy }: { copy: ScheduleCopy }) {
  const seriesIn = useAt(SERIES_AT)
  const weekIn = useAt(WEEK_AT)
  const hovered = useAt(HOVER_AT)
  const reminded = useAt(REMINDER_AT)

  // Each wave staggers on its own, left to right, from the moment it is mounted.
  const arrived = [
    ...(seriesIn ? SERIES.map((lesson, index) => ({ lesson, index })) : []),
    ...(weekIn ? OTHERS.map((lesson, index) => ({ lesson, index })) : []),
  ]

  return (
    <div className="flex flex-col gap-4">
      {/* features/calendar/components/calendar-browser.tsx. A teacher's toolbar has no
          teacher picker, so the week label is its last item. */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <span className={buttonVariants({ variant: 'outline', size: 'icon' })}>
            <ChevronLeftIcon />
          </span>
          <span className={buttonVariants({ variant: 'outline', size: 'icon' })}>
            <ChevronRightIcon />
          </span>
        </div>
        <span className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'corner-brackets')}>
          {copy.thisWeek}
        </span>
        <p className="text-sm font-medium tabular-nums">{copy.week}</p>
      </div>

      {/* The grid's own frame. The page under it is white, and here the panel is not, so it
          carries the card surface itself. */}
      <div className="bg-card overflow-hidden rounded-md border">
        <div className={cn(COLUMNS, 'bg-muted/50 border-b')}>
          <div className="border-r" />
          {copy.days.map((day) => (
            <div
              key={day.day}
              className="flex items-baseline justify-center gap-1.5 border-r py-2 last:border-r-0"
            >
              <span className="text-muted-foreground text-xs capitalize">{day.weekday}</span>
              <span
                className={cn(
                  'text-sm tabular-nums',
                  day.today
                    ? 'bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-full font-semibold'
                    : 'font-medium',
                )}
              >
                {day.day}
              </span>
            </div>
          ))}
        </div>

        <div className={cn(COLUMNS, 'relative')} style={{ height: offset(TO) }}>
          <div className="relative border-r">
            {HOURS.map((hour) => (
              <span
                key={hour}
                className="text-muted-foreground absolute right-2 -translate-y-1/2 text-[11px] tabular-nums"
                style={{ top: offset(time(hour)) }}
              >
                {`${String(hour).padStart(2, '0')}:00`}
              </span>
            ))}
          </div>

          {copy.days.map((day, dayIndex) => (
            <div key={day.day} className="relative border-r last:border-r-0">
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  aria-hidden
                  className="border-border/60 absolute inset-x-0 border-t"
                  style={{ top: offset(time(hour)) }}
                />
              ))}

              {arrived
                .filter(({ lesson }) => lesson.day === dayIndex)
                .map(({ lesson, index }) => (
                  <Face
                    key={`${lesson.person}-${lesson.start}`}
                    initials={copy.faces[lesson.person]}
                    tint={TINT[lesson.person]}
                    // Centred on the minute it starts, in the first lane: the grid's `place`.
                    style={{
                      top: offset(lesson.start) - AVATAR / 2,
                      left: 4,
                      ...staggered(index),
                    }}
                    anchor={lesson.reminded ? 'reminded' : undefined}
                    hovered={lesson.reminded && hovered}
                  />
                ))}
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        {reminded ? (
          <Reminder title={copy.reminder} description={LESSON_TITLE} action={copy.open} />
        ) : null}
      </div>
    </div>
  )
}

/**
 * One lesson on the grid: the student's initials in their tint, outlined in the text colour
 * at half strength, lifting the way the grid's marks do under a pointer.
 */
function Face({
  initials,
  tint,
  style,
  anchor,
  hovered,
}: {
  initials: string
  tint: string
  style: CSSProperties
  anchor?: string
  hovered?: boolean
}) {
  return (
    <span
      data-hover={hovered || undefined}
      className="animate-rise-in absolute rounded-full transition-transform data-[hover]:z-10 data-[hover]:scale-110"
      style={style}
    >
      <Avatar className="rounded-full" style={{ width: AVATAR, height: AVATAR }}>
        <AvatarFallback
          className={cn('border-current/50 rounded-full border text-[10px] font-semibold', tint)}
        >
          {initials}
        </AvatarFallback>
      </Avatar>
      {/* Where the pointer's tip rests: low on the face, so the initials stay readable. */}
      {anchor ? <span data-anchor={anchor} className="absolute bottom-1.5 right-1.5" /> : null}
    </span>
  )
}

/**
 * The reminder as Sonner draws it under the product's Toaster (components/ui/sonner.tsx):
 * a plain toast on the popover surface with Sonner's own radius, shadow, 13px type and
 * description grey, the kind as its title, the lesson as its description and the small dark
 * action — exactly what study-updates.tsx passes to `toast()`.
 */
function Reminder({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action: string
}) {
  return (
    <div className="animate-rise-in bg-popover text-popover-foreground flex w-[356px] items-center gap-1.5 rounded-lg border p-4 text-[13px] shadow-[0_4px_12px_rgba(0,0,0,0.1)]">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="font-medium leading-normal">{title}</p>
        <p className="leading-[1.4] text-[#3f3f3f]">{description}</p>
      </div>
      <span className="bg-popover-foreground text-popover flex h-6 shrink-0 items-center rounded-[4px] px-2 text-xs font-medium">
        {action}
      </span>
    </div>
  )
}
