'use client'

import { useState } from 'react'
import type { CalendarLesson, MaterialOwner } from '@tp/shared'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { initials } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  addDays,
  fromZoned,
  isSameDate,
  minutesIntoDay,
  toZoned,
  type PlainDate,
} from '@/lib/zoned-time'
import type { Messages } from '@/messages'
import { packOverlapping, type Placed } from '../layout'
import { tintFor } from '../tint'
import { LessonDetailSheet } from './lesson-detail-sheet'
import { EditLessonDialog } from './schedule-lesson-dialog'

/** One hour of the day, in pixels. */
const HOUR = 64

/** What the grid falls back to when the week is empty and nothing sets its own bounds. */
const DEFAULT_FIRST_HOUR = 8
const DEFAULT_LAST_HOUR = 21

/**
 * The mark itself, and the step between two of them standing side by side. The step is
 * two pixels short of the mark on purpose: a hair of overlap reads as a group, and it
 * keeps a full row inside a day column even on a thirteen-inch screen, where seven
 * columns leave about a hundred and thirty pixels each.
 */
const AVATAR = 28
const STEP = 26

/**
 * A lesson is drawn at the moment it starts, not as a block covering the time it runs
 * for. Two marks collide when their starts are closer together than the height of a
 * mark — which at this scale is half an hour — and colliding marks stand side by side.
 */
const COLLIDE_MINUTES = Math.round((AVATAR / HOUR) * 60)

/**
 * Past four abreast there is no room, and the honest thing is to say how many are hidden
 * rather than to draw marks too small to read or to hit.
 */
const MAX_LANES = 4

type Positioned = { lesson: CalendarLesson; date: PlainDate; start: number }

function pad(value: number) {
  return String(value).padStart(2, '0')
}

/** Noon, because a date has no time and noon is the hour a clock change cannot erase. */
function instantForDay(date: PlainDate, timeZone: string): Date {
  return fromZoned({ ...date, hour: 12, minute: 0 }, timeZone)
}

export function WeekGrid({
  lessons,
  monday,
  today,
  timeZone,
  locale,
  t,
  showStudents = false,
  editing,
  initialLessonId,
  initialAttendance = false,
}: {
  lessons: CalendarLesson[]
  monday: PlainDate
  today: PlainDate
  timeZone: string
  locale: string
  t: Messages
  showStudents?: boolean
  editing?: { teacherId: string; students: MaterialOwner[] | null }
  initialLessonId?: string
  initialAttendance?: boolean
}) {
  // One sheet for the grid. Holds a single lesson, or the crowd behind a "+3" marker.
  const [openIds, setOpenIds] = useState<string[]>(initialLessonId ? [initialLessonId] : [])
  const [autoAttendance, setAutoAttendance] = useState(initialAttendance)
  const [editLesson, setEditLesson] = useState<CalendarLesson | null>(null)
  const open = lessons.filter((lesson) => openIds.includes(lesson.id))

  const days = Array.from({ length: 7 }, (_, index) => addDays(monday, index))

  // Each lesson placed on the wall clock of the platform's zone, once, so nothing below
  // has to think about time zones again.
  const positioned: Positioned[] = lessons.map((lesson) => {
    const instant = new Date(lesson.scheduledAt)

    return {
      lesson,
      date: toZoned(instant, timeZone),
      start: minutesIntoDay(instant, timeZone),
    }
  })

  // The grid stretches to what is actually in the week rather than to office hours, so a
  // lesson at seven in the morning is visible instead of scrolled off the top.
  const firstHour = positioned.length
    ? Math.max(0, Math.min(DEFAULT_FIRST_HOUR, ...positioned.map((p) => Math.floor(p.start / 60))))
    : DEFAULT_FIRST_HOUR
  const lastHour = positioned.length
    ? Math.min(
        24,
        Math.max(DEFAULT_LAST_HOUR, ...positioned.map((p) => Math.ceil(p.start / 60) + 1)),
      )
    : DEFAULT_LAST_HOUR

  const hours = Array.from({ length: lastHour - firstHour }, (_, index) => firstHour + index)
  const height = hours.length * HOUR
  const offset = (minutes: number) => ((minutes - firstHour * 60) / 60) * HOUR

  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone })
  const dayNumber = new Intl.DateTimeFormat(locale, { day: 'numeric', timeZone })
  const clock = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', timeZone })

  const columns = 'grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))]'

  /** Whose face this is, and what is said about it when the pointer rests on it. */
  function describe(lesson: CalendarLesson) {
    const teacher = lesson.teacher ? (lesson.teacher.fullName ?? lesson.teacher.email) : '—'
    const students = lesson.students.map((s) => s.fullName ?? s.email)
    const person = showStudents ? lesson.students[0] : lesson.teacher

    return {
      name: person ? (person.fullName ?? person.email) : '—',
      id: person?.id,
      title: `${clock.format(new Date(lesson.scheduledAt))} · ${showStudents ? students.join(', ') || t.calendar.noStudents : teacher}${editing && lesson.attendancePending ? ` · ${t.calendar.attendance.pending}` : ''}${
        showStudents ? '' : `\n${students.length ? students.join(', ') : t.calendar.noStudents}`
      }${lesson.topic ? `\n${lesson.topic}` : ''}`,
    }
  }

  return (
    <>
      <div className="overflow-hidden rounded-md border">
        <div className={cn(columns, 'bg-muted/50 border-b')}>
          <div className="border-r" />

          {days.map((day) => {
            const current = isSameDate(day, today)

            return (
              <div
                key={`${day.month}-${day.day}`}
                className="flex items-baseline justify-center gap-1.5 border-r py-2 last:border-r-0"
              >
                <span className="text-muted-foreground text-xs capitalize">
                  {weekday.format(instantForDay(day, timeZone))}
                </span>
                <span
                  className={cn(
                    'text-sm tabular-nums',
                    current
                      ? 'bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-full font-semibold'
                      : 'font-medium',
                  )}
                >
                  {dayNumber.format(instantForDay(day, timeZone))}
                </span>
              </div>
            )
          })}
        </div>

        <div className="relative overflow-x-auto">
          <div className={cn(columns, 'relative')} style={{ height }}>
            <div className="relative border-r">
              {hours.map((hour) => (
                <span
                  key={hour}
                  className="text-muted-foreground absolute right-2 -translate-y-1/2 text-[11px] tabular-nums"
                  style={{ top: offset(hour * 60) }}
                >
                  {`${pad(hour)}:00`}
                </span>
              ))}
            </div>

            {days.map((day) => {
              const ofDay = positioned.filter((p) => isSameDate(p.date, day))
              const packed = packOverlapping(ofDay, (p) => ({
                start: p.start,
                end: p.start + COLLIDE_MINUTES,
              }))

              // Each run of marks that would sit on top of each other is capped on its
              // own, so one crowded hour does not put a "+2" on a morning with room.
              const clusters = new Map<number, Placed<Positioned>[]>()
              for (const entry of packed) {
                const bucket = clusters.get(entry.cluster) ?? []
                bucket.push(entry)
                clusters.set(entry.cluster, bucket)
              }

              return (
                <div key={`${day.month}-${day.day}`} className="relative border-r last:border-r-0">
                  {hours.map((hour) => (
                    <div
                      key={hour}
                      aria-hidden
                      className="border-border/60 absolute inset-x-0 border-t first:border-t-0"
                      style={{ top: offset(hour * 60) }}
                    />
                  ))}

                  {[...clusters.values()].flatMap((entries) => {
                    const crowded = entries[0].lanes > MAX_LANES
                    const visible = crowded
                      ? entries.filter((entry) => entry.lane < MAX_LANES - 1)
                      : entries
                    const hidden = crowded
                      ? entries.filter((entry) => entry.lane >= MAX_LANES - 1)
                      : []

                    // Centred on the moment it begins, so the mark reads as sitting at a
                    // time rather than starting after one.
                    const place = (lane: number, start: number) => ({
                      top: offset(start) - AVATAR / 2,
                      left: 4 + lane * STEP,
                    })

                    const marks = visible.map(({ item, lane }) => {
                      const { lesson } = item
                      const { name, id, title } = describe(lesson)

                      return (
                        <button
                          key={lesson.id}
                          type="button"
                          onClick={() => setOpenIds([lesson.id])}
                          title={title}
                          aria-label={`${t.calendar.openLesson}: ${title}`}
                          className={cn(
                            'absolute cursor-pointer rounded-full transition-transform hover:z-10 hover:scale-110',
                            // A cancelled lesson is drained of colour. Nothing is ringed:
                            // the outline belongs to the person, not to the status.
                            lesson.status === 'canceled' && 'opacity-40 grayscale',
                          )}
                          style={place(lane, item.start)}
                        >
                          <Avatar
                            className="rounded-full"
                            style={{ width: AVATAR, height: AVATAR }}
                          >
                            <AvatarFallback
                              className={cn(
                                // The same outlined-badge rule used everywhere else: the
                                // border is the text colour at half strength, so it is
                                // unmistakably the same hue without competing with it.
                                'border-current/50 rounded-full border text-[10px] font-semibold',
                                id ? tintFor(id) : '',
                              )}
                            >
                              {initials(name)}
                            </AvatarFallback>
                          </Avatar>
                          {editing && lesson.attendancePending && (
                            <span
                              aria-hidden
                              className="ring-background absolute -right-0.5 -top-0.5 size-2 rounded-full bg-amber-500 ring-2"
                            />
                          )}
                        </button>
                      )
                    })

                    if (hidden.length === 0) return marks

                    const from = Math.min(...hidden.map((entry) => entry.item.start))

                    return [
                      ...marks,
                      <button
                        key={`more-${entries[0].cluster}-${from}`}
                        type="button"
                        onClick={() => setOpenIds(hidden.map((entry) => entry.item.lesson.id))}
                        title={hidden
                          .map((entry) => describe(entry.item.lesson).title.split('\n')[0])
                          .join('\n')}
                        className="absolute flex cursor-pointer items-center transition-transform hover:z-10 hover:scale-110"
                        style={place(MAX_LANES - 1, from)}
                      >
                        {/* One face and a count sitting behind it, the way a shared
                            document shows who is in it. Two faces plus a number beside
                            them was wider than a day column has to spare. */}
                        <Avatar
                          className="ring-background relative z-10 rounded-full ring-2"
                          style={{ width: AVATAR, height: AVATAR }}
                        >
                          <AvatarFallback
                            className={cn(
                              'border-current/50 rounded-full border text-[10px] font-semibold',
                              describe(hidden[0].item.lesson).id
                                ? tintFor(describe(hidden[0].item.lesson).id!)
                                : '',
                            )}
                          >
                            {initials(describe(hidden[0].item.lesson).name)}
                          </AvatarFallback>
                        </Avatar>

                        <span
                          className="bg-muted text-muted-foreground ring-background border-current/40 -ml-2.5 flex items-center justify-center rounded-full border text-[10px] font-semibold tabular-nums ring-2"
                          style={{ width: AVATAR, height: AVATAR }}
                        >
                          {`+${hidden.length}`}
                        </span>
                      </button>,
                    ]
                  })}
                </div>
              )
            })}
          </div>

          {lessons.length === 0 ? (
            <p className="text-muted-foreground pointer-events-none absolute inset-0 flex items-center justify-center text-sm">
              {t.calendar.empty}
            </p>
          ) : null}
        </div>
      </div>

      <LessonDetailSheet
        lessons={open}
        initialAttendance={autoAttendance}
        onOpenChange={(next) => {
          if (!next) {
            setOpenIds([])
            setAutoAttendance(false)
          }
        }}
        timeZone={timeZone}
        locale={locale}
        t={t}
        onEdit={editing ? setEditLesson : undefined}
        editableTeacherId={editing?.teacherId}
      />
      {editing && editLesson && (
        <EditLessonDialog
          key={editLesson.id}
          lesson={editLesson}
          students={editing.students}
          locale={locale}
          t={t}
          onClose={() => setEditLesson(null)}
          onSaved={() => setOpenIds([])}
        />
      )}
    </>
  )
}
