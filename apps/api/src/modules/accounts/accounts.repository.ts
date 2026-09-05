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
  /** Whether some other account already signs in with this address. */
  emailTaken(email: string, exceptId: string): Promise<boolean>
  setPassword(id: string, password: string): Promise<void>
  updateProfile(id: string, patch: { fullName?: string; email?: string }): Promise<void>
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

  async emailTaken(email, exceptId) {
    // Profiles mirror the auth table's addresses, and unlike the auth API they can be
    // asked this question plainly. The auth API answers a clash on update with a bare
    // "error updating user", which is nothing a person could be shown.
    const { count, error } = await supabaseAdmin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('email', email)
      .neq('id', exceptId)

    if (error) throwFromPostgrest(error, 'check email')

    return (count ?? 0) > 0
  },

  async setPassword(id, password) {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(id, { password })

    if (error) throwFromAuth(error, 'reset password')
  },

  async updateProfile(id, { fullName, email }) {
    // The address lives in auth and is mirrored onto the profile by a trigger, so it is
    // changed there and only there. Confirmed at once, for the same reason a new account's
    // is: an administrator typed it and is vouching for it.
    if (email !== undefined) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(id, {
        email,
        email_confirm: true,
      })

      if (error) throwFromAuth(error, 'change email')
    }

    // The name is the profile's own. The copy in user metadata is what a fresh profile
    // would be built from, so it is kept in step rather than left to contradict it.
    if (fullName !== undefined) {
      const { error } = await supabaseAdmin
        .from('profiles')
        .update({ full_name: fullName })
        .eq('id', id)

      if (error) throwFromPostgrest(error, 'change name')

      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, {
        user_metadata: { full_name: fullName },
      })

      if (authError) throwFromAuth(authError, 'change name')
    }
  },
}
