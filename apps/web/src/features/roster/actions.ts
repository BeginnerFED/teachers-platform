'use server'

import { revalidatePath } from 'next/cache'
import { teacherIdParam, teacherStudentParam } from '@tp/shared'
import { ApiError, unwrap, unwrapPage } from '@/lib/api/errors'
import { getApi } from '@/lib/api/server'

/** Somebody who can be picked: enough to recognise them in a list, nothing more. */
export type Person = { id: string; fullName: string | null; email: string }

/** Both lists show who works with whom, so both go stale together. */
function refreshRoster() {
  revalidatePath('/admin')
  revalidatePath('/admin/teachers')
  revalidatePath('/admin/students')
}

/**
 * The picker's search. Goes to the same list endpoint the page uses, so what it finds is
 * what the page would show — and capped, because a picker is for finding one person, not
 * for reading a directory.
 */
export async function loadTeacherOptions(query: string): Promise<Person[]> {
  const api = await getApi()
  const term = query.trim()

  const { data } = await unwrapPage(
    await api.v1.admin.teachers.$get({
      query: { page: '1', perPage: '50', ...(term ? { query: term } : {}) },
    }),
  )

  return data.map((teacher) => ({
    id: teacher.id,
    fullName: teacher.fullName,
    email: teacher.email,
  }))
}

export async function loadStudentOptions(query: string): Promise<Person[]> {
  const api = await getApi()
  const term = query.trim()

  const { data } = await unwrapPage(
    await api.v1.admin.students.$get({
      query: { page: '1', perPage: '50', ...(term ? { query: term } : {}) },
    }),
  )

  return data.map((student) => ({
    id: student.id,
    fullName: student.fullName,
    email: student.email,
  }))
}

export async function linkStudent(
  teacherId: string,
  studentId: string,
): Promise<{ error: string | null }> {
  const param = teacherIdParam.safeParse({ teacherId })
  const body = teacherStudentParam.shape.studentId.safeParse(studentId)

  if (!param.success || !body.success) return { error: 'validation_failed' }

  try {
    const api = await getApi()
    await unwrap(
      await api.v1.admin.teachers[':teacherId'].students.$post({
        param: param.data,
        json: { studentId: body.data },
      }),
    )

    refreshRoster()

    return { error: null }
  } catch (error) {
    if (error instanceof ApiError) return { error: error.code }

    throw error
  }
}

export async function unlinkStudent(
  teacherId: string,
  studentId: string,
): Promise<{ error: string | null }> {
  const parsed = teacherStudentParam.safeParse({ teacherId, studentId })
  if (!parsed.success) return { error: 'validation_failed' }

  try {
    const api = await getApi()
    await unwrap(
      await api.v1.admin.teachers[':teacherId'].students[':studentId'].$delete({
        param: parsed.data,
      }),
    )

    refreshRoster()

    return { error: null }
  } catch (error) {
    if (error instanceof ApiError) return { error: error.code }

    throw error
  }
}
