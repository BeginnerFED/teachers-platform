import {
  aiQuotaExceededDetailsSchema,
  aiUsageStatusSchema,
  type AiQuotaExceededDetails,
  type AiUsageKind,
  type AiUsageStatus,
} from '@tp/shared'
import { AppError, InternalError, TooManyRequestsError } from '../../http/errors'
import { logger } from '../../lib/logger'
import {
  aiQuotaRepository,
  type AiQuotaDecision,
  type AiQuotaRepository,
} from './ai-quota.repository'

export type AiQuotaService = {
  getStatus(profileId: string): Promise<AiUsageStatus>
  withReservation<T>(
    profileId: string,
    kind: AiUsageKind,
    operation: (tracker: AiQuotaTracker) => Promise<T>,
  ): Promise<T>
}

export type AiQuotaTracker = {
  markProviderAttempted(): void
  reportUsage(neurons: number): void
}

function isProviderRateLimit(error: unknown): boolean {
  if (!(error instanceof AppError) || error.code !== 'too_many_requests') return false
  if (error.details === null || typeof error.details !== 'object') return false

  return (
    'scope' in error.details &&
    error.details.scope === 'provider' &&
    'reason' in error.details &&
    error.details.reason === 'provider_rate_limit'
  )
}

function exceededDetails(kind: AiUsageKind, decision: AiQuotaDecision): AiQuotaExceededDetails {
  const resetAt = new Date(decision.resetAt)
  if (!Number.isFinite(resetAt.getTime())) {
    throw new InternalError('AI quota returned an invalid reset time')
  }

  const counters = {
    kind,
    resetAt: decision.resetAt,
    retryAfterSeconds: Math.max(0, Math.ceil((resetAt.getTime() - Date.now()) / 1_000)),
    requestedUnits: decision.requestedUnits,
    userCalls: decision.userCalls,
    userCallLimit: decision.userCallLimit,
    platformUnits: decision.platformUnits,
    platformUnitLimit: decision.platformUnitLimit,
  }

  const details =
    decision.reason === 'user_daily_call_limit'
      ? { ...counters, scope: 'user', reason: 'user_daily_call_limit' }
      : { ...counters, scope: 'platform', reason: 'platform_daily_unit_limit' }

  const parsed = aiQuotaExceededDetailsSchema.safeParse(details)
  if (!parsed.success) {
    throw new InternalError('AI quota returned invalid limit details', { cause: parsed.error })
  }

  return parsed.data
}

export function createAiQuotaService(repository: AiQuotaRepository): AiQuotaService {
  return {
    async getStatus(profileId) {
      const usage = await repository.getStatus(profileId)

      const parsed = aiUsageStatusSchema.safeParse({
        usageDate: usage.usageDate,
        resetAt: usage.resetAt,
        lessonDraft: {
          used: usage.lessonDraftCalls,
          limit: usage.lessonDraftCallLimit,
          remaining: Math.max(0, usage.lessonDraftCallLimit - usage.lessonDraftCalls),
        },
        homeworkFeedback: {
          used: usage.homeworkFeedbackCalls,
          limit: usage.homeworkFeedbackCallLimit,
          remaining: Math.max(0, usage.homeworkFeedbackCallLimit - usage.homeworkFeedbackCalls),
        },
        platform: {
          usedUnits: usage.platformUnits,
          limitUnits: usage.platformUnitLimit,
          remainingUnits: Math.max(0, usage.platformUnitLimit - usage.platformUnits),
        },
      })

      if (!parsed.success) {
        throw new InternalError('AI quota returned invalid usage status', { cause: parsed.error })
      }

      return parsed.data
    },

    async withReservation(profileId, kind, operation) {
      const decision = await repository.reserve(profileId, kind)

      // A granted reservation always has an id and no rejection reason; a rejected one
      // has the inverse shape. Treat a broken database contract as an internal error so
      // callers are not told to wait for quota that was never actually exhausted.
      if (
        (decision.granted && (!decision.reservationId || decision.reason !== null)) ||
        (!decision.granted && (decision.reservationId !== null || decision.reason === null))
      ) {
        throw new InternalError('AI quota returned an inconsistent decision')
      }

      if (!decision.granted) {
        const userLimit = decision.reason === 'user_daily_call_limit'
        throw new TooManyRequestsError(
          userLimit
            ? 'Your daily limit for this AI feature has been reached'
            : 'The daily AI capacity for the platform has been reached',
          exceededDetails(kind, decision),
        )
      }

      // Narrowing through the invariant above is not preserved for a nullable object
      // property, so keep the proven id in a local before the asynchronous operation.
      const reservationId = decision.reservationId
      if (!reservationId) throw new InternalError('AI quota reservation id is missing')

      let failed = false
      let failure: unknown
      let providerAttempted = false
      let reportedNeurons = 0
      let usageReported = false
      const tracker: AiQuotaTracker = {
        markProviderAttempted: () => {
          providerAttempted = true
        },
        reportUsage: (neurons) => {
          if (Number.isFinite(neurons) && neurons >= 0) {
            reportedNeurons += neurons
            usageReported = true
          }
        },
      }

      try {
        return await operation(tracker)
      } catch (operationError) {
        failed = true
        failure = operationError
        throw operationError
      } finally {
        try {
          // A failed product action never consumes the teacher's personal call. Shared
          // capacity is different: a timeout may have reached Workers AI, so release its
          // estimate only when the provider was never contacted or explicitly returned 429.
          const releaseUnits =
            failed && !usageReported && (!providerAttempted || isProviderRateLimit(failure))
          const settled = await repository.settle(reservationId, profileId, {
            ...(usageReported ? { actualUnits: Math.ceil(reportedNeurons) } : {}),
            refundCall: failed,
            releaseUnits,
          })

          if (!settled) {
            logger.error(
              { reservationId, profileId, kind, failed, releaseUnits },
              'AI quota reservation could not be settled',
            )
          }
        } catch (settlementError) {
          // Settlement is best effort: never replace a useful provider result or error with
          // a quota bookkeeping failure. An unreleased reservation remains conservative.
          logger.error(
            {
              err: settlementError,
              reservationId,
              profileId,
              kind,
              failed,
            },
            'AI quota settlement write failed',
          )
        }
      }
    },
  }
}

export const aiQuotaService = createAiQuotaService(aiQuotaRepository)
