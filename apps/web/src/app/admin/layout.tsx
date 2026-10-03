import { AppShell } from '@/components/app-shell'
import { requireRole } from '@/lib/auth'

/**
 * The guard sits here because loading.tsx puts each page inside a Suspense boundary, where a
 * redirect only reaches the browser mid-stream, after a 200 has already gone out; from here
 * it is a real redirect. The pages render alongside it, though, so each repeats the check
 * before it asks the API for anything. The session is cached for the request, so it is still
 * read once.
 *
 * The shell is here for a different reason: a layout is not re-rendered when you navigate
 * within it, so the sidebar stays put instead of being rebuilt on every page change.
 */
export default async function AdminLayout({ children }: LayoutProps<'/admin'>) {
  const viewer = await requireRole('admin')

  return <AppShell viewer={viewer}>{children}</AppShell>
}
