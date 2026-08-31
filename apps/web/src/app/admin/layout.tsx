import { AppShell } from '@/components/app-shell'
import { requireRole } from '@/lib/auth'

/**
 * The guard sits here rather than in the page because loading.tsx puts the page inside a
 * Suspense boundary, and a redirect thrown in there only reaches the browser mid-stream,
 * after a 200 has already gone out.
 *
 * The shell is here for a different reason: a layout is not re-rendered when you navigate
 * within it, so the sidebar stays put instead of being rebuilt on every page change.
 */
export default async function AdminLayout({ children }: LayoutProps<'/admin'>) {
  const viewer = await requireRole('admin')

  return <AppShell viewer={viewer}>{children}</AppShell>
}
