import { AppShell } from '@/components/app-shell'
import { requireRole } from '@/lib/auth'

/**
 * The library belongs to whoever teaches from it, so it sits outside the role folders and
 * lets both the admin and teachers in. A student reaches content through homework, not by
 * browsing — the API refuses them here too, so this guard is the polite half of the rule.
 *
 * The guard lives in the layout rather than the page because loading.tsx puts the page
 * inside a Suspense boundary, where a redirect only reaches the browser mid-stream, after
 * a 200 has already gone out.
 */
export default async function LibraryLayout({ children }: LayoutProps<'/library'>) {
  const viewer = await requireRole('admin', 'teacher')

  return <AppShell viewer={viewer}>{children}</AppShell>
}
