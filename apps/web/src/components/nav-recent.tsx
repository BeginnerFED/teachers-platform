'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BookOpenIcon,
  CalendarDaysIcon,
  ChevronDownIcon,
  ClipboardListIcon,
  FileTextIcon,
  GraduationCapIcon,
  HomeIcon,
  InboxIcon,
  LibraryBigIcon,
  MessageCircleQuestionIcon,
  MessageSquareIcon,
  PencilLineIcon,
  RadioIcon,
  Settings2Icon,
  Trash2Icon,
  UsersIcon,
} from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { useHydrated, useRecent, type RecentKind, type RecentPage } from '@/features/recent/recent'
import type { Messages } from '@/messages'

/** What a page that named itself looks like: the thing it is, whatever its address. */
const BY_KIND: Record<Exclude<RecentKind, 'page'>, typeof BookOpenIcon> = {
  lesson: BookOpenIcon,
  homework: ClipboardListIcon,
  task: PencilLineIcon,
  conversation: MessageSquareIcon,
}

/**
 * What everything else looks like: the icon its section carries in the navigation above,
 * so a row here and the row it came from are recognisably the same place. Longest address
 * first — the bin is a library page, and its own icon beats the library's.
 */
const BY_ROUTE: [string, typeof BookOpenIcon][] = [
  ['/library/trash', Trash2Icon],
  ['/library', LibraryBigIcon],
  ['/homework', ClipboardListIcon],
  ['/inbox', InboxIcon],
  ['/admin/teachers', UsersIcon],
  ['/admin/students', GraduationCapIcon],
  ['/admin/calendar', CalendarDaysIcon],
  ['/admin/settings', Settings2Icon],
  ['/admin', HomeIcon],
  ['/dashboard/calendar', CalendarDaysIcon],
  ['/dashboard/live', RadioIcon],
  ['/dashboard/settings', Settings2Icon],
  ['/dashboard', HomeIcon],
  ['/student/homework', PencilLineIcon],
  ['/student/calendar', CalendarDaysIcon],
  ['/student/settings', Settings2Icon],
  ['/student', HomeIcon],
  ['/help', MessageCircleQuestionIcon],
]

function iconFor({ kind, href }: RecentPage) {
  if (kind !== 'page') return BY_KIND[kind]

  return BY_ROUTE.find(([prefix]) => href.startsWith(prefix))?.[1] ?? FileTextIcon
}

/**
 * The way back to where somebody has just been, under the navigation that gets them to
 * the sections.
 *
 * Empty until they have been somewhere, and it says so rather than showing nothing: a
 * heading with a blank under it reads as broken.
 */
export function NavRecent({ t }: { t: Messages }) {
  const pages = useRecent()
  const hydrated = useHydrated()
  const pathname = usePathname()

  return (
    <Collapsible defaultOpen className="group/nav-group">
      <SidebarGroup className="group-data-[collapsible=icon]:hidden">
        <SidebarGroupLabel asChild>
          <CollapsibleTrigger className="w-full">
            {t.nav.recent}
            <ChevronDownIcon className="ml-auto size-4 transition-transform group-data-[state=closed]/nav-group:-rotate-90" />
          </CollapsibleTrigger>
        </SidebarGroupLabel>

        <CollapsibleContent>
          <SidebarGroupContent>
            {!hydrated ? (
              // The list lives in this browser, and the server rendering this has not read
              // it. Saying nothing for the one frame that takes beats saying "nothing here
              // yet" to somebody whose four pages are about to appear.
              <div className="h-2" />
            ) : pages.length === 0 ? (
              <p className="text-sidebar-foreground/60 px-2 py-1.5 text-xs leading-relaxed">
                {t.nav.recentEmpty}
              </p>
            ) : (
              <SidebarMenu>
                {pages.map((page) => {
                  const Icon = iconFor(page)

                  return (
                    <SidebarMenuItem key={page.href}>
                      <SidebarMenuButton asChild isActive={pathname === page.href}>
                        <Link href={page.href} title={page.title}>
                          <Icon />
                          <span>{page.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            )}
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  )
}
