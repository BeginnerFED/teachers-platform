import { cookies } from 'next/headers'
import type { ReactNode } from 'react'
import { PLATFORM_TIME_ZONE } from '@tp/shared'
import { AppBreadcrumb } from '@/components/app-breadcrumb'
import { AppSidebar } from '@/components/app-sidebar'
import { BackButton } from '@/components/back-button'
import { NavActions } from '@/components/nav-actions'
import { Separator } from '@/components/ui/separator'
import { unreadTotal } from '@/features/inbox/api'
import { listLevelShelves } from '@/features/library/api'
import { LEVEL_COOKIE, levelFromCookie } from '@/features/library/levels'
import { RecentProvider, RecordPage } from '@/features/recent/recent'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import type { Viewer } from '@/lib/auth'
import { getMessages } from '@/messages/server'
import { studentLiveInvitations } from '@/features/live/api'
import { StudentLiveProvider } from '@/features/live/components/student-live-notifications'
import { accountNotifications } from '@/features/notifications/api'
import { StudyUpdatesProvider } from '@/features/student-dashboard/components/study-updates'
import { getTeachingAccess } from '@/features/settings/teaching-access'
import { AccessNotice } from '@/features/settings/components/access-notice'

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
  // Wanted by the frame itself rather than by any page, so they are read here once. The
  // shelf is asked for only by somebody who has one: a student reaches a lesson through
  // homework or through the room, and has no library to browse.
  //
  // None of them may take the page down with them. This renders inside a section's layout,
  // where that section's own error screen cannot catch it, so a failure here would blank
  // every page in the section. Access that cannot be read counts as access: a hiccup
  // should not hide the library or put up a notice that is not true, and the API still
  // refuses whatever is not allowed.
  const teaching = await getTeachingAccess().catch(() => true)
  const browses = viewer.role !== 'student' && teaching

  const [t, unread, levels, jar, invitations, updates] = await Promise.all([
    getMessages(),
    unreadTotal().catch(() => 0),
    browses ? listLevelShelves().catch(() => []) : [],
    cookies(),
    viewer.role === 'student' ? studentLiveInvitations().catch(() => null) : null,
    accountNotifications().catch(() => null),
  ])

  const frame = (
    // Around the frame rather than inside it: the sidebar shows the list, the pages add
    // to it, and both must be talking about the same person.
    <RecentProvider account={viewer.id}>
      <RecordPage t={t} />

      {/* Every section renders its own shell, so the sidebar is built afresh on the way
          into one. The provider writes how it was left to this cookie; reading it back is
          what keeps a collapsed sidebar collapsed across sections and reloads. */}
      <SidebarProvider defaultOpen={jar.get('sidebar_state')?.value !== 'false'}>
        <AppSidebar
          role={viewer.role}
          t={t}
          levels={levels}
          openLevel={levelFromCookie(jar.get(LEVEL_COOKIE)?.value)}
          locale={viewer.locale}
          user={{ name: viewer.full_name ?? viewer.email, email: viewer.email }}
        />

        <SidebarInset>
          <header className="flex h-14 shrink-0 items-center gap-2 border-b">
            <div className="flex min-w-0 flex-1 items-center gap-2 px-3">
              <SidebarTrigger />
              <Separator
                orientation="vertical"
                className="data-vertical:h-4 data-vertical:self-auto mr-2"
              />
              {/* On a second-level page the way back sits beside the title, in the column's
                left margin. A screen too narrow to have one gets it here instead. */}
              <BackButton t={t} className="mr-1 min-[1400px]:hidden" />
              <AppBreadcrumb t={t} />
            </div>
            <div className="ml-auto px-3">
              {/* Formatted on the server: rendering a date in a client component would
                disagree with the server's copy and trip a hydration mismatch. In Kyiv
                time, like the rest of the platform: the server's own zone is UTC in
                production, a day behind for the first hours after midnight. */}
              <NavActions
                role={viewer.role}
                t={t}
                today={new Intl.DateTimeFormat(viewer.locale, {
                  dateStyle: 'medium',
                  timeZone: PLATFORM_TIME_ZONE,
                }).format(new Date())}
              />
            </div>
          </header>

          <div
            className={
              bleed
                ? 'flex min-h-0 flex-1 overflow-hidden'
                : 'relative mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6'
            }
          >
            {bleed ? null : (
              <BackButton
                t={t}
                className="absolute left-0 top-6 hidden -translate-x-full min-[1400px]:inline-flex"
              />
            )}
            {!teaching && !bleed ? <AccessNotice t={t} /> : null}
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </RecentProvider>
  )
  return (
    <StudyUpdatesProvider
      key={viewer.id}
      accountId={viewer.id}
      role={viewer.role}
      initial={updates}
      // For the sidebar's unread mark, which reads it from here: the poll that keeps the
      // bell current brings the count along.
      unreadMessages={unread}
      t={t}
    >
      {viewer.role === 'student' ? (
        <StudentLiveProvider key={viewer.id} accountId={viewer.id} initial={invitations} t={t}>
          {frame}
        </StudentLiveProvider>
      ) : (
        frame
      )}
    </StudyUpdatesProvider>
  )
}
