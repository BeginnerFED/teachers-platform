import 'server-only'
import type { CalendarLesson, ListLessonsQuery } from '@tp/shared'
import { unwrap } from '@/lib/api/errors'
import { getApi } from '@/lib/api/server'

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
