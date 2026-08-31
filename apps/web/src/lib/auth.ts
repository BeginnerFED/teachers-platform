import { cache } from 'react'
import { redirect } from 'next/navigation'
import type { Enums, Tables } from '@tp/shared'
import { createClient } from '@/lib/supabase/server'

export type Profile = Tables<'profiles'>
export type Role = Enums<'user_role'>

/** The profile plus the address the account signs in with, which lives in auth.users. */
export type Viewer = Profile & { email: string }

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
 * Wrapped in cache() so the layout's guard and the page's own lookup share one round
 * trip per request rather than querying twice.
 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) return null

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile) return null

  return { ...profile, email: user.email }
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
