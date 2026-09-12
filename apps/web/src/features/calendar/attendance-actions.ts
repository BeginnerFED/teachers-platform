'use server'

import { revalidatePath } from 'next/cache'
import {
  cancelLessonSeriesBody,
  type CancelLessonSeriesBody,
  type LessonSeriesCancellationPreview,
  creditGrantParam,
  reverseLessonCreditsBody,
  type ReverseLessonCreditsBody,
  grantLessonCreditsBody,
  lessonIdParam,
  lessonStudentParam,
  recordAttendanceBody,
  type ErrorCode,
  type GrantLessonCreditsBody,
  type LessonCreditSummary,
  type RecordAttendanceBody,
} from '@tp/shared'
import { ApiError, unwrap } from '@/lib/api/errors'
import { getApi } from '@/lib/api/server'

type Result<T> = { data: T; error: null } | { data: null; error: ErrorCode | 'lesson_changed' }
export async function previewSeriesCancellation(
  id: string,
): Promise<Result<LessonSeriesCancellationPreview>> {
  const param = lessonIdParam.safeParse({ lessonId: id })
  if (!param.success) return { data: null, error: 'validation_failed' }
  try {
    const api = await getApi()
    const data = await unwrap(
      await api.v1.me.lessons[':lessonId'].cancellation.$get(
        { param: param.data },
        { init: { cache: 'no-store' } },
      ),
    )
    return { data, error: null }
  } catch (error) {
    return { data: null, error: errorCode(error) }
  }
}
export async function cancelFollowingLessons(
  id: string,
  body: CancelLessonSeriesBody,
): Promise<Result<{ count: number }>> {
  const param = lessonIdParam.safeParse({ lessonId: id })
  const parsed = cancelLessonSeriesBody.safeParse(body)
  if (!param.success || !parsed.success) return { data: null, error: 'validation_failed' }
  try {
    const api = await getApi()
    const data = await unwrap(
      await api.v1.me.lessons[':lessonId']['cancel-following'].$post({
        param: param.data,
        json: parsed.data,
      }),
    )
    refreshLessons()
    return { data, error: null }
  } catch (error) {
    const code = errorCode(error)
    if (code === 'lesson_changed' || code === 'not_found') refreshLessons()
    return { data: null, error: code }
  }
}
export async function reverseLessonCredits(
  studentId: string,
  grantId: string,
  body: ReverseLessonCreditsBody,
): Promise<Result<LessonCreditSummary>> {
  const param = creditGrantParam.safeParse({ studentId, grantId })
  const parsed = reverseLessonCreditsBody.safeParse(body)
  if (!param.success || !parsed.success) return { data: null, error: 'validation_failed' }
  try {
    const api = await getApi()
    await unwrap(
      await api.v1.me.students[':studentId']['lesson-credits'][':grantId'].reverse.$post({
        param: param.data,
        json: parsed.data,
      }),
    )
    const data = await unwrap(
      await api.v1.me.students[':studentId']['lesson-credits'].$get(
        { param: { studentId } },
        { init: { cache: 'no-store' } },
      ),
    )
    refreshLessons()
    return { data, error: null }
  } catch (error) {
    return { data: null, error: errorCode(error) }
  }
}
function refreshLessons() {
  for (const path of [
    '/dashboard',
    '/dashboard/calendar',
    '/admin',
    '/admin/calendar',
    '/admin/students',
    '/student',
    '/student/calendar',
  ])
    revalidatePath(path)
}
function errorCode(error: unknown): ErrorCode | 'lesson_changed' {
  if (!(error instanceof ApiError)) return 'upstream_unavailable'
  if (
    error.code === 'conflict' &&
    typeof error.details === 'object' &&
    error.details !== null &&
    'reason' in error.details &&
    error.details.reason === 'lesson_changed'
  )
    return 'lesson_changed'
  return error.code
}
export async function recordAttendance(
  id: string,
  body: RecordAttendanceBody,
): Promise<Result<{ id: string }>> {
  const param = lessonIdParam.safeParse({ lessonId: id })
  const parsed = recordAttendanceBody.safeParse(body)
  if (!param.success || !parsed.success) return { data: null, error: 'validation_failed' }
  try {
    const api = await getApi()
    const data = await unwrap(
      await api.v1.me.lessons[':lessonId'].attendance.$patch({
        param: param.data,
        json: parsed.data,
      }),
    )
    refreshLessons()
    return { data, error: null }
  } catch (error) {
    const code = errorCode(error)
    if (code === 'lesson_changed' || code === 'not_found') refreshLessons()
    return { data: null, error: code }
  }
}
export async function loadLessonCredits(studentId: string): Promise<Result<LessonCreditSummary>> {
  const param = lessonStudentParam.safeParse({ studentId })
  if (!param.success) return { data: null, error: 'validation_failed' }
  try {
    const api = await getApi()
    const data = await unwrap(
      await api.v1.me.students[':studentId']['lesson-credits'].$get(
        { param: param.data },
        { init: { cache: 'no-store' } },
      ),
    )
    return { data, error: null }
  } catch (error) {
    return { data: null, error: errorCode(error) }
  }
}
export async function grantLessonCredits(
  studentId: string,
  body: GrantLessonCreditsBody,
): Promise<Result<LessonCreditSummary>> {
  const param = lessonStudentParam.safeParse({ studentId })
  const parsed = grantLessonCreditsBody.safeParse(body)
  if (!param.success || !parsed.success) return { data: null, error: 'validation_failed' }
  try {
    const api = await getApi()
    await unwrap(
      await api.v1.me.students[':studentId']['lesson-credits'].$post({
        param: param.data,
        json: parsed.data,
      }),
    )
    const data = await unwrap(
      await api.v1.me.students[':studentId']['lesson-credits'].$get(
        { param: param.data },
        { init: { cache: 'no-store' } },
      ),
    )
    refreshLessons()
    return { data, error: null }
  } catch (error) {
    return { data: null, error: errorCode(error) }
  }
}
