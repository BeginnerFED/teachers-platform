import { AppShell } from '@/components/app-shell'
import { requireRole } from '@/lib/auth'

export default async function StudentLayout({ children }: LayoutProps<'/student'>) {
  const viewer = await requireRole('student')

  return <AppShell viewer={viewer}>{children}</AppShell>
}
