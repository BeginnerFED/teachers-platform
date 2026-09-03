import Link from 'next/link'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { listAssignmentsQuery } from '@tp/shared'
import { Button } from '@/components/ui/button'
import { listAssignments } from '@/features/homework/api'
import { HomeworkTable } from '@/features/homework/components/homework-table'
import { requireViewer } from '@/lib/auth'
import { getMessages } from '@/messages/server'

/** The same skeleton as every list page: heading with its count, one line under it, the table. */
export default async function HomeworkPage({ searchParams }: PageProps<'/homework'>) {
  const [viewer, t, raw] = await Promise.all([requireViewer(), getMessages(), searchParams])

  const parsed = listAssignmentsQuery.safeParse(raw)
  const query = parsed.success ? parsed.data : listAssignmentsQuery.parse({})
  const { data, meta } = await listAssignments(query)

  const lastPage = Math.max(1, Math.ceil(meta.total / meta.perPage))

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="flex items-baseline gap-2 text-2xl font-semibold">
          {t.homework.title}
          <span className="text-muted-foreground text-lg font-normal tabular-nums">
            ({meta.total})
          </span>
        </h1>
        <p className="text-muted-foreground text-sm">{t.homework.description}</p>
      </div>

      <div className="rounded-md border">
        <HomeworkTable items={data} t={t} locale={viewer.locale} />

        {lastPage > 1 ? (
          <div className="text-muted-foreground flex items-center justify-between gap-3 border-t p-3 text-sm tabular-nums">
            <span>
              {meta.page} {t.students.pagination.of} {lastPage}
            </span>

            <div className="flex items-center gap-2">
              <Button
                asChild
                variant="outline"
                size="sm"
                className={meta.page <= 1 ? 'pointer-events-none opacity-50' : 'corner-brackets'}
              >
                <Link href={`/homework?page=${meta.page - 1}`} aria-disabled={meta.page <= 1}>
                  <ChevronLeftIcon className="size-4" />
                  {t.students.pagination.previous}
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="sm"
                className={
                  meta.page >= lastPage ? 'pointer-events-none opacity-50' : 'corner-brackets'
                }
              >
                <Link
                  href={`/homework?page=${meta.page + 1}`}
                  aria-disabled={meta.page >= lastPage}
                >
                  {t.students.pagination.next}
                  <ChevronRightIcon className="size-4" />
                </Link>
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </>
  )
}
