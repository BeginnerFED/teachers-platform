import { redirect } from 'next/navigation'
import type { Enums, Tables } from '@tp/shared'
import { createClient } from '@/lib/supabase/server'

export type Profile = Tables<'profiles'>
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

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  return data
}

export async function requireProfile(): Promise<Profile> {
  const profile = await getProfile()
  if (!profile) redirect('/login')
  return profile
}

/**
 * Guards a section of the app. Someone with the wrong role is sent to their own home
 * rather than shown an error — they are not doing anything wrong, just in the wrong place.
 */
export async function requireRole(role: Role): Promise<Profile> {
  const profile = await requireProfile()
  if (profile.role !== role) redirect(homeFor(profile.role))
  return profile
}
