import { createClient } from '@supabase/supabase-js'
import type { Database } from '@tp/shared'
import { env } from '../../env'

/**
 * The service-role client. It bypasses row level security entirely, which is why the
 * ESLint config only lets *.repository.ts files import it: every authorisation decision
 * this client makes has to be written out in the API, and a decision buried in a
 * controller is one nobody will find when it matters.
 */
export const supabaseAdmin = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})
