import { AppShell } from '@/components/app-shell'
import { requireRole } from '@/lib/auth'
import { getMessages } from '@/messages/server'

export default async function AdminPage() {
  const [profile, t] = await Promise.all([requireRole('admin'), getMessages()])

  return <AppShell profile={profile} title={t.admin.title} description={t.admin.description} />
}
