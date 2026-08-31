import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

/**
 * The raw access token, to forward to the API as a bearer credential.
 *
 * Read from the cookie without verifying it, and that is fine here precisely because
 * this value is never trusted on this side: it is handed straight to the API, which
 * checks the signature itself. Nothing in the web app may gate an access decision on it.
 */
export const getAccessToken = cache(async (): Promise<string | null> => {
  const supabase = await createClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  return session?.access_token ?? null
})
