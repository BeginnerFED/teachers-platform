import type { Enums, Tables } from '@tp/shared'
import { supabaseAdmin } from '../../lib/supabase/admin'
import { throwFromAuth, throwFromPostgrest } from '../../lib/supabase/errors'

export type AccountProfileRow = Pick<Tables<'profiles'>, 'id' | 'email' | 'full_name'>

export type AccountsRepository = {
  create(input: {
    email: string
    fullName: string
    password: string
    role: Enums<'user_role'>
  }): Promise<string>
  findRoleById(id: string): Promise<Enums<'user_role'> | null>
  setRole(id: string, role: Enums<'user_role'>): Promise<void>
  findProfile(id: string): Promise<AccountProfileRow | null>
}

export const accountsRepository: AccountsRepository = {
  async create({ email, fullName, password, role }) {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      // The address was typed by an administrator who is vouching for it, and the first
      // thing the account must do is sign in with a password only that person can pass on.
      // A separate confirmation step would prove nothing extra.
      email_confirm: true,
      user_metadata: { full_name: fullName },
      // app_metadata is writable only with the service key, which is what lets this name a
      // role while the public signup endpoint cannot. private.handle_new_user reads it.
      app_metadata: { role },
    })

    if (error) throwFromAuth(error, 'create account')

    return data.user.id
  },

  async findRoleById(id) {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', id)
      .maybeSingle()

    if (error) throwFromPostgrest(error, 'find account')

    return data?.role ?? null
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

  async findProfile(id) {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id,email,full_name')
      .eq('id', id)
      .maybeSingle()

    if (error) throwFromPostgrest(error, 'read account')

    return data
  },
}
