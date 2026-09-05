import { AppShell } from '@/components/app-shell'
import { requireViewer } from '@/lib/auth'

/**
 * Help is for everyone who can sign in, so it sits outside the role folders and asks only
 * that you are somebody. The page itself decides which questions you are shown.
 */
export default async function HelpLayout({ children }: LayoutProps<'/help'>) {
  const viewer = await requireViewer()

  return <AppShell viewer={viewer}>{children}</AppShell>
}
