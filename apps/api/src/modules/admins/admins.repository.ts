import type { Tables } from '@tp/shared'
import { InternalError } from '../../http/errors'
import { supabaseAdmin } from '../../lib/supabase/admin'
import { throwFromAuth, throwFromPostgrest } from '../../lib/supabase/errors'

export type AdminProfileRow = Pick<Tables<'profiles'>, 'id' | 'email' | 'full_name' | 'created_at'>

/** Whether an invited account has ever actually been used. */
export type AdminAuthInfo = { lastSignInAt: string | null }

/**
 * What a demotion came to. Every refusal is decided by the database at the moment of the
 * write, because a check made a round trip earlier is exactly the gap two administrators
 * removing each other at once slip through. `forbidden` means the actor lost the role
 * itself while the request was on its way.
 */
export type DemotionOutcome = 'demoted' | 'not_found' | 'not_admin' | 'forbidden' | 'last_admin'

const DEMOTION_OUTCOMES: readonly DemotionOutcome[] = [
  'demoted',
  'not_found',
  'not_admin',
  'forbidden',
  'last_admin',
]

export type AdminsRepository = {
  listProfiles(): Promise<AdminProfileRow[]>
  getAuthInfo(id: string): Promise<AdminAuthInfo | null>
  /** Makes an administrator a teacher, unless that would leave the platform without one. */
  demote(id: string, actorId: string): Promise<DemotionOutcome>
}

const COLUMNS = 'id,email,full_name,created_at'

function isDemotionOutcome(value: unknown): value is DemotionOutcome {
  return DEMOTION_OUTCOMES.includes(value as DemotionOutcome)
}

export const adminsRepository: AdminsRepository = {
  async listProfiles() {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select(COLUMNS)
      .eq('role', 'admin')
      .order('created_at', { ascending: true })

    if (error) throwFromPostgrest(error, 'list admins')

    return data ?? []
  },

  async getAuthInfo(id) {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(id)

    // A profile without an auth user should be impossible — the foreign key cascades —
    // so this is reported as absent rather than raised, and the list stays renderable.
    if (error) return null

    return { lastSignInAt: data.user.last_sign_in_at ?? null }
  },

  async demote(id, actorId) {
    // One statement decides and writes, under a lock on every administrator row: the
    // last administrator keeps the role however the requests interleave.
    const { data, error } = await supabaseAdmin.rpc('demote_admin', {
      p_admin: id,
      p_actor: actorId,
    })

    if (error) throwFromPostgrest(error, 'demote admin')
    if (!isDemotionOutcome(data)) throw new InternalError('Demotion returned an unknown outcome')
    if (data !== 'demoted') return data

    // app_metadata is kept in step with the profile so that re-reading it later, or
    // recreating a profile from auth, does not resurrect a role that was taken away.
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, {
      app_metadata: { role: 'teacher' },
    })

    if (authError) throwFromAuth(authError, 'demote admin')

    return data
  },
}
