'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Fragment } from 'react'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import type { Messages } from '@/messages'

type Crumb = { label: string; href?: string }

/**
 * Reads the current route rather than taking a prop, because the shell it sits in lives
 * in a layout now — and a layout does not re-render when you navigate within it, which
 * is the whole point of moving it there.
 *
 * Every entry but the last is a link. That is what makes this the way back from a lesson,
 * and what lets the lesson page keep its heading exactly where every other page keeps
 * one instead of spending a row on "← Library" above it.
 */
export function AppBreadcrumb({ t }: { t: Messages }) {
  const pathname = usePathname()
  const trail = trailFor(pathname, t)

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {trail.map((crumb, index) => (
          <Fragment key={`${index}-${crumb.label}`}>
            {index > 0 ? <BreadcrumbSeparator /> : null}
            <BreadcrumbItem>
              {crumb.href ? (
                <BreadcrumbLink asChild>
                  <Link href={crumb.href}>{crumb.label}</Link>
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage className="line-clamp-1">{crumb.label}</BreadcrumbPage>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  )
}

/**
 * What this page is called, for a list that is not the breadcrumb — the last crumb, which
 * is the page itself. A page that knows better than the route does says so for itself.
 */
export function pageNameFor(pathname: string, t: Messages): string {
  const trail = trailFor(pathname, t)

  return trail[trail.length - 1]?.label ?? t.app.name
}

/**
 * Where "back" goes from here: the nearest crumb above this page that is a link, or null
 * on a first-level page, which has nowhere to go back to.
 */
export function parentFor(pathname: string, t: Messages): string | null {
  const trail = trailFor(pathname, t)
  if (trail.length < 2) return null

  return [...trail.slice(0, -1)].reverse().find((crumb) => crumb.href)?.href ?? null
}

function trailFor(pathname: string, t: Messages): Crumb[] {
  if (pathname.startsWith('/inbox')) return [{ label: t.inbox.title }]

  if (pathname.startsWith('/library')) {
    const library: Crumb = { label: t.library.title, href: '/library' }

    if (pathname === '/library') return [{ label: t.library.title }]
    if (pathname.startsWith('/library/trash')) return [library, { label: t.library.trash.title }]

    // A lesson, or the lesson being played. The breadcrumb cannot know its title — the
    // shell renders above the page — so it names the kind of thing rather than the thing.
    const lesson = pathname.match(/^\/library\/([^/]+)(\/play)?$/)
    if (lesson) {
      const [, materialId, playing] = lesson

      return playing
        ? [
            library,
            { label: t.library.detail.lesson, href: `/library/${materialId}` },
            { label: t.library.actions.preview },
          ]
        : [library, { label: t.library.detail.lesson }]
    }

    return [library]
  }

  if (pathname.startsWith('/admin/teachers')) return [{ label: t.teachers.title }]
  if (pathname.startsWith('/admin/students')) return [{ label: t.students.title }]
  if (pathname.startsWith('/admin/calendar')) return [{ label: t.calendar.title }]
  if (pathname.startsWith('/admin/settings')) return [{ label: t.settings.title }]
  if (pathname.startsWith('/admin')) return [{ label: t.admin.title }]
  if (pathname.startsWith('/homework')) {
    // One student's work. The breadcrumb cannot know whose — it names the kind of thing.
    return /^\/homework\/[^/]+$/.test(pathname)
      ? [{ label: t.homework.title, href: '/homework' }, { label: t.homework.work }]
      : [{ label: t.homework.title }]
  }

  if (pathname.startsWith('/help')) return [{ label: t.help.title }]
  if (pathname.startsWith('/live')) return [{ label: t.live.title }]
  if (pathname.startsWith('/dashboard/live')) return [{ label: t.live.title }]
  if (pathname.startsWith('/dashboard/calendar')) return [{ label: t.calendar.title }]
  if (pathname.startsWith('/dashboard/settings')) return [{ label: t.settings.title }]
  if (pathname.startsWith('/dashboard')) return [{ label: t.teacher.title }]

  if (pathname.startsWith('/student')) {
    return /^\/student\/homework\/[^/]+$/.test(pathname)
      ? [{ label: t.student.title, href: '/student' }, { label: t.homework.task }]
      : [{ label: t.student.title }]
  }

  return [{ label: t.app.name }]
}
