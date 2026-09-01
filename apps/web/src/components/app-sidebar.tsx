'use client'

import * as React from 'react'
import { usePathname } from 'next/navigation'

import { NavFavorites } from '@/components/nav-favorites'
import { NavMain } from '@/components/nav-main'
import { NavWorkspaces } from '@/components/nav-workspaces'
import { NavUser } from '@/components/nav-user'
import { TeamSwitcher } from '@/components/team-switcher'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar'
import {
  TerminalIcon,
  AudioLinesIcon,
  SearchIcon,
  SparklesIcon,
  HomeIcon,
  InboxIcon,
  CalendarIcon,
  Settings2Icon,
  BlocksIcon,
  Trash2Icon,
  MessageCircleQuestionIcon,
  UsersIcon,
  GraduationCapIcon,
} from 'lucide-react'
import type { Enums } from '@tp/shared'
import type { Messages } from '@/messages'

/** Where "Home" points for each role. */
const HOME_BY_ROLE: Record<Enums<'user_role'>, string> = {
  admin: '/admin',
  teacher: '/dashboard',
  student: '/student',
}

// This is sample data.
const data = {
  teams: [
    {
      name: 'Acme Inc',
      logo: <TerminalIcon />,
      plan: 'Enterprise',
    },
    {
      name: 'Acme Corp.',
      logo: <AudioLinesIcon />,
      plan: 'Startup',
    },
    {
      name: 'Evil Corp.',
      logo: <TerminalIcon />,
      plan: 'Free',
    },
  ],
  navMain: [
    {
      title: 'Search',
      url: '#',
      icon: <SearchIcon />,
    },
    {
      title: 'Ask AI',
      url: '#',
      icon: <SparklesIcon />,
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
  favorites: [
    {
      name: 'Project Management & Task Tracking',
      url: '#',
      emoji: '📊',
    },
    {
      name: 'Family Recipe Collection & Meal Planning',
      url: '#',
      emoji: '🍳',
    },
    {
      name: 'Fitness Tracker & Workout Routines',
      url: '#',
      emoji: '💪',
    },
    {
      name: 'Book Notes & Reading List',
      url: '#',
      emoji: '📚',
    },
    {
      name: 'Sustainable Gardening Tips & Plant Care',
      url: '#',
      emoji: '🌱',
    },
    {
      name: 'Language Learning Progress & Resources',
      url: '#',
      emoji: '🗣️',
    },
    {
      name: 'Home Renovation Ideas & Budget Tracker',
      url: '#',
      emoji: '🏠',
    },
    {
      name: 'Personal Finance & Investment Portfolio',
      url: '#',
      emoji: '💰',
    },
    {
      name: 'Movie & TV Show Watchlist with Reviews',
      url: '#',
      emoji: '🎬',
    },
    {
      name: 'Daily Habit Tracker & Goal Setting',
      url: '#',
      emoji: '✅',
    },
  ],
  workspaces: [
    {
      name: 'Personal Life Management',
      emoji: '🏠',
      pages: [
        {
          name: 'Daily Journal & Reflection',
          url: '#',
          emoji: '📔',
        },
        {
          name: 'Health & Wellness Tracker',
          url: '#',
          emoji: '🍏',
        },
        {
          name: 'Personal Growth & Learning Goals',
          url: '#',
          emoji: '🌟',
        },
      ],
    },
    {
      name: 'Professional Development',
      emoji: '💼',
      pages: [
        {
          name: 'Career Objectives & Milestones',
          url: '#',
          emoji: '🎯',
        },
        {
          name: 'Skill Acquisition & Training Log',
          url: '#',
          emoji: '🧠',
        },
        {
          name: 'Networking Contacts & Events',
          url: '#',
          emoji: '🤝',
        },
      ],
    },
    {
      name: 'Creative Projects',
      emoji: '🎨',
      pages: [
        {
          name: 'Writing Ideas & Story Outlines',
          url: '#',
          emoji: '✍️',
        },
        {
          name: 'Art & Design Portfolio',
          url: '#',
          emoji: '🖼️',
        },
        {
          name: 'Music Composition & Practice Log',
          url: '#',
          emoji: '🎵',
        },
      ],
    },
    {
      name: 'Home Management',
      emoji: '🏡',
      pages: [
        {
          name: 'Household Budget & Expense Tracking',
          url: '#',
          emoji: '💰',
        },
        {
          name: 'Home Maintenance Schedule & Tasks',
          url: '#',
          emoji: '🔧',
        },
        {
          name: 'Family Calendar & Event Planning',
          url: '#',
          emoji: '📅',
        },
      ],
    },
    {
      name: 'Travel & Adventure',
      emoji: '🧳',
      pages: [
        {
          name: 'Trip Planning & Itineraries',
          url: '#',
          emoji: '🗺️',
        },
        {
          name: 'Travel Bucket List & Inspiration',
          url: '#',
          emoji: '🌎',
        },
        {
          name: 'Travel Journal & Photo Gallery',
          url: '#',
          emoji: '📸',
        },
      ],
    },
  ],
}

export function AppSidebar({
  user,
  role,
  t,
  unread = 0,
  ...props
}: {
  user: { name: string; email: string }
  role: Enums<'user_role'>
  t: Messages
  /** Messages waiting, shown against the inbox entry. */
  unread?: number
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
            icon: <CalendarIcon />,
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

    ...data.navMain
      .filter(
        (item) =>
          // Replaced above by an entry that goes somewhere.
          item.title !== 'Home' &&
          item.title !== 'Inbox' &&
          !(isAdmin && (item.title === 'Settings' || item.title === 'Calendar')) &&
          // Dropped rather than replaced. Both lists that would want searching carry their
          // own search box, and a row that goes nowhere teaches whoever clicks it that the
          // product is unfinished. It comes back as a command palette when there is more
          // than four pages to look through.
          item.title !== 'Search',
      )
      // Mapped field by field rather than spread: the sample data carries a badge of "10"
      // as a string, and a real one is a count.
      .map((item) => ({ title: item.title, url: item.url, icon: item.icon, isActive: false })),
  ]

  return (
    <Sidebar className="border-r-0" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={data.teams} />
        <NavMain items={navMain} />
      </SidebarHeader>
      <SidebarContent>
        <NavFavorites favorites={data.favorites} />
        <NavWorkspaces workspaces={data.workspaces} />
      </SidebarContent>
      {/* A hairline keeps the account block visibly separate from the navigation above it. */}
      <SidebarFooter className="border-sidebar-border border-t">
        <NavUser user={user} t={t} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
