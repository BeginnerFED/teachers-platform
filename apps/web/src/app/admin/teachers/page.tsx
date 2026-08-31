import { listTeachersQuery } from '@tp/shared'
import { listTeachers } from '@/features/teachers/api'
import { TeacherTable } from '@/features/teachers/components/teacher-table'
import { requireViewer } from '@/lib/auth'
import { getMessages } from '@/messages/server'

export default async function TeachersPage({ searchParams }: PageProps<'/admin/teachers'>) {
  const [viewer, t, raw] = await Promise.all([requireViewer(), getMessages(), searchParams])

  // A hand-edited query string should not blank the page. Anything unparseable falls
  // back to the defaults the schema already defines.
  const parsed = listTeachersQuery.safeParse(raw)
  const query = parsed.success ? parsed.data : listTeachersQuery.parse({})

  const { data, meta } = await listTeachers(query)

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl">{t.teachers.title}</h1>
        <p className="text-muted-foreground text-sm">{t.teachers.description}</p>
      </div>

      <TeacherTable teachers={data} t={t} locale={viewer.locale} />

      <p className="text-muted-foreground text-sm">
        {t.teachers.total}: <span className="tabular-nums">{meta.total}</span>
      </p>
    </>
  )
}
