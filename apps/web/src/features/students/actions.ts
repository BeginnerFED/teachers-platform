'use server'

import { studentIdParam, type StudentDetail } from '@tp/shared'
import { ApiError, unwrap } from '@/lib/api/errors'
import { getApi } from '@/lib/api/server'

/**
 * Fetched when the detail panel opens rather than with the list, because past teachers
 * are only ever wanted for one student at a time and loading them for every row would be
 * a query per row for data nobody asked to see.
 */
export async function loadStudentDetail(
  studentId: string,
): Promise<{ data: StudentDetail } | { error: true }> {
  const parsed = studentIdParam.safeParse({ studentId })
  if (!parsed.success) return { error: true }

  try {
    const api = await getApi()
    const data = await unwrap(
      await api.v1.admin.students[':studentId'].$get({
        param: { studentId: parsed.data.studentId },
      }),
    )

    return { data }
  } catch (error) {
    if (error instanceof ApiError) return { error: true }

    throw error
  }
}
