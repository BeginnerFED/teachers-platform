import type { AiUsageKind, Enums } from '@tp/shared'
import { InternalError } from '../../http/errors'
import { supabaseAdmin } from '../../lib/supabase/admin'
import { throwFromPostgrest } from '../../lib/supabase/errors'

export type AiQuotaDecision = {
  reservationId: string | null
  granted: boolean
  reason: 'user_daily_call_limit' | 'platform_daily_unit_limit' | null
  usageDate: string
  resetAt: string
  requestedUnits: number
  userCalls: number
  userCallLimit: number
  platformUnits: number
  platformUnitLimit: number
}

export type AiQuotaUsage = {
  usageDate: string
  resetAt: string
  lessonDraftCalls: number
  lessonDraftCallLimit: number
  homeworkFeedbackCalls: number
  homeworkFeedbackCallLimit: number
  platformUnits: number
  platformUnitLimit: number
}

export type AiQuotaSettlement = {
  /** Exact provider usage when Workers AI returned it; otherwise keep the reservation estimate. */
  actualUnits?: number
  /** A failed product action must not consume the teacher's daily feature call. */
  refundCall: boolean
  /** Release shared capacity only when the provider definitely did not accept billable work. */
  releaseUnits: boolean
}

export type AiQuotaRepository = {
  reserve(profileId: string, kind: AiUsageKind): Promise<AiQuotaDecision>
  settle(reservationId: string, profileId: string, settlement: AiQuotaSettlement): Promise<boolean>
  getStatus(profileId: string): Promise<AiQuotaUsage>
}

function quotaReason(reason: string | null): AiQuotaDecision['reason'] {
  if (
    reason === null ||
    reason === 'user_daily_call_limit' ||
    reason === 'platform_daily_unit_limit'
  ) {
    return reason
  }

  throw new InternalError('AI quota returned an unknown limit reason')
}

export const aiQuotaRepository: AiQuotaRepository = {
  async reserve(profileId, kind) {
    const { data, error } = await supabaseAdmin.rpc('reserve_ai_usage', {
      p_profile: profileId,
      p_kind: kind as Enums<'ai_usage_kind'>,
    })

    if (error) throwFromPostgrest(error, 'reserve AI usage')

    const row = data?.[0]
    if (!row) throw new InternalError('AI quota returned no decision')

    return {
      reservationId: row.reservation_id,
      granted: row.granted,
      reason: quotaReason(row.reason),
      usageDate: row.usage_date,
      resetAt: row.reset_at,
      requestedUnits: row.requested_units,
      userCalls: row.user_calls,
      userCallLimit: row.user_call_limit,
      platformUnits: row.platform_units,
      platformUnitLimit: row.platform_unit_limit,
    }
  },

  async settle(reservationId, profileId, settlement) {
    const { data, error } = await supabaseAdmin.rpc('settle_ai_usage', {
      p_reservation: reservationId,
      p_profile: profileId,
      p_units: settlement.actualUnits ?? null,
      p_refund_call: settlement.refundCall,
      p_release_units: settlement.releaseUnits,
    })

    if (error) throwFromPostgrest(error, 'settle AI usage')

    return data
  },

  async getStatus(profileId) {
    const { data, error } = await supabaseAdmin.rpc('get_ai_usage_status', {
      p_profile: profileId,
    })

    if (error) throwFromPostgrest(error, 'get AI usage status')

    const row = data?.[0]
    if (!row) throw new InternalError('AI quota returned no usage status')

    return {
      usageDate: row.usage_date,
      resetAt: row.reset_at,
      lessonDraftCalls: row.lesson_draft_calls,
      lessonDraftCallLimit: row.lesson_draft_call_limit,
      homeworkFeedbackCalls: row.homework_feedback_calls,
      homeworkFeedbackCallLimit: row.homework_feedback_call_limit,
      platformUnits: row.platform_units,
      platformUnitLimit: row.platform_unit_limit,
    }
  },
}
