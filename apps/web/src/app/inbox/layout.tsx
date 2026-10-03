import { AppShell } from '@/components/app-shell'
import { listConversations } from '@/features/inbox/api'
import { InboxPanel } from '@/features/inbox/components/inbox-panel'
import { ApiError } from '@/lib/api/errors'
import { requireViewer } from '@/lib/auth'
import { getMessages } from '@/messages/server'

/**
 * The one part of the platform every role uses, so it sits outside the role folders and
 * guards on being signed in rather than on being anything in particular. Who may write to
 * whom is decided by the API, per pair, not by which section of the site you are in.
 *
 * The list lives in the layout so that moving between conversations changes the pane and
 * leaves the list where it is — scroll position included.
 */
export default async function InboxLayout({ children }: LayoutProps<'/inbox'>) {
  const [viewer, t, conversations] = await Promise.all([
    requireViewer(),
    getMessages(),
    // A layout's own error passes its error.tsx by, so a list that failed to load is shown
    // as a notice in the list rather than as the whole page failing. The conversation
    // beside it may well open.
    listConversations().catch((error: unknown) => {
      if (error instanceof ApiError) return null

      throw error
    }),
  ])

  return (
    <AppShell viewer={viewer} bleed>
      <InboxPanel conversations={conversations} locale={viewer.locale} t={t}>
        {children}
      </InboxPanel>
    </AppShell>
  )
}
