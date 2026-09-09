import { AppShell } from '@/components/app-shell'
import { PublicShell } from '@/components/public-shell'
import { getViewer } from '@/lib/auth'
import { getMessages } from '@/messages/server'

/**
 * A live lesson is entered by its link, with an account or without one. Somebody signed
 * in gets the app around it, as everywhere else; somebody in by the link alone gets a
 * bare frame, since there is nowhere else here for them to go.
 */
export default async function LiveLayout({ children }: LayoutProps<'/live/[sessionId]'>) {
  const [viewer, t] = await Promise.all([getViewer(), getMessages()])

  if (!viewer) return <PublicShell t={t}>{children}</PublicShell>

  return <AppShell viewer={viewer}>{children}</AppShell>
}
