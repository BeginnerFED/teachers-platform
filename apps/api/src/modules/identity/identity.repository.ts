import type { Tables } from '@tp/shared'
import { supabaseAdmin } from '../../lib/supabase/admin'
import { throwFromPostgrest } from '../../lib/supabase/errors'

export type ProfileRow = Tables<'profiles'>

export type IdentityRepository = {
  findProfileById(id: string): Promise<ProfileRow | null>
}

export const identityRepository: IdentityRepository = {
  async findProfileById(id) {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) throwFromPostgrest(error, 'find profile')

    return data
  },
}
