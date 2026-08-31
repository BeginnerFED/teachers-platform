import { redirect } from 'next/navigation'
import { homeFor, requireViewer } from '@/lib/auth'

/** The root is just a signpost: everyone is sent to the home page for their role. */
export default async function HomePage() {
  const viewer = await requireViewer()
  redirect(homeFor(viewer.role))
}
