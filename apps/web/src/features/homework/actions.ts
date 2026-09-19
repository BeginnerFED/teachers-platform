'use server'

import { revalidatePath } from 'next/cache'
import {
  assignmentIdParam,
  createAssignmentsBody,
  gradeAssignmentBody,
  requestAssignmentRevisionBody,
  saveProgressBody,
  type AssignmentDetail,
  type AiLimitDetails,
  type CreateAssignmentsBody,
  type GradeAssignmentBody,
  type HomeworkFeedbackSuggestion,
  type Level,
  type RequestAssignmentRevisionBody,
  type StepCheckResult,
} from '@tp/shared'
import { ApiError, unwrap, unwrapPage } from '@/lib/api/errors'
import { getApi } from '@/lib/api/server'
import { readAiActionFailure } from '@/features/ai/server'

/** Both lists change together: what a teacher set is what a student has. */
function refreshHomework() {
  revalidatePath('/dashboard')
  revalidatePath('/homework', 'layout')
  revalidatePath('/student', 'layout')
}

export type LessonOption = {
  id: string
  title: string
  level: Level
  stepCount: number
}

/**
 * Lessons to give, for the picker on the homework desk. What the library would show for
 * the same search — the official shelf and the teacher's own, no bin — and capped, because
 * a picker is for finding one lesson, not for browsing.
 */
export async function loadLessonOptions(query: string): Promise<LessonOption[]> {
  const api = await getApi()
  const term = query.trim()

  const { data } = await unwrapPage(
    await api.v1.materials.$get({
      query: {
        page: '1',
        perPage: '8',
        scope: 'all',
        deleted: 'false',
        ...(term ? { query: term } : {}),
      },
    }),
  )

  return data.map((material) => ({
    id: material.id,
    title: material.title,
    level: material.level,
    stepCount: material.stepCount,
  }))
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
): Promise<{
  result: StepCheckResult | null
  answers?: Record<string, unknown>
  error: string | null
}> {
  const params = assignmentIdParam.safeParse({ assignmentId })
  const body = saveProgressBody.safeParse({ stepId, answers, checked })

  if (!params.success || !body.success) return { result: null, error: 'validation_failed' }

  try {
    const api = await getApi()
    const { result, answers: savedAnswers } = await unwrap(
      await api.v1.assignments[':assignmentId'].progress.$post({
        param: params.data,
        json: body.data,
      }),
    )

    return { result, answers: savedAnswers, error: null }
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

export async function requestAssignmentRevision(
  assignmentId: string,
  input: RequestAssignmentRevisionBody,
): Promise<{ assignment: AssignmentDetail | null; error: string | null }> {
  const params = assignmentIdParam.safeParse({ assignmentId })
  const body = requestAssignmentRevisionBody.safeParse(input)

  if (!params.success || !body.success) return { assignment: null, error: 'validation_failed' }

  try {
    const api = await getApi()
    const assignment = await unwrap(
      await api.v1.assignments[':assignmentId']['request-revision'].$post({
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

/**
 * Ask for an editable second opinion. The API re-reads the assignment and authorizes its
 * original teacher; this action sends only the opaque assignment id and never persists.
 */
export async function suggestHomeworkFeedback(assignmentId: string): Promise<{
  suggestion: HomeworkFeedbackSuggestion | null
  error: string | null
  limit: AiLimitDetails | null
}> {
  const params = assignmentIdParam.safeParse({ assignmentId })
  if (!params.success) return { suggestion: null, error: 'validation_failed', limit: null }

  try {
    const api = await getApi()
    const suggestion = await unwrap(
      await api.v1.assignments[':assignmentId']['ai-feedback'].$post({ param: params.data }),
    )

    return { suggestion, error: null, limit: null }
  } catch (error) {
    const failure = readAiActionFailure(error)
    if (failure) return { suggestion: null, ...failure }

    throw error
  }
}
