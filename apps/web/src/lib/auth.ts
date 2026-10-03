import { cache } from 'react'
import { redirect } from 'next/navigation'
import { isAuthRetryableFetchError } from '@supabase/supabase-js'
import { DEFAULT_LOCALE, LOCALES, type Enums, type Tables } from '@tp/shared'
import { createClient } from '@/lib/supabase/server'

export type Viewer = Tables<'profiles'>
export type Role = Enums<'user_role'>

/** Where each role lands after signing in. */
const HOME_BY_ROLE: Record<Role, string> = {
  admin: '/admin',
  teacher: '/dashboard',
  student: '/student',
}

export function homeFor(role: Role) {
  return HOME_BY_ROLE[role]
}

/**
 * One round trip, not three.
 *
 * This used to call auth.getUser() and then read the profile, on top of the getUser()
 * the proxy already makes on every request — roughly 340ms of Frankfurt latency before
 * a byte reached the browser. The profile read alone is enough: PostgREST checks the
 * token signature, and row level security returns the caller's own row and nothing else,
 * so a forged or expired token comes back empty rather than trusted.
 *
 * cache() keeps the layout's guard and the page's own lookup to a single query.
 *
 * Who is signed in and the profile behind them come back separately, because "nobody is
 * signed in" and "somebody is, but has no profile" need different answers.
 */
const readSession = cache(async (): Promise<{ userId: string | null; viewer: Viewer | null }> => {
  const supabase = await createClient()

  // getClaims verifies the token's signature rather than trusting the cookie, and does it
  // without a round trip once the project is on asymmetric signing keys. All we need from
  // it is the subject: an admin can read every profile row, so filtering by id is what
  // keeps this from handing back somebody else's.
  const { data: verified, error: claimsError } = await supabase.auth.getClaims()

  // An expired or revoked session is simply nobody signed in. Supabase being unreachable
  // is not: answering "nobody" then sent a signed-in person from every page to /login and
  // straight back again until the browser gave up. Thrown, it reaches an error page that
  // can retry.
  if (claimsError && isAuthRetryableFetchError(claimsError)) throw claimsError

  const userId = verified?.claims.sub ?? null
  if (!userId) return { userId: null, viewer: null }

  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()

  // The same goes for the profile: a failed read is an outage, not an empty answer.
  if (error) throw error

  if (!data) return { userId, viewer: null }

  // Removed language preferences fall back for every page, including date formatting.
  return {
    userId,
    viewer: {
      ...data,
      locale: (LOCALES as readonly string[]).includes(data.locale) ? data.locale : DEFAULT_LOCALE,
    },
  }
})

export async function getViewer(): Promise<Viewer | null> {
  return (await readSession()).viewer
}

export async function requireViewer(): Promise<Viewer> {
  const { userId, viewer } = await readSession()
  if (viewer) return viewer

  // Signed in, but with no profile behind the account. Plain /login would bounce them
  // straight back here, since the proxy sends a signed-in visitor home from it, so the
  // sign-in page is told why they came — which also lets them stay on it.
  redirect(userId ? '/login?error=profile' : '/login')
}

/**
 * Guards a section of the app. Someone with the wrong role is sent to their own home
 * rather than shown an error — they are not doing anything wrong, just in the wrong place.
 */
export async function requireRole(...roles: Role[]): Promise<Viewer> {
  const viewer = await requireViewer()
  if (!roles.includes(viewer.role)) redirect(homeFor(viewer.role))

  return viewer
}
