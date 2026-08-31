import type { Enums, Json } from '@tp/shared'
import { supabaseAdmin } from '../../lib/supabase/admin'
import { throwFromPostgrest } from '../../lib/supabase/errors'

export type SubscriptionEventInput = {
  profileId: string
  /** Null for anything the system did on its own, such as opening a trial at signup. */
  actorId: string | null
  type: Enums<'subscription_event_type'>
  payload?: Json
}

export type SubscriptionEventsRepository = {
  record(input: SubscriptionEventInput): Promise<void>
}

export const subscriptionEventsRepository: SubscriptionEventsRepository = {
  async record({ profileId, actorId, type, payload }) {
    const { error } = await supabaseAdmin.from('subscription_events').insert({
      profile_id: profileId,
      actor_id: actorId,
      type,
      payload: payload ?? {},
    })

    if (error) throwFromPostgrest(error, 'record subscription event')
  },
}
