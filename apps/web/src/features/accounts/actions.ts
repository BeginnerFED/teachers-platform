'use server'

import { revalidatePath } from 'next/cache'
import {
  accountIdParam,
  createAccountBody,
  createStudentBody,
  updateAccountBody,
  type ErrorCode,
  type UpdateAccountBody,
} from '@tp/shared'
import { ApiError, unwrap } from '@/lib/api/errors'
import { getApi } from '@/lib/api/server'
import { NO_TEACHER } from '../roster/constants'
import type { NewAccountState } from './action-state'

/** Every list that shows a name or an address. */
function refreshAccounts() {
  revalidatePath('/admin')
  revalidatePath('/admin/teachers')
  revalidatePath('/admin/students')
  revalidatePath('/admin/settings')
}

/**
 * Two fields in, one password out. The API decides the role from the endpoint that was
 * called, never from anything a form could carry — which is what keeps "add a student"
 * from being a way to mint an administrator.
 */
async function create(
  formData: FormData,
  call: (body: {
    email: string
    fullName: string
  }) => Promise<{ email: string; temporaryPassword: string }>,
): Promise<NewAccountState> {
  const parsed = createAccountBody.safeParse({
    email: formData.get('email'),
    fullName: formData.get('fullName'),
  })

  if (!parsed.success) return { error: 'validation_failed', created: null }

  try {
    return { error: null, created: await call(parsed.data) }
  } catch (error) {
    if (error instanceof ApiError) return { error: error.code, created: null }

    throw error
  }
}

export async function createTeacher(formData: FormData): Promise<NewAccountState> {
  return create(formData, async (json) => {
    const api = await getApi()
    const teacher = await unwrap(await api.v1.admin.teachers.$post({ json }))

    revalidatePath('/admin/teachers')
    revalidatePath('/admin')

    return { email: teacher.email, temporaryPassword: teacher.temporaryPassword }
  })
}

export async function createStudent(formData: FormData): Promise<NewAccountState> {
  // The teacher is this form's own extra, so it is read here rather than by the shared
  // step — and the "nobody yet" choice is simply left out of what is sent.
  const teacher = formData.get('teacherId')
  const teacherId = createStudentBody.shape.teacherId.safeParse(
    typeof teacher === 'string' && teacher && teacher !== NO_TEACHER ? teacher : undefined,
  )
  if (!teacherId.success) return { error: 'validation_failed', created: null }

  return create(formData, async (json) => {
    const api = await getApi()
    const student = await unwrap(
      await api.v1.admin.students.$post({ json: { ...json, teacherId: teacherId.data } }),
    )

    // Linking changes what the teacher's page says too.
    revalidatePath('/admin/students')
    revalidatePath('/admin')
    revalidatePath('/admin/teachers')

    return { email: student.email, temporaryPassword: student.temporaryPassword }
  })
}

/**
 * A fresh password for somebody who has lost theirs. Comes back in the same shape as a
 * new account, because it is shown the same way: once.
 */
export async function resetPassword(accountId: string): Promise<NewAccountState> {
  const parsed = accountIdParam.safeParse({ accountId })
  if (!parsed.success) return { error: 'validation_failed', created: null }

  try {
    const api = await getApi()
    const account = await unwrap(
      await api.v1.admin.accounts[':accountId'].password.$post({ param: parsed.data }),
    )

    return {
      error: null,
      created: { email: account.email, temporaryPassword: account.temporaryPassword },
    }
  } catch (error) {
    if (error instanceof ApiError) return { error: error.code, created: null }

    throw error
  }
}

export async function updateAccount(
  accountId: string,
  patch: UpdateAccountBody,
): Promise<{ error: ErrorCode | null }> {
  const params = accountIdParam.safeParse({ accountId })
  const body = updateAccountBody.safeParse(patch)

  if (!params.success || !body.success) return { error: 'validation_failed' }

  try {
    const api = await getApi()
    await unwrap(
      await api.v1.admin.accounts[':accountId'].$patch({ param: params.data, json: body.data }),
    )

    refreshAccounts()

    return { error: null }
  } catch (error) {
    if (error instanceof ApiError) return { error: error.code }

    throw error
  }
}
