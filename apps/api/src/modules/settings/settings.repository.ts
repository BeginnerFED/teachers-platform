import type { Tables, TablesUpdate } from '@tp/shared'
import { supabaseAdmin } from '../../lib/supabase/admin'
import { throwFromPostgrest } from '../../lib/supabase/errors'

export type SettingsRow = Tables<'platform_settings'> & {
  /** Who last saved. Null before the first edit, or if that admin's account is gone. */
  updated_by_profile: Pick<Tables<'profiles'>, 'id' | 'full_name' | 'email'> | null
}

export type SettingsRepository = {
  get(): Promise<SettingsRow | null>
  update(patch: TablesUpdate<'platform_settings'>): Promise<SettingsRow | null>
}

// The foreign key is named explicitly because profiles is reachable from this table by
// exactly one path today, and PostgREST would guess right — but it stops guessing right
// the moment a second column points at profiles.
const COLUMNS =
  '*,updated_by_profile:profiles!platform_settings_updated_by_fkey(id,full_name,email)'

/** The table holds one row, forced by a boolean primary key that may only be true. */
const SINGLETON = true

export const settingsRepository: SettingsRepository = {
  async get() {
    const { data, error } = await supabaseAdmin
      .from('platform_settings')
      .select(COLUMNS)
      .eq('id', SINGLETON)
      .maybeSingle()
      .returns<SettingsRow | null>()

    if (error) throwFromPostgrest(error, 'read platform settings')

    return data
  },

  async update(patch) {
    const { data, error } = await supabaseAdmin
      .from('platform_settings')
      .update(patch)
      .eq('id', SINGLETON)
      .select(COLUMNS)
      .maybeSingle()
      .returns<SettingsRow | null>()

    if (error) throwFromPostgrest(error, 'update platform settings')

    return data
  },
}
