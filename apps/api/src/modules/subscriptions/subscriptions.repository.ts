import type { Enums, Tables } from '@tp/shared'
import { supabaseAdmin } from '../../lib/supabase/admin'
import { throwFromPostgrest } from '../../lib/supabase/errors'

export type SubscriptionRow = Tables<'subscriptions'>

export type SubscriptionPatch = {
  status?: Enums<'subscription_status'>
  current_period_end?: string | null
}

export type SubscriptionsRepository = {
  findByProfileId(profileId: string): Promise<SubscriptionRow | null>
  create(input: { profileId: string; trialEndsAt: string }): Promise<SubscriptionRow>
  /** Returns null when nothing matched, which means somebody else changed the row first. */
  updateIfUnchanged(input: {
    profileId: string
    expectedUpdatedAt: string
    patch: SubscriptionPatch
  }): Promise<SubscriptionRow | null>
}

export const subscriptionsRepository: SubscriptionsRepository = {
  async findByProfileId(profileId) {
    const { data, error } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('profile_id', profileId)
      .maybeSingle()

    if (error) throwFromPostgrest(error, 'find subscription')

    return data
  },

  async create({ profileId, trialEndsAt }) {
    const { data, error } = await supabaseAdmin
      .from('subscriptions')
      .insert({ profile_id: profileId, status: 'trialing', trial_ends_at: trialEndsAt })
      .select('*')
      .single()

    if (error) throwFromPostgrest(error, 'create subscription')

    return data
  },

  async updateIfUnchanged({ profileId, expectedUpdatedAt, patch }) {
    // Matching on updated_at makes this an optimistic lock: a row somebody else has
    // already touched simply does not match, so a double-clicked "extend" cannot hand
    // out two months. The column is maintained by an existing BEFORE UPDATE trigger.
    const { data, error } = await supabaseAdmin
      .from('subscriptions')
      .update(patch)
      .eq('profile_id', profileId)
      .eq('updated_at', expectedUpdatedAt)
      .select('*')
      .maybeSingle()

    if (error) throwFromPostgrest(error, 'update subscription')

    return data
  },
}
