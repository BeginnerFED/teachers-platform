import { redirect } from 'next/navigation'
import { homeFor, requireProfile } from '@/lib/auth'

/** The root is just a signpost: everyone is sent to the home page for their role. */
export default async function HomePage() {
  const profile = await requireProfile()
  redirect(homeFor(profile.role))
}
