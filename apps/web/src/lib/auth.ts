import { cache } from 'react'
import { redirect } from 'next/navigation'
import type { Enums, Tables } from '@tp/shared'
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
 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createClient()

  // getClaims verifies the token's signature rather than trusting the cookie, and does it
  // without a round trip once the project is on asymmetric signing keys. All we need from
  // it is the subject: an admin can read every profile row, so filtering by id is what
  // keeps this from handing back somebody else's.
  const { data: verified } = await supabase.auth.getClaims()
  const userId = verified?.claims.sub
  if (!userId) return null

  const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()

  return data
})

export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer()
  if (!viewer) redirect('/login')

  return viewer
}

/**
 * Guards a section of the app. Someone with the wrong role is sent to their own home
 * rather than shown an error — they are not doing anything wrong, just in the wrong place.
 */
export async function requireRole(role: Role): Promise<Viewer> {
  const viewer = await requireViewer()
  if (viewer.role !== role) redirect(homeFor(viewer.role))

  return viewer
}
