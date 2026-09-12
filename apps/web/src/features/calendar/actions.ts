'use server'

import { revalidatePath } from 'next/cache'
import {
  lessonIdParam,
  scheduleLessonBody,
  updateLessonBody,
  type ErrorCode,
  type ScheduleLessonBody,
  type UpdateLessonBody,
} from '@tp/shared'
import { ApiError, unwrap } from '@/lib/api/errors'
import { getApi } from '@/lib/api/server'

export async function updateLesson(
  lessonId: string,
  body: UpdateLessonBody,
): Promise<{
  data: { id: string; scheduledAt: string } | null
  error: ErrorCode | 'lesson_changed' | null
}> {
  const parsed = updateLessonBody.safeParse(body)
  const param = lessonIdParam.safeParse({ lessonId })
  if (!parsed.success || !param.success) return { data: null, error: 'validation_failed' }
  try {
    const api = await getApi()
    const data = await unwrap(
      await api.v1.me.lessons[':lessonId'].$patch({ param: param.data, json: parsed.data }),
    )
    revalidatePath('/dashboard/calendar')
    revalidatePath('/dashboard')
    revalidatePath('/admin/calendar')
    revalidatePath('/admin')
    revalidatePath('/student')
    return { data, error: null }
  } catch (error) {
    if (error instanceof ApiError) {
      const details = error.details
      const changed =
        error.code === 'conflict' &&
        typeof details === 'object' &&
        details !== null &&
        'reason' in details &&
        details.reason === 'lesson_changed'
      if (changed || error.code === 'not_found' || error.code === 'rule_violation') {
        revalidatePath('/dashboard/calendar')
      }
      return { data: null, error: changed ? 'lesson_changed' : error.code }
    }
    throw error
  }
}

export async function scheduleLesson(
  body: ScheduleLessonBody,
): Promise<{ data: { id: string; scheduledAt: string } | null; error: ErrorCode | null }> {
  const parsed = scheduleLessonBody.safeParse(body)
  if (!parsed.success) return { data: null, error: 'validation_failed' }
  try {
    const api = await getApi()
    const data = await unwrap(await api.v1.me.lessons.$post({ json: parsed.data }))
    revalidatePath('/dashboard/calendar')
    revalidatePath('/dashboard')
    revalidatePath('/admin/calendar')
    revalidatePath('/admin')
    return { data, error: null }
  } catch (error) {
    if (error instanceof ApiError) return { data: null, error: error.code }
    throw error
  }
}
