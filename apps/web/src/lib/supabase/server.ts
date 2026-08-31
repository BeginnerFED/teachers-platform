import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@tp/shared'
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '@/lib/env'

/** Supabase client for server components, route handlers and server actions. */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Server components cannot set cookies. The middleware refreshes the session
          // on every request, so there is nothing to recover from here.
        }
      },
    },
  })
}
