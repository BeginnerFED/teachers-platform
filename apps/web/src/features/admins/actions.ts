'use server'

import { revalidatePath } from 'next/cache'
import { adminIdParam, inviteAdminBody } from '@tp/shared'
import { ApiError, unwrap } from '@/lib/api/errors'
import { getApi } from '@/lib/api/server'
import type { AdminActionState } from './action-state'

export async function inviteAdmin(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const parsed = inviteAdminBody.safeParse({
    email: formData.get('email'),
    fullName: formData.get('fullName'),
  })
  if (!parsed.success) {
    return { error: 'validation_failed', invited: null, removed: false }
  }

  try {
    const api = await getApi()
    const data = await unwrap(await api.v1.admin.admins.$post({ json: parsed.data }))

    revalidatePath('/admin/settings')

    return {
      error: null,
      invited: { email: data.admin.email, temporaryPassword: data.temporaryPassword },
      removed: false,
    }
  } catch (error) {
    if (error instanceof ApiError) return { error: error.code, invited: null, removed: false }

    throw error
  }
}

export async function revokeAdmin(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const parsed = adminIdParam.safeParse({ adminId: formData.get('adminId') })
  if (!parsed.success) return { error: 'validation_failed', invited: null, removed: false }

  try {
    const api = await getApi()
    await unwrap(
      await api.v1.admin.admins[':adminId'].$delete({ param: { adminId: parsed.data.adminId } }),
    )

    // The demoted account becomes a teacher, so it appears in a list on another page.
    revalidatePath('/admin/settings')
    revalidatePath('/admin/teachers')

    return { error: null, invited: null, removed: true }
  } catch (error) {
    if (error instanceof ApiError) return { error: error.code, invited: null, removed: false }

    throw error
  }
}
