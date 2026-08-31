import { requireRole } from '@/lib/auth'

export default async function StudentLayout({ children }: LayoutProps<'/student'>) {
  await requireRole('student')

  return children
}
