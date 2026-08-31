import { requireRole } from '@/lib/auth'

export default async function DashboardLayout({ children }: LayoutProps<'/dashboard'>) {
  await requireRole('teacher')

  return children
}
