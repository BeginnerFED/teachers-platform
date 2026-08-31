import { AppShell } from '@/components/app-shell'
import { requireRole } from '@/lib/auth'
import { getMessages } from '@/messages/server'

export default async function TeacherDashboardPage() {
  const [profile, t] = await Promise.all([requireRole('teacher'), getMessages()])

  return <AppShell profile={profile} title={t.teacher.title} description={t.teacher.description} />
}
