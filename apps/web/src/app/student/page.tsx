import { AppShell } from '@/components/app-shell'
import { requireRole } from '@/lib/auth'
import { getMessages } from '@/messages/server'

export default async function StudentPage() {
  const [profile, t] = await Promise.all([requireRole('student'), getMessages()])

  return <AppShell profile={profile} title={t.student.title} description={t.student.description} />
}
