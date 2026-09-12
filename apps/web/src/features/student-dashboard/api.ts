import 'server-only'
import type { ListMyLessonsQuery, StudyLesson, StudyTeacher, StudyUpdate } from '@tp/shared'
import { getApi } from '@/lib/api/server'
import { unwrap } from '@/lib/api/errors'

export async function studentLessons(query: ListMyLessonsQuery): Promise<StudyLesson[]> {
  const api = await getApi()
  return unwrap(await api.v1.me.study.lessons.$get({ query }, { init: { cache: 'no-store' } }))
}
export async function upcomingStudentLessons(): Promise<StudyLesson[]> {
  const api = await getApi()
  return unwrap(await api.v1.me.study.upcoming.$get({}, { init: { cache: 'no-store' } }))
}
export async function studentTeachers(): Promise<StudyTeacher[]> {
  const api = await getApi()
  return unwrap(await api.v1.me.study.teachers.$get({}, { init: { cache: 'no-store' } }))
}
export async function studentUpdates(): Promise<StudyUpdate[]> {
  const api = await getApi()
  return unwrap(await api.v1.me.study.notifications.$get({}, { init: { cache: 'no-store' } }))
}
