import { listStudentsQuery } from '@tp/shared'
import { listStudents } from '@/features/students/api'
import { StudentsBrowser } from '@/features/students/components/students-browser'
import { StudentTable } from '@/features/students/components/student-table'
import { requireViewer } from '@/lib/auth'
import { getMessages } from '@/messages/server'

export default async function StudentsPage({ searchParams }: PageProps<'/admin/students'>) {
  const [viewer, t, raw] = await Promise.all([requireViewer(), getMessages(), searchParams])

  // A hand-edited query string should not blank the page. Anything unparseable falls
  // back to the defaults the schema already defines.
  const parsed = listStudentsQuery.safeParse(raw)
  const query = parsed.success ? parsed.data : listStudentsQuery.parse({})

  const { data, meta } = await listStudents(query)

  return (
    <>
      <div className="flex flex-col gap-1">
        {/* The count belongs beside the thing it counts, not stranded under the table
            where it reads as a footnote to whatever the last row happened to be. */}
        <h1 className="flex items-baseline gap-2 text-2xl font-semibold">
          {t.students.title}
          <span className="text-muted-foreground text-lg font-normal tabular-nums">
            ({meta.total})
          </span>
        </h1>
        <p className="text-muted-foreground text-sm">{t.students.description}</p>
      </div>

      <StudentsBrowser query={query} meta={meta} t={t}>
        <StudentTable
          students={data}
          t={t}
          locale={viewer.locale}
          filtering={Boolean(query.query || query.link)}
        />
      </StudentsBrowser>
    </>
  )
}
