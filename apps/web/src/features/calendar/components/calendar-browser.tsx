'use client'

import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTransition, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Messages } from '@/messages'
import { CalendarGridSkeleton } from './calendar-skeleton'

const ALL = 'all'

export type ToolbarTeacher = { id: string; name: string }

/**
 * The controls and the grid together, because the controls are what makes the grid change
 * and only this side knows a change is in flight.
 *
 * The grid is server-rendered and arrives as children, so while another week is on its way
 * this swaps it for a skeleton. Without that, stepping forward looks like nothing happened
 * until the new week appears — and on a slow connection that is long enough to press the
 * button again.
 *
 * Which week and whose lessons both live in the URL, so a particular week is a link
 * somebody can send rather than a state you have to click your way back to.
 */
export function CalendarBrowser({
  label,
  previousWeek,
  nextWeek,
  teacherId,
  teachers,
  t,
  children,
}: {
  /** The week, already written out on the server where the time zone is known. */
  label: string
  previousWeek: string
  nextWeek: string
  teacherId?: string
  teachers: ToolbarTeacher[]
  t: Messages
  children: ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()

  function navigate(changes: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams)

    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === '') next.delete(key)
      else next.set(key, value)
    }

    startTransition(() => router.replace(`${pathname}?${next}`, { scroll: false }))
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            disabled={pending}
            aria-label={t.calendar.previousWeek}
            onClick={() => navigate({ week: previousWeek })}
          >
            <ChevronLeftIcon />
          </Button>

          <Button
            variant="outline"
            size="icon"
            disabled={pending}
            aria-label={t.calendar.nextWeek}
            onClick={() => navigate({ week: nextWeek })}
          >
            <ChevronRightIcon />
          </Button>
        </div>

        {/* Clearing the parameter rather than setting today's date, so the page keeps
            meaning "this week" tomorrow as well. */}
        <Button
          variant="outline"
          size="sm"
          className="corner-brackets"
          disabled={pending}
          onClick={() => navigate({ week: null })}
        >
          {t.calendar.today}
        </Button>

        <p className="text-sm font-medium tabular-nums">{label}</p>

        <Select
          value={teacherId ?? ALL}
          onValueChange={(value) => navigate({ teacher: value === ALL ? null : value })}
        >
          <SelectTrigger className="ml-auto w-[220px]" aria-label={t.calendar.allTeachers}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t.calendar.allTeachers}</SelectItem>
            {teachers.map((teacher) => (
              <SelectItem key={teacher.id} value={teacher.id}>
                {teacher.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {pending ? <CalendarGridSkeleton /> : children}
    </div>
  )
}
