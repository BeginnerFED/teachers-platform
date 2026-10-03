'use server'

import { revalidatePath } from 'next/cache'
import {
  endedLink,
  teacherIdParam,
  teacherStudentParam,
  type EndedLink,
  type ErrorCode,
  type StudentHasTeacher,
} from '@tp/shared'
import { ApiError, unwrap, unwrapPage } from '@/lib/api/errors'
import { getApi } from '@/lib/api/server'

/** Somebody who can be picked: enough to recognise them in a list, nothing more. */
export type Person = {
  id: string
  fullName: string | null
  email: string
  /**
   * For a student who already studies with somebody: that teacher's name. They are shown
   * but cannot be picked, since a student has one teacher at a time.
   */
  teacher?: string | null
}

/** A refused link names the teacher the student is already with. */
export type LinkResult = { error: ErrorCode | 'student_has_teacher' | null; teacher?: string }

/** What ending the link took with it, or why nothing was ended. */
export type EndLinkResult = {
  error: ErrorCode | 'live_lesson_running' | null
  /** Null when the link ended but the answer did not say what it took with it. */
  ended?: EndedLink | null
}

/**
 * Both lists show who works with whom, so both go stale together — and the calendar with
 * them, since ending a link cancels the lessons that were planned under it.
 */
function refreshRoster() {
  revalidatePath('/admin')
  revalidatePath('/admin/teachers')
  revalidatePath('/admin/students')
  revalidatePath('/admin/calendar')
}

/** The reason an API refusal carries, when it carries one. */
function reasonOf(error: ApiError): unknown {
  return (error.details as { reason?: unknown } | null | undefined)?.reason
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

  return data.map((student) => {
    const [teacher] = student.teachers

    return {
      id: student.id,
      fullName: student.fullName,
      email: student.email,
      teacher: teacher ? (teacher.fullName ?? teacher.email) : null,
    }
  })
}

export async function linkStudent(teacherId: string, studentId: string): Promise<LinkResult> {
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
    if (error instanceof ApiError) {
      // Somebody else placed the student first. Said in words, with whose student it is,
      // because "the data changed" would leave the admin guessing what to do about it.
      if (error.code === 'conflict' && reasonOf(error) === 'student_has_teacher') {
        const { teacher } = error.details as StudentHasTeacher

        // The refusal is the proof that the lists on screen are behind, so they catch up as
        // well: the queue stops offering the student, and the rows say who teaches them now.
        refreshRoster()

        return { error: 'student_has_teacher', teacher: teacher.fullName ?? teacher.email }
      }

      return { error: error.code }
    }

    throw error
  }
}

export async function unlinkStudent(teacherId: string, studentId: string): Promise<EndLinkResult> {
  const parsed = teacherStudentParam.safeParse({ teacherId, studentId })
  if (!parsed.success) return { error: 'validation_failed' }

  try {
    const api = await getApi()
    const body = await unwrap(
      await api.v1.admin.teachers[':teacherId'].students[':studentId'].$delete({
        param: parsed.data,
      }),
    )

    refreshRoster()

    // An API from before the counts answers with the teacher's details instead. The link
    // has ended all the same; what it took with it is simply not known here.
    const ended = endedLink.safeParse(body)

    return { error: null, ended: ended.success ? ended.data : null }
  } catch (error) {
    if (error instanceof ApiError) {
      // A room with the student in it is open. It passes once the teacher ends the lesson,
      // which is worth saying, since a plain refusal reads as permanent.
      if (error.code === 'rule_violation' && reasonOf(error) === 'live_lesson_running') {
        return { error: 'live_lesson_running' }
      }

      return { error: error.code }
    }

    throw error
  }
}
