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

export type SubscriptionEventRow = {
  id: string
  type: Enums<'subscription_event_type'>
  payload: Json
  created_at: string
  actor: { id: string; full_name: string | null; email: string } | null
}

export type SubscriptionEventsRepository = {
  record(input: SubscriptionEventInput): Promise<void>
  listByProfileId(profileId: string, limit: number): Promise<SubscriptionEventRow[]>
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

  async listByProfileId(profileId, limit) {
    // The actor is embedded through the actor_id foreign key. It is nullable, so a
    // system-recorded event comes back with actor null rather than being dropped.
    const { data, error } = await supabaseAdmin
      .from('subscription_events')
      .select('id,type,payload,created_at,actor:profiles!subscription_events_actor_id_fkey(id,full_name,email)')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false })
      .limit(limit)
      .returns<SubscriptionEventRow[]>()

    if (error) throwFromPostgrest(error, 'list subscription events')

    return data ?? []
  },
}
