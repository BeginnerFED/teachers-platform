import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@tp/shared'
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '@/lib/env'

/**
 * Browser-side Supabase client. Used for auth and realtime only — every write goes
 * through the API, so this client should never be reached for by a mutation.
 */
export function createClient() {
  return createBrowserClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
}
