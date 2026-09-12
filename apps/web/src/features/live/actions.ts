'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import {
  applyLiveOpsBody,
  gatherLiveBody,
  liveCheckBody,
  liveSessionIdParam,
  setLiveStepBody,
  startLiveSessionBody,
  type BoardOp,
  type LiveSnapshot,
  type LiveSession,
  type ErrorCode,
  type StartLiveSessionBody,
  type StepCheckResult,
  liveInvitationResponseBody,
  readLiveInvitationsBody,
} from '@tp/shared'
import { ApiError, unwrap } from '@/lib/api/errors'
import { getApi, getPublicApi } from '@/lib/api/server'

function refreshLivePages() {
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/live')
  revalidatePath('/dashboard/calendar')
  revalidatePath('/admin/calendar')
  revalidatePath('/admin')
  revalidatePath('/student', 'layout')
}

export async function launchLive(
  materialId: string,
  expectedActiveSessionId: string | null,
  studentIds?: string[],
  calendar?: Pick<StartLiveSessionBody, 'lessonId' | 'expectedLessonUpdatedAt' | 'newLesson'>,
): Promise<{ data: LiveSession | null; error: ErrorCode | 'lesson_time_conflict' | null }> {
  const parsed = startLiveSessionBody.safeParse({
    materialId,
    expectedActiveSessionId,
    studentIds,
    ...calendar,
  })
  if (!parsed.success) return { data: null, error: 'validation_failed' }
  try {
    const api = await getApi()
    const data = await unwrap(await api.v1.live.$post({ json: parsed.data }))
    refreshLivePages()
    return { data, error: null }
  } catch (error) {
    if (error instanceof ApiError) {
      const details = error.details
      const timeConflict =
        error.code === 'conflict' &&
        typeof details === 'object' &&
        details !== null &&
        'reason' in details &&
        details.reason === 'lesson_time_conflict'
      return { data: null, error: timeConflict ? 'lesson_time_conflict' : error.code }
    }
    throw error
  }
}

export async function respondToLiveInvitation(
  sessionId: string,
  response: 'joined' | 'declined',
): Promise<{ error: ErrorCode | null }> {
  const param = liveSessionIdParam.safeParse({ sessionId })
  const body = liveInvitationResponseBody.safeParse({ response })
  if (!param.success || !body.success) return { error: 'validation_failed' }
  try {
    const api = await getApi()
    await unwrap(
      await api.v1.live.invitations[':sessionId'].respond.$post({
        param: param.data,
        json: body.data,
      }),
    )
    return { error: null }
  } catch (error) {
    if (error instanceof ApiError) return { error: error.code }
    throw error
  }
}

export async function readLiveInvitations(
  sessionIds: string[],
): Promise<{ error: ErrorCode | null }> {
  const body = readLiveInvitationsBody.safeParse({ sessionIds })
  if (!body.success) return { error: 'validation_failed' }
  try {
    const api = await getApi()
    await unwrap(await api.v1.live.invitations.read.$post({ json: body.data }))
    return { error: null }
  } catch (error) {
    if (error instanceof ApiError) return { error: error.code }
    throw error
  }
}

/** Opens the room and walks the teacher into it. */
export async function startLive(materialId: string): Promise<{ error: string | null }> {
  const parsed = startLiveSessionBody.safeParse({ materialId })
  if (!parsed.success) return { error: 'validation_failed' }

  let sessionId: string

  try {
    const api = await getApi()
    const session = await unwrap(await api.v1.live.$post({ json: parsed.data }))
    sessionId = session.id
  } catch (error) {
    if (error instanceof ApiError) return { error: error.code }

    throw error
  }

  refreshLivePages()
  redirect(`/live/${sessionId}`)
}

/** The host moved. The API remembers it and tells the room. */
export async function setLiveStep(
  sessionId: string,
  stepId: string,
): Promise<{ error: string | null }> {
  const params = liveSessionIdParam.safeParse({ sessionId })
  const body = setLiveStepBody.safeParse({ stepId })

  if (!params.success || !body.success) return { error: 'validation_failed' }

  try {
    const api = await getApi()
    await unwrap(
      await api.v1.live[':sessionId'].step.$post({ param: params.data, json: body.data }),
    )

    return { error: null }
  } catch (error) {
    if (error instanceof ApiError) return { error: error.code }

    throw error
  }
}

/** The host calls everyone to a step. Lands on the board, so it comes to everyone the same way. */
export async function gatherLive(
  sessionId: string,
  stepId: string,
): Promise<{ error: string | null }> {
  const params = liveSessionIdParam.safeParse({ sessionId })
  const body = gatherLiveBody.safeParse({ stepId })

  if (!params.success || !body.success) return { error: 'validation_failed' }

  try {
    const api = await getApi()
    await unwrap(
      await api.v1.live[':sessionId'].gather.$post({ param: params.data, json: body.data }),
    )

    return { error: null }
  } catch (error) {
    if (error instanceof ApiError) return { error: error.code }

    throw error
  }
}

export async function endLive(
  sessionId: string,
): Promise<{ error: string | null; calendarLesson?: LiveSession['calendarLesson'] }> {
  const params = liveSessionIdParam.safeParse({ sessionId })
  if (!params.success) return { error: 'validation_failed' }

  try {
    const api = await getApi()
    const data = await unwrap(await api.v1.live[':sessionId'].end.$post({ param: params.data }))
    refreshLivePages()

    return { error: null, calendarLesson: data.calendarLesson }
  } catch (error) {
    if (error instanceof ApiError) return { error: error.code }

    throw error
  }
}

/* ------------------------------------------------- for whoever holds the link --- */

/**
 * The room, whole, as the database has it right now. Asked for on entry, on every
 * reconnect, and whenever a browser notices a version it did not expect.
 */
export async function fetchLiveSnapshot(sessionId: string): Promise<LiveSnapshot | null> {
  const params = liveSessionIdParam.safeParse({ sessionId })
  if (!params.success) return null

  try {
    const api = getPublicApi()

    return await unwrap(
      await api.v1.live.public[':sessionId'].snapshot.$get({ param: params.data }),
    )
  } catch (error) {
    if (error instanceof ApiError) return null

    throw error
  }
}

/**
 * Writes a gesture to the shared board. The API applies it, bumps the version and tells
 * the room; the browser that made it has already drawn it and only needs to know it
 * landed — or that it did not.
 */
export async function applyLiveOps(
  sessionId: string,
  ops: BoardOp[],
  from?: string,
): Promise<{ snapshot: LiveSnapshot | null; error: string | null }> {
  const params = liveSessionIdParam.safeParse({ sessionId })
  const body = applyLiveOpsBody.safeParse({ ops, from })

  if (!params.success || !body.success) return { snapshot: null, error: 'validation_failed' }

  try {
    const api = getPublicApi()
    const snapshot = await unwrap(
      await api.v1.live.public[':sessionId'].ops.$post({ param: params.data, json: body.data }),
    )

    return { snapshot, error: null }
  } catch (error) {
    if (error instanceof ApiError) return { snapshot: null, error: error.code }

    throw error
  }
}

/**
 * Marks a step for the whole room — the host's call, since it locks everybody's answers.
 * The marks are written to the board, so every browser learns of them the same way, over
 * the channel.
 */
export async function checkLiveStep(
  sessionId: string,
  stepId: string,
  answers: Record<string, unknown>,
): Promise<{ result: StepCheckResult | null; error: string | null }> {
  const params = liveSessionIdParam.safeParse({ sessionId })
  const body = liveCheckBody.safeParse({ stepId, answers })

  if (!params.success || !body.success) return { result: null, error: 'validation_failed' }

  try {
    const api = await getApi()
    const result = await unwrap(
      await api.v1.live[':sessionId'].check.$post({ param: params.data, json: body.data }),
    )

    return { result, error: null }
  } catch (error) {
    if (error instanceof ApiError) return { result: null, error: error.code }

    throw error
  }
}
