import { PLATFORM_TIME_ZONE, type LiveSession } from '@tp/shared'
import { startOfWeek, toIsoDate, toZoned } from '@/lib/zoned-time'

export function lessonAttendanceHref(lesson: NonNullable<LiveSession['calendarLesson']>) {
  const week = toIsoDate(startOfWeek(toZoned(new Date(lesson.scheduledAt), PLATFORM_TIME_ZONE)))
  return `/dashboard/calendar?${new URLSearchParams({ week, lesson: lesson.id, attendance: '1' })}`
}
