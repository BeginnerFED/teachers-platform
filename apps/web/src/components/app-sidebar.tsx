'use client'

import * as React from 'react'
import { usePathname } from 'next/navigation'

import { AppBrand } from '@/components/app-brand'
import { NavLevels } from '@/components/nav-levels'
import { NavMain } from '@/components/nav-main'
import { NavRecent } from '@/components/nav-recent'
import { NavUser } from '@/components/nav-user'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar'
import {
  SearchIcon,
  HomeIcon,
  InboxIcon,
  CalendarDaysIcon,
  CalendarIcon,
  Settings2Icon,
  BlocksIcon,
  Trash2Icon,
  MessageCircleQuestionIcon,
  UsersIcon,
  GraduationCapIcon,
  LibraryBigIcon,
  ClipboardListIcon,
  RadioIcon,
} from 'lucide-react'
import type { Enums, Level, MaterialLevelShelf } from '@tp/shared'
import type { Messages } from '@/messages'

/** Where "Home" points for each role. */
const HOME_BY_ROLE: Record<Enums<'user_role'>, string> = {
  admin: '/admin',
  teacher: '/dashboard',
  student: '/student',
}

// What is left of the block's sample data: the navigation it shipped, which the real
// rows below are still assembled from. The teams and the workspaces are gone — one was
// three invented companies, the other five invented notebooks.
const data = {
  navMain: [
    {
      title: 'Search',
      url: '#',
      icon: <SearchIcon />,
    },
    {
      title: 'Home',
      url: '#',
      icon: <HomeIcon />,
      isActive: true,
    },
    {
      title: 'Inbox',
      url: '#',
      icon: <InboxIcon />,
      badge: '10',
    },
    {
      title: 'Calendar',
      url: '#',
      icon: <CalendarIcon />,
    },
    {
      title: 'Settings',
      url: '#',
      icon: <Settings2Icon />,
    },
    {
      title: 'Templates',
      url: '#',
      icon: <BlocksIcon />,
    },
    {
      title: 'Trash',
      url: '#',
      icon: <Trash2Icon />,
    },
    {
      title: 'Help',
      url: '#',
      icon: <MessageCircleQuestionIcon />,
    },
  ],
}

export function AppSidebar({
  user,
  role,
  t,
  unread = 0,
  levels,
  openLevel,
  locale,
  ...props
}: {
  user: { name: string; email: string }
  role: Enums<'user_role'>
  t: Messages
  /** Messages waiting, shown against the inbox entry. */
  unread?: number
  /** The library by level. Empty for a student, who has no library. */
  levels: MaterialLevelShelf[]
  /** Which level was open when this person was last here. */
  openLevel: Level | null
  locale: string
} & React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const home = HOME_BY_ROLE[role]

  const isAdmin = role === 'admin'

  // The block's sample navigation is still here by choice. Three corrections to it: Home
  // sits at the top and points at the role's actual home instead of "#", the real entries
  // follow it, and what is highlighted comes from the current route rather than the
  // sample data's hardcoded isActive — which marked Home as current on every page.
  //
  // A real entry replaces the sample one of the same name rather than sitting beside it:
  // two rows both saying Settings, one of which goes nowhere, is worse than either.
  const navMain = [
    { title: t.nav.home, url: home, icon: <HomeIcon />, isActive: pathname === home },

    // Every role has one, so it sits above the role-specific entries rather than inside
    // the admin block below.
    {
      title: t.inbox.title,
      url: '/inbox',
      icon: <InboxIcon />,
      isActive: pathname.startsWith('/inbox'),
      badge: unread,
    },

    // The content library. Not in the admin block: it is the one thing an admin and a
    // teacher use for the same reason, from the same place. Students get their work
    // through homework instead, so they do not see it.
    ...(role === 'student'
      ? []
      : [
          {
            title: t.library.title,
            url: '/library',
            icon: <LibraryBigIcon />,
            // The bin is a library page, but it has its own row below — so being in it
            // should not light this one up as well.
            isActive: pathname.startsWith('/library') && !pathname.startsWith('/library/trash'),
          },
          // What was set from the library, and what came back.
          {
            title: t.nav.assignments,
            url: '/homework',
            icon: <ClipboardListIcon />,
            isActive: pathname.startsWith('/homework'),
          },
        ]),

    ...(isAdmin
      ? [
          {
            title: t.nav.teachers,
            url: '/admin/teachers',
            icon: <UsersIcon />,
            isActive: pathname.startsWith('/admin/teachers'),
          },
          {
            title: t.nav.students,
            url: '/admin/students',
            icon: <GraduationCapIcon />,
            isActive: pathname.startsWith('/admin/students'),
          },
          {
            title: t.calendar.title,
            url: '/admin/calendar',
            // The one with days in it, so it reads as a schedule rather than a date.
            icon: <CalendarDaysIcon />,
            isActive: pathname.startsWith('/admin/calendar'),
          },
          {
            title: t.nav.settings,
            url: '/admin/settings',
            icon: <Settings2Icon />,
            isActive: pathname.startsWith('/admin/settings'),
          },
        ]
      : []),

    ...(role === 'teacher'
      ? [
          {
            title: t.live.title,
            url: '/dashboard/live',
            icon: <RadioIcon />,
            isActive: pathname.startsWith('/dashboard/live'),
          },
          {
            title: t.calendar.title,
            url: '/dashboard/calendar',
            icon: <CalendarDaysIcon />,
            isActive: pathname.startsWith('/dashboard/calendar'),
          },
          {
            title: t.nav.settings,
            url: '/dashboard/settings',
            icon: <Settings2Icon />,
            isActive: pathname.startsWith('/dashboard/settings'),
          },
        ]
      : []),

    ...(role === 'student'
      ? [
          {
            title: t.studentHome.homework,
            url: '/student/homework',
            icon: <ClipboardListIcon />,
            isActive: pathname.startsWith('/student/homework'),
          },
          {
            title: t.studentHome.calendar,
            url: '/student/calendar',
            icon: <CalendarDaysIcon />,
            isActive: pathname.startsWith('/student/calendar'),
          },
          {
            title: t.nav.settings,
            url: '/student/settings',
            icon: <Settings2Icon />,
            isActive: pathname.startsWith('/student/settings'),
          },
        ]
      : []),

    ...data.navMain
      .filter(
        (item) =>
          // Replaced above by an entry that goes somewhere.
          item.title !== 'Home' &&
          item.title !== 'Inbox' &&
          item.title !== 'Settings' &&
          item.title !== 'Calendar' &&
          // Dropped rather than replaced. Both lists that would want searching carry their
          // own search box, and a row that goes nowhere teaches whoever clicks it that the
          // product is unfinished. It comes back as a command palette when there is more
          // than four pages to look through.
          item.title !== 'Search' &&
          // Also dropped: the library is the shelf of ready-made lessons, so a second row
          // called Templates is a second door into the same room. If templates ever need
          // to be told apart from other lessons, that is a tab inside the library.
          item.title !== 'Templates' &&
          // No library for a student, so no bin either.
          !(role === 'student' && item.title === 'Trash') &&
          // Replaced below by the real help page, which keeps the sample's last place.
          item.title !== 'Help',
      )
      // Mapped field by field rather than spread: the sample data carries a badge of "10"
      // as a string, and a real one is a count.
      .map((item) => {
        // Trash stops being a placeholder here. It keeps the position the block gave it
        // rather than being moved up beside the library: what it holds is a thing you
        // look for occasionally, not a place you work.
        const bin = item.title === 'Trash'

        return {
          title: bin ? t.library.trash.title : item.title,
          url: bin ? '/library/trash' : item.url,
          icon: item.icon,
          isActive: bin && pathname.startsWith('/library/trash'),
        }
      }),

    // Last, where the block kept it: the thing you look for when something else failed.
    {
      title: t.nav.help,
      url: '/help',
      icon: <MessageCircleQuestionIcon />,
      isActive: pathname.startsWith('/help'),
    },
  ]

  return (
    <Sidebar className="border-r-0" {...props}>
      <SidebarHeader>
        <AppBrand name={t.app.name} />
        <NavMain items={navMain} />
      </SidebarHeader>
      {/* A hairline where the navigation ends, so what follows reads as another thing. */}
      <SidebarContent className="border-sidebar-border border-t">
        <NavRecent t={t} />
        {/* The shelf itself, by level. Not for a student: they are given lessons rather
            than choosing them. */}
        {role === 'student' ? null : (
          <NavLevels shelves={levels} open={openLevel} locale={locale} t={t} />
        )}
      </SidebarContent>
      {/* A hairline keeps the account block visibly separate from the navigation above it. */}
      <SidebarFooter className="border-sidebar-border border-t">
        <NavUser
          user={user}
          t={t}
          settingsHref={role === 'student' ? '/student/settings' : undefined}
        />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
