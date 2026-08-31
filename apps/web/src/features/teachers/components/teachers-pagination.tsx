'use client'

import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import type { PageMeta } from '@tp/shared'
import { Button } from '@/components/ui/button'
import type { Messages } from '@/messages'

export function TeachersPagination({ meta, t }: { meta: PageMeta; t: Messages }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()

  const lastPage = Math.max(1, Math.ceil(meta.total / meta.perPage))
  const from = meta.total === 0 ? 0 : (meta.page - 1) * meta.perPage + 1
  const to = Math.min(meta.page * meta.perPage, meta.total)

  // One page of results needs no controls; showing disabled arrows implies there is
  // somewhere to go.
  if (lastPage <= 1) return null

  function goTo(page: number) {
    const next = new URLSearchParams(searchParams)

    if (page <= 1) next.delete('page')
    else next.set('page', String(page))

    startTransition(() => router.replace(`${pathname}?${next}`, { scroll: false }))
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <p className="text-muted-foreground text-sm tabular-nums">
        {from}–{to} {t.teachers.pagination.of} {meta.total}
      </p>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="corner-brackets"
          disabled={pending || meta.page <= 1}
          onClick={() => goTo(meta.page - 1)}
        >
          <ChevronLeftIcon />
          {t.teachers.pagination.previous}
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="corner-brackets"
          disabled={pending || meta.page >= lastPage}
          onClick={() => goTo(meta.page + 1)}
        >
          {t.teachers.pagination.next}
          <ChevronRightIcon />
        </Button>
      </div>
    </div>
  )
}
