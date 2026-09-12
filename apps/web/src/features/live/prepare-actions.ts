'use server'

import { z } from 'zod'
import {
  PLATFORM_TIME_ZONE,
  type CalendarLesson,
  type HostedLiveSession,
  type ErrorCode,
} from '@tp/shared'
import { listMyLessons } from '@/features/calendar/api'
import { myLiveSession } from './api'
import { ApiError } from '@/lib/api/errors'
import { addDays, fromZoned, toZoned } from '@/lib/zoned-time'

type Preparation = { lessons: CalendarLesson[]; session: HostedLiveSession | null }
export async function prepareLiveLesson(
  studentIds: string[],
): Promise<{ data: Preparation; error: null } | { data: null; error: ErrorCode }> {
  const parsed = z.array(z.uuid()).min(1).max(50).safeParse(studentIds)
  if (!parsed.success || new Set(parsed.data).size !== parsed.data.length)
    return { data: null, error: 'validation_failed' }
  try {
    const today = toZoned(new Date(), PLATFORM_TIME_ZONE)
    const from = fromZoned({ ...today, hour: 0, minute: 0 }, PLATFORM_TIME_ZONE)
    const to = fromZoned({ ...addDays(today, 1), hour: 0, minute: 0 }, PLATFORM_TIME_ZONE)
    const [lessons, session] = await Promise.all([
      listMyLessons({ from: from.toISOString(), to: to.toISOString() }),
      myLiveSession(),
    ])
    const chosen = new Set(parsed.data)
    return {
      data: {
        lessons: lessons.filter(
          (lesson) =>
            lesson.status === 'scheduled' &&
            lesson.students.length === chosen.size &&
            lesson.students.every((student) => chosen.has(student.id)),
        ),
        session,
      },
      error: null,
    }
  } catch (error) {
    return { data: null, error: error instanceof ApiError ? error.code : 'upstream_unavailable' }
  }
}
