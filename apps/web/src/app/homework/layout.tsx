import { AppShell } from '@/components/app-shell'
import { requireRole } from '@/lib/auth'

/**
 * The teacher's desk for homework: what they set, and what came back. The admin can set
 * homework too, so like the library this sits outside the role folders. A student's own
 * homework lives under /student.
 *
 * The guard is in the layout for the same reason the library's is: loading.tsx puts the
 * page in a Suspense boundary, where a redirect arrives after the 200 has gone out.
 */
export default async function HomeworkLayout({ children }: LayoutProps<'/homework'>) {
  const viewer = await requireRole('admin', 'teacher')

  return <AppShell viewer={viewer}>{children}</AppShell>
}
