import type { Enums, Tables } from '@tp/shared'
import { supabaseAdmin } from '../../lib/supabase/admin'
import { throwFromAuth, throwFromPostgrest } from '../../lib/supabase/errors'

export type AdminProfileRow = Pick<Tables<'profiles'>, 'id' | 'email' | 'full_name' | 'created_at'>

/** Whether an invited account has ever actually been used. */
export type AdminAuthInfo = { lastSignInAt: string | null }

export type AdminsRepository = {
  listProfiles(): Promise<AdminProfileRow[]>
  findRoleById(id: string): Promise<Enums<'user_role'> | null>
  getAuthInfo(id: string): Promise<AdminAuthInfo | null>
  setRole(id: string, role: Enums<'user_role'>): Promise<void>
}

const COLUMNS = 'id,email,full_name,created_at'

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

  async findRoleById(id) {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', id)
      .maybeSingle()

    if (error) throwFromPostgrest(error, 'find admin')

    return data?.role ?? null
  },

  async getAuthInfo(id) {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(id)

    // A profile without an auth user should be impossible — the foreign key cascades —
    // so this is reported as absent rather than raised, and the list stays renderable.
    if (error) return null

    return { lastSignInAt: data.user.last_sign_in_at ?? null }
  },

  async setRole(id, role) {
    const { error } = await supabaseAdmin.from('profiles').update({ role }).eq('id', id)

    if (error) throwFromPostgrest(error, 'change role')

    // app_metadata is kept in step with the profile so that re-reading it later, or
    // recreating a profile from auth, does not resurrect a role that was taken away.
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, {
      app_metadata: { role },
    })

    if (authError) throwFromAuth(authError, 'change role')
  },
}
