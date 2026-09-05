import { listStudentsQuery, listTeachersQuery } from '@tp/shared'
import { createStudent } from '@/features/accounts/actions'
import { NewAccountDialog } from '@/features/accounts/components/new-account-dialog'
import { TeacherField } from '@/features/roster/components/teacher-field'
import { listStudents } from '@/features/students/api'
import { listTeachers } from '@/features/teachers/api'
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

  // The teachers a new student could be placed with, fetched alongside the list so the
  // dialog opens with them ready. A handful of rows, not a directory.
  const [{ data, meta }, teachers] = await Promise.all([
    listStudents(query),
    listTeachers(listTeachersQuery.parse({ perPage: '100' })),
  ])

  return (
    <>
      {/* The page's one action, level with its title — where every other page keeps it. */}
      <div className="flex flex-wrap items-start justify-between gap-3">
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

        <NewAccountDialog
          label={t.students.add}
          title={t.students.create.title}
          description={t.students.create.description}
          duplicateMessage={t.students.create.duplicate}
          action={createStudent}
          fields={
            <TeacherField
              teachers={teachers.data.map((teacher) => ({
                id: teacher.id,
                fullName: teacher.fullName,
                email: teacher.email,
              }))}
              label={t.students.create.teacher}
              none={t.students.create.noTeacher}
            />
          }
          t={t}
        />
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
