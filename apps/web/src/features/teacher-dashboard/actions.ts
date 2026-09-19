'use server'

import {
  lessonStudentParam,
  listAssignmentsQuery,
  type AssignmentListItem,
  type AssignmentsSummary,
  type ErrorCode,
  type LessonCreditSummary,
} from '@tp/shared'
import { listAssignments, summariseAssignments } from '@/features/homework/api'
import { ApiError, unwrap } from '@/lib/api/errors'
import { getApi } from '@/lib/api/server'

export type StudentProgressSummary = {
  credits: LessonCreditSummary
  homework: AssignmentsSummary
  recentHomework: AssignmentListItem[]
}

type Result = { data: StudentProgressSummary; error: null } | { data: null; error: ErrorCode }

/** One teacher-scoped snapshot for the existing student drawer. */
export async function loadStudentProgress(studentId: string): Promise<Result> {
  const param = lessonStudentParam.safeParse({ studentId })
  if (!param.success) return { data: null, error: 'validation_failed' }

  try {
    const api = await getApi()
    const [credits, homework, recent] = await Promise.all([
      unwrap(
        await api.v1.me.students[':studentId']['lesson-credits'].$get(
          { param: param.data },
          { init: { cache: 'no-store' } },
        ),
      ),
      summariseAssignments({ studentId: param.data.studentId }),
      listAssignments(
        listAssignmentsQuery.parse({ studentId: param.data.studentId, page: 1, perPage: 5 }),
      ),
    ])

    return {
      data: { credits, homework, recentHomework: recent.data },
      error: null,
    }
  } catch (error) {
    return {
      data: null,
      error: error instanceof ApiError ? error.code : 'upstream_unavailable',
    }
  }
}
