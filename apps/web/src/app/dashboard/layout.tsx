import { AppShell } from '@/components/app-shell'
import { requireRole } from '@/lib/auth'

export default async function DashboardLayout({ children }: LayoutProps<'/dashboard'>) {
  const viewer = await requireRole('teacher')

  return <AppShell viewer={viewer}>{children}</AppShell>
}
