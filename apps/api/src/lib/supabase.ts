import { createClient } from '@supabase/supabase-js'
import type { Database } from '@tp/shared'
import { env } from '../env'

/**
 * Server-side Supabase client. It holds the secret key, so it bypasses row level
 * security entirely — every call made through it must do its own authorisation check.
 * This client must never be handed to anything that reaches the browser.
 */
export const supabaseAdmin = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})
