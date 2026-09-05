import type { ReactNode } from 'react'
import { AppBreadcrumb } from '@/components/app-breadcrumb'
import { AppSidebar } from '@/components/app-sidebar'
import { NavActions } from '@/components/nav-actions'
import { Separator } from '@/components/ui/separator'
import { unreadTotal } from '@/features/inbox/api'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import type { Viewer } from '@/lib/auth'
import { getMessages } from '@/messages/server'

/**
 * Rendered from a layout, not from a page.
 *
 * That distinction is the difference between the sidebar being rebuilt on every
 * navigation and it simply staying where it is while the content underneath changes —
 * which is what the App Router gives you for free, as long as the frame lives above the
 * pages rather than inside each one.
 */
export async function AppShell({
  viewer,
  children,
  bleed = false,
}: {
  viewer: Viewer
  children: ReactNode
  /**
   * Drops the padding and the column around the content. For a page that is itself a set
   * of panes with their own edges — the inbox — where a margin would leave the panels
   * floating.
   */
  bleed?: boolean
}) {
  // Both wanted by the frame itself rather than by any page, so they are read here once.
  const [t, unread] = await Promise.all([getMessages(), unreadTotal()])

  return (
    <SidebarProvider>
      <AppSidebar
        role={viewer.role}
        t={t}
        unread={unread}
        user={{ name: viewer.full_name ?? viewer.email, email: viewer.email }}
      />

      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b">
          <div className="flex flex-1 items-center gap-2 px-3">
            <SidebarTrigger />
            <Separator
              orientation="vertical"
              className="data-vertical:h-4 data-vertical:self-auto mr-2"
            />
            <AppBreadcrumb t={t} />
          </div>
          <div className="ml-auto px-3">
            {/* Formatted on the server: rendering a date in a client component would
                disagree with the server's copy and trip a hydration mismatch. */}
            <NavActions
              today={new Intl.DateTimeFormat(viewer.locale, { dateStyle: 'medium' }).format(
                new Date(),
              )}
            />
          </div>
        </header>

        <div
          className={
            bleed
              ? 'flex min-h-0 flex-1 overflow-hidden'
              : 'mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6'
          }
        >
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
