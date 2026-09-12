'use server'

import { revalidatePath } from 'next/cache'
import {
  extendSubscriptionBody,
  suspendSubscriptionBody,
  teacherIdParam,
  type TeacherDetail,
} from '@tp/shared'
import { ApiError, unwrap } from '@/lib/api/errors'
import { getApi } from '@/lib/api/server'
import type { TeacherActionState } from './action-state'

/**
 * Fetched when the detail panel opens rather than with the list, because the history is
 * only ever wanted for one teacher at a time and loading it for every row would be a
 * query per row for data nobody asked to see.
 */
export async function loadTeacherDetail(
  teacherId: string,
): Promise<{ data: TeacherDetail } | { error: true }> {
  const parsed = teacherIdParam.safeParse({ teacherId })
  if (!parsed.success) return { error: true }

  try {
    const api = await getApi()
    const data = await unwrap(
      await api.v1.admin.teachers[':teacherId'].$get({
        param: { teacherId: parsed.data.teacherId },
      }),
    )

    return { data }
  } catch (error) {
    if (error instanceof ApiError) return { error: true }

    throw error
  }
}

/**
 * Actions stay thin on purpose: validate with the same schema the API validates with,
 * call it, revalidate, report. Nothing here decides what extending means — that rule
 * lives in the API so the future mobile app gets the same answer.
 */
async function run(
  done: NonNullable<TeacherActionState['done']>,
  call: () => Promise<unknown>,
): Promise<TeacherActionState> {
  try {
    await call()
    revalidatePath('/admin/teachers')
    revalidatePath('/admin')

    return { error: null, done }
  } catch (error) {
    if (error instanceof ApiError) return { error: error.code, done: null }

    throw error
  }
}

export async function extendSubscription(
  _prev: TeacherActionState,
  formData: FormData,
): Promise<TeacherActionState> {
  const params = teacherIdParam.safeParse({ teacherId: formData.get('teacherId') })
  const body = extendSubscriptionBody.safeParse({ months: Number(formData.get('months') ?? 1) })

  if (!params.success || !body.success) return { error: 'validation_failed', done: null }

  return run('extended', async () => {
    const api = await getApi()

    return unwrap(
      await api.v1.admin.teachers[':teacherId'].subscription.extend.$post({
        param: { teacherId: params.data.teacherId },
        json: body.data,
      }),
    )
  })
}

export async function suspendSubscription(
  _prev: TeacherActionState,
  formData: FormData,
): Promise<TeacherActionState> {
  const params = teacherIdParam.safeParse({ teacherId: formData.get('teacherId') })
  const reason = formData.get('reason')
  const body = suspendSubscriptionBody.safeParse({
    reason: typeof reason === 'string' && reason.length > 0 ? reason : undefined,
  })

  if (!params.success || !body.success) return { error: 'validation_failed', done: null }

  return run('suspended', async () => {
    const api = await getApi()

    return unwrap(
      await api.v1.admin.teachers[':teacherId'].subscription.suspend.$post({
        param: { teacherId: params.data.teacherId },
        json: body.data,
      }),
    )
  })
}

export async function reactivateSubscription(
  _prev: TeacherActionState,
  formData: FormData,
): Promise<TeacherActionState> {
  const params = teacherIdParam.safeParse({ teacherId: formData.get('teacherId') })

  if (!params.success) return { error: 'validation_failed', done: null }

  return run('reactivated', async () => {
    const api = await getApi()

    return unwrap(
      await api.v1.admin.teachers[':teacherId'].subscription.reactivate.$post({
        param: { teacherId: params.data.teacherId },
      }),
    )
  })
}
