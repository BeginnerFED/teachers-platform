import { AppShell } from '@/components/app-shell'
import { requireRole } from '@/lib/auth'
import { requireTeachingAccess } from '@/features/settings/teaching-access'

/**
 * The library belongs to whoever teaches from it, so it sits outside the role folders and
 * lets both the admin and teachers in. A student reaches content through homework, not by
 * browsing — the API refuses them here too, so this guard is the polite half of the rule.
 *
 * The guard lives in the layout because loading.tsx puts each page inside a Suspense
 * boundary, where a redirect only reaches the browser mid-stream, after a 200 has already
 * gone out; from here it is a real redirect. It does not hold the pages back, though: they
 * render alongside it, and without it when you move from one of them to another. So each
 * page repeats both checks before it asks the API for anything, rather than being refused
 * and logging an error first. Both are cached for the request, so the session and the
 * access behind them are still read once.
 */
export default async function LibraryLayout({ children }: LayoutProps<'/library'>) {
  const viewer = await requireRole('admin', 'teacher')
  await requireTeachingAccess()

  return <AppShell viewer={viewer}>{children}</AppShell>
}
