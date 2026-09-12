import { redirect } from 'next/navigation'
import { listAssignmentsQuery } from '@tp/shared'
import { listAssignments, summariseAssignments } from '@/features/homework/api'
import { HomeworkBrowser } from '@/features/homework/components/homework-browser'
import { StudentHomeworkList } from '@/features/homework/components/student-homework-list'
import { requireRole } from '@/lib/auth'
import { getMessages } from '@/messages/server'

export default async function StudentHomeworkPage({
  searchParams,
}: PageProps<'/student/homework'>) {
  const [viewer, t, raw] = await Promise.all([requireRole('student'), getMessages(), searchParams])
  // Student scope is fixed by the API. Only expose controls that are meaningful here.
  const parsed = listAssignmentsQuery.safeParse({
    status: raw.status,
    overdue: raw.overdue,
    page: raw.page,
    perPage: 10,
  })
  const query = parsed.success ? parsed.data : listAssignmentsQuery.parse({ perPage: 10 })
  const [{ data, meta }, summary] = await Promise.all([
    listAssignments(query),
    summariseAssignments({}),
  ])
  const lastPage = Math.max(1, Math.ceil(meta.total / meta.perPage))
  if (query.page > lastPage) {
    const params = new URLSearchParams({ page: String(lastPage) })
    if (query.status) params.set('status', query.status)
    if (query.overdue) params.set('overdue', 'true')
    redirect(`/student/homework?${params}`)
  }
  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t.studentHome.homework}</h1>
        <p className="text-muted-foreground mt-1.5 text-sm">{t.student.description}</p>
      </div>
      <HomeworkBrowser query={query} meta={meta} summary={summary} t={t} student>
        <div className="overflow-hidden rounded-xl border">
          <StudentHomeworkList
            items={data}
            t={t}
            locale={viewer.locale}
            empty={
              query.status || query.overdue ? t.studentHome.emptyFiltered : t.homework.studentEmpty
            }
          />
        </div>
      </HomeworkBrowser>
    </>
  )
}
