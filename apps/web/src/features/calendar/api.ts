import 'server-only'
import type {
  CalendarLesson,
  ListLessonsQuery,
  ListMyLessonsQuery,
  PendingLessons,
  TeacherStudentOverview,
} from '@tp/shared'
import { unwrap } from '@/lib/api/errors'
import { getApi } from '@/lib/api/server'
export async function listTeacherStudentOverview(): Promise<TeacherStudentOverview[]> {
  const api = await getApi()
  return unwrap(await api.v1.me.students.overview.$get({}, { init: { cache: 'no-store' } }))
}

export async function listPendingLessons(): Promise<PendingLessons> {
  const api = await getApi()
  return unwrap(await api.v1.me.lessons.pending.$get({}, { init: { cache: 'no-store' } }))
}

/** The only place the web app asks the API for a window of lessons. */
export async function listLessons(query: ListLessonsQuery): Promise<CalendarLesson[]> {
  const api = await getApi()

  const response = await api.v1.admin.lessons.$get({
    query: {
      from: query.from,
      to: query.to,
      ...(query.teacherId ? { teacherId: query.teacherId } : {}),
    },
  })

  return unwrap(response)
}

export async function listMyLessons(query: ListMyLessonsQuery): Promise<CalendarLesson[]> {
  const api = await getApi()
  return unwrap(
    await api.v1.me.lessons.$get(
      { query: { from: query.from, to: query.to } },
      { init: { cache: 'no-store' } },
    ),
  )
}
