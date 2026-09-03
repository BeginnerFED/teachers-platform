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
  if (pathname.startsWith('/dashboard')) return [{ label: t.teacher.title }]
  if (pathname.startsWith('/student')) return [{ label: t.student.title }]

  return [{ label: t.app.name }]
}
