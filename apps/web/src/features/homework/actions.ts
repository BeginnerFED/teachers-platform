'use server'

import { revalidatePath } from 'next/cache'
import {
  assignmentIdParam,
  createAssignmentsBody,
  gradeAssignmentBody,
  saveProgressBody,
  type AssignmentDetail,
  type CreateAssignmentsBody,
  type GradeAssignmentBody,
  type StepCheckResult,
} from '@tp/shared'
import { ApiError, unwrap } from '@/lib/api/errors'
import { getApi } from '@/lib/api/server'

/** Both lists change together: what a teacher set is what a student has. */
function refreshHomework() {
  revalidatePath('/homework', 'layout')
  revalidatePath('/student', 'layout')
}

/** One lesson to several students, each getting their own copy. */
export async function assignMaterial(
  body: CreateAssignmentsBody,
): Promise<{ created: number; skipped: number; error: string | null }> {
  const parsed = createAssignmentsBody.safeParse(body)
  if (!parsed.success) return { created: 0, skipped: 0, error: 'validation_failed' }

  try {
    const api = await getApi()
    const result = await unwrap(await api.v1.assignments.$post({ json: parsed.data }))

    refreshHomework()

    return { created: result.created.length, skipped: result.skipped.length, error: null }
  } catch (error) {
    if (error instanceof ApiError) return { created: 0, skipped: 0, error: error.code }

    throw error
  }
}

export async function withdrawAssignment(assignmentId: string): Promise<{ error: string | null }> {
  const params = assignmentIdParam.safeParse({ assignmentId })
  if (!params.success) return { error: 'validation_failed' }

  try {
    const api = await getApi()
    await unwrap(await api.v1.assignments[':assignmentId'].$delete({ param: params.data }))

    refreshHomework()

    return { error: null }
  } catch (error) {
    if (error instanceof ApiError) return { error: error.code }

    throw error
  }
}

/**
 * A student's answers to one step, as they go. With `checked` the step is marked and the
 * marks come back — the same round trip the library's check makes, plus a memory.
 */
export async function saveProgress(
  assignmentId: string,
  stepId: string,
  answers: Record<string, unknown>,
  checked: boolean,
): Promise<{ result: StepCheckResult | null; error: string | null }> {
  const params = assignmentIdParam.safeParse({ assignmentId })
  const body = saveProgressBody.safeParse({ stepId, answers, checked })

  if (!params.success || !body.success) return { result: null, error: 'validation_failed' }

  try {
    const api = await getApi()
    const { result } = await unwrap(
      await api.v1.assignments[':assignmentId'].progress.$post({
        param: params.data,
        json: body.data,
      }),
    )

    return { result, error: null }
  } catch (error) {
    if (error instanceof ApiError) return { result: null, error: error.code }

    throw error
  }
}

export async function submitAssignment(
  assignmentId: string,
): Promise<{ assignment: AssignmentDetail | null; error: string | null }> {
  const params = assignmentIdParam.safeParse({ assignmentId })
  if (!params.success) return { assignment: null, error: 'validation_failed' }

  try {
    const api = await getApi()
    const assignment = await unwrap(
      await api.v1.assignments[':assignmentId'].submit.$post({ param: params.data }),
    )

    refreshHomework()

    return { assignment, error: null }
  } catch (error) {
    if (error instanceof ApiError) return { assignment: null, error: error.code }

    throw error
  }
}

export async function gradeAssignment(
  assignmentId: string,
  patch: GradeAssignmentBody,
): Promise<{ assignment: AssignmentDetail | null; error: string | null }> {
  const params = assignmentIdParam.safeParse({ assignmentId })
  const body = gradeAssignmentBody.safeParse(patch)

  if (!params.success || !body.success) return { assignment: null, error: 'validation_failed' }

  try {
    const api = await getApi()
    const assignment = await unwrap(
      await api.v1.assignments[':assignmentId'].grade.$post({
        param: params.data,
        json: body.data,
      }),
    )

    refreshHomework()

    return { assignment, error: null }
  } catch (error) {
    if (error instanceof ApiError) return { assignment: null, error: error.code }

    throw error
  }
}
