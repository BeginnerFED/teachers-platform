'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import {
  ArrowUpRightIcon,
  ChevronDownIcon,
  Loader2Icon,
  RadioIcon,
  SearchIcon,
  UsersIcon,
} from 'lucide-react'
import type { TeacherStudentOverview } from '@tp/shared'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RefreshDashboard } from '@/features/admin-dashboard/components/refresh-dashboard'
import { StudentCredits } from '@/features/calendar/components/student-credits'
import { initials } from '@/lib/format'
import type { Messages } from '@/messages'
import { loadStudentProgress, type StudentProgressSummary as StudentProgressData } from '../actions'
import { StudentProgressSummary } from './student-progress-summary'

export function QuickStudents({
  students,
  locale,
  t,
}: {
  students: TeacherStudentOverview[] | null
  locale: string
  t: Messages
}) {
  const [search, setSearch] = useState('')
  const [limit, setLimit] = useState(8)
  const [selected, setSelected] = useState<TeacherStudentOverview | null>(null)
  const [summary, setSummary] = useState<StudentProgressData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, transition] = useTransition()
  const request = useRef(0)
  const router = useRouter()
  const copy = t.teacherHome.students
  const query = search.trim().toLocaleLowerCase(locale)
  const filtered = (students ?? []).filter((student) =>
    `${student.fullName ?? ''} ${student.email}`.toLocaleLowerCase(locale).includes(query),
  )
  function choose(student: TeacherStudentOverview) {
    const id = ++request.current
    setSelected(student)
    setSummary(null)
    setError(null)
    transition(async () => {
      try {
        const result = await loadStudentProgress(student.id)
        if (id !== request.current) return
        if (result.error) setError(t.errors[result.error])
        else setSummary(result.data)
      } catch {
        if (id === request.current) setError(t.errors.upstream_unavailable)
      }
    })
  }
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <UsersIcon className="text-muted-foreground size-4" />
            {copy.title}
            {students && (
              <span className="text-muted-foreground font-normal">({students.length})</span>
            )}
          </h2>
          <p className="text-muted-foreground mt-1 text-xs">{copy.hint}</p>
        </div>
        <Button asChild variant="ghost" size="sm" className="corner-brackets">
          <Link href="/dashboard/live">
            {t.liveDesk.openDesk}
            <ArrowUpRightIcon />
          </Link>
        </Button>
      </div>
      {students === null ? (
        <div className="flex items-center justify-between rounded-xl border p-5 text-sm">
          <p>{t.liveDesk.studentsFailed}</p>
          <RefreshDashboard label={t.common.retry} />
        </div>
      ) : !students.length ? (
        <div className="text-muted-foreground rounded-xl border border-dashed p-5 text-sm">
          {t.liveDesk.noStudentsHint}
        </div>
      ) : (
        <>
          <div className="relative max-w-sm">
            <SearchIcon className="text-muted-foreground absolute left-3 top-2.5 size-4" />
            <Input
              className="pl-9"
              value={search}
              maxLength={120}
              onChange={(event) => {
                setSearch(event.target.value)
                setLimit(8)
              }}
              aria-label={t.liveDesk.searchStudent}
              placeholder={t.liveDesk.searchStudent}
            />
          </div>
          {!filtered.length ? (
            <p className="text-muted-foreground rounded-xl border p-5 text-sm">
              {t.liveDesk.noMatches}
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {filtered.slice(0, limit).map((student) => (
                <div
                  key={student.id}
                  className="bg-card flex min-w-0 items-center gap-1 rounded-xl border p-2"
                >
                  <Button
                    variant="ghost"
                    className="corner-brackets h-auto min-w-0 flex-1 justify-start gap-3 whitespace-normal rounded-lg px-2 py-3 text-left font-normal"
                    onClick={() => choose(student)}
                    aria-label={`${student.fullName || student.email} · ${copy.progress.title}`}
                  >
                    <Avatar className="size-10 shrink-0 rounded-xl">
                      <AvatarFallback className="rounded-xl border text-xs">
                        {initials(student.fullName || student.email)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {student.fullName || student.email}
                      </span>
                      <span className="text-muted-foreground mt-0.5 block truncate text-xs">
                        {student.email}
                      </span>
                      <Badge
                        variant="outline"
                        className={`mt-2 text-[10px] ${student.remaining <= 2 && (student.granted > 0 || student.used > 0) ? 'border-amber-300 text-amber-700' : 'text-muted-foreground'}`}
                      >
                        {student.granted === 0 && student.used === 0
                          ? copy.noCredits
                          : copy.remaining.replace('{count}', String(student.remaining))}
                      </Badge>
                    </span>
                  </Button>
                  <Button
                    asChild
                    size="icon-sm"
                    variant="ghost"
                    className="corner-brackets text-primary shrink-0 rounded-full"
                  >
                    <Link
                      href={`/dashboard/live?student=${student.id}`}
                      aria-label={`${student.fullName || student.email} · ${t.liveDesk.prepareTitle}`}
                    >
                      <RadioIcon />
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          )}
          {filtered.length > limit && (
            <Button
              variant="outline"
              className="corner-brackets w-full"
              onClick={() => setLimit((n) => n + 8)}
            >
              <ChevronDownIcon />
              {copy.more.replace('{count}', String(filtered.length - limit))}
            </Button>
          )}
        </>
      )}
      <Sheet
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) {
            request.current++
            setSelected(null)
            setSummary(null)
            setError(null)
          }
        }}
      >
        <SheetContent className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
          <SheetHeader className="border-b p-5">
            <SheetTitle className="pr-5">
              {selected?.fullName || selected?.email || copy.title}
            </SheetTitle>
            <SheetDescription>{copy.progress.description}</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-3">
            {selected && summary ? (
              <Tabs defaultValue="overview" className="gap-4">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="overview">{copy.progress.overviewTab}</TabsTrigger>
                  <TabsTrigger value="credits">{copy.progress.creditsTab}</TabsTrigger>
                </TabsList>
                <TabsContent value="overview" className="animate-in fade-in-0 duration-200">
                  <StudentProgressSummary
                    summary={summary}
                    studentId={selected.id}
                    locale={locale}
                    t={t}
                  />
                </TabsContent>
                <TabsContent value="credits" className="animate-in fade-in-0 duration-200">
                  <StudentCredits
                    key={selected.id}
                    student={selected}
                    initialSummary={summary.credits}
                    onSummaryChange={(credits) => {
                      const previous = summary.credits
                      setSummary((current) => (current ? { ...current, credits } : current))
                      if (
                        credits.granted !== previous.granted ||
                        credits.used !== previous.used ||
                        credits.remaining !== previous.remaining
                      ) {
                        router.refresh()
                      }
                    }}
                    locale={locale}
                    t={t}
                  />
                </TabsContent>
              </Tabs>
            ) : pending ? (
              <p className="text-muted-foreground flex items-center gap-2 p-3 text-sm">
                <Loader2Icon className="size-4 animate-spin" />
                {t.common.loading}
              </p>
            ) : error ? (
              <div role="alert" className="space-y-3 p-3">
                <p className="text-destructive text-sm">{error}</p>
                <Button
                  variant="outline"
                  className="corner-brackets"
                  onClick={() => {
                    if (selected) choose(selected)
                  }}
                >
                  {t.common.retry}
                </Button>
              </div>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </section>
  )
}
