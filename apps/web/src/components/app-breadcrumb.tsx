'use client'

import { usePathname } from 'next/navigation'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb'
import type { Messages } from '@/messages'

/**
 * Reads the current route rather than taking a prop, because the shell it sits in lives
 * in a layout now — and a layout does not re-render when you navigate within it, which
 * is the whole point of moving it there.
 */
export function AppBreadcrumb({ t }: { t: Messages }) {
  const pathname = usePathname()

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbPage className="line-clamp-1">{labelFor(pathname, t)}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )
}

function labelFor(pathname: string, t: Messages): string {
  if (pathname.startsWith('/inbox')) return t.inbox.title
  if (pathname.startsWith('/admin/teachers')) return t.teachers.title
  if (pathname.startsWith('/admin/students')) return t.students.title
  if (pathname.startsWith('/admin/calendar')) return t.calendar.title
  if (pathname.startsWith('/admin/settings')) return t.settings.title
  if (pathname.startsWith('/admin')) return t.admin.title
  if (pathname.startsWith('/dashboard')) return t.teacher.title
  if (pathname.startsWith('/student')) return t.student.title

  return t.app.name
}
