'use client'

import { ChevronLeftIcon, ChevronRightIcon, SearchIcon, XIcon } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react'
import { SUBSCRIPTION_STATUSES, type ListTeachersQuery, type PageMeta } from '@tp/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Messages } from '@/messages'
import { statusLabel } from '../format'
import { TeachersTableSkeleton } from './teachers-table-skeleton'

const ALL = 'all'
const SEARCH_DEBOUNCE_MS = 350

/**
 * Search, results and paging in one card, because they are one thing: controls floating
 * above a table read as unrelated to it.
 *
 * It also owns the pending state. The table is server-rendered and arrives as children,
 * so while a new page is on its way this swaps it for a skeleton — the rows change under
 * a steady frame instead of the whole screen appearing to reload.
 */
export function TeachersBrowser({
  query,
  meta,
  t,
  children,
}: {
  query: ListTeachersQuery
  meta: PageMeta
  t: Messages
  children: ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [term, setTerm] = useState(query.query ?? '')
  const firstRender = useRef(true)

  const lastPage = Math.max(1, Math.ceil(meta.total / meta.perPage))
  const from = meta.total === 0 ? 0 : (meta.page - 1) * meta.perPage + 1
  const to = Math.min(meta.page * meta.perPage, meta.total)

  function navigate(changes: Record<string, string | null>, { keepPage = false } = {}) {
    const next = new URLSearchParams(searchParams)

    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === '') next.delete(key)
      else next.set(key, value)
    }

    // Changing what is being looked at returns to the first page; staying on page four
    // of a list that now has one page shows nothing at all.
    if (!keepPage) next.delete('page')

    startTransition(() => router.replace(`${pathname}?${next}`, { scroll: false }))
  }

  // Typing waits for a pause rather than firing a request per keystroke.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }

    const timer = setTimeout(() => {
      if (term !== (query.query ?? '')) navigate({ query: term })
    }, SEARCH_DEBOUNCE_MS)

    return () => clearTimeout(timer)
    // navigate is rebuilt every render; depending on it would restart the timer forever.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term])

  return (
    <div className="rounded-md border">
      <div className="flex flex-wrap items-center gap-2 border-b p-3">
        <div className="relative flex-1 sm:max-w-xs">
          <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />

          <Input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder={t.teachers.searchPlaceholder}
            aria-label={t.teachers.searchPlaceholder}
            className="pr-9 pl-9"
          />

          {/* Inside the field, so it plainly clears the field. A separate button beside
              two controls never says which of them it is for. */}
          {term ? (
            <button
              type="button"
              onClick={() => {
                setTerm('')
                navigate({ query: null })
              }}
              aria-label={t.teachers.clear}
              className="text-muted-foreground hover:bg-muted hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2 rounded-sm p-1 transition-colors"
            >
              <XIcon className="size-3.5" />
            </button>
          ) : null}
        </div>

        <Select
          value={query.status ?? ALL}
          onValueChange={(value) => navigate({ status: value === ALL ? null : value })}
        >
          <SelectTrigger className="w-[190px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t.teachers.filterAll}</SelectItem>
            {SUBSCRIPTION_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {statusLabel(status, t)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {pending ? <TeachersTableSkeleton rows={Math.min(meta.perPage, 8)} /> : children}

      {lastPage > 1 ? (
        <div className="flex items-center justify-between gap-4 border-t p-3">
          <p className="text-muted-foreground text-sm tabular-nums">
            {from}–{to} {t.teachers.pagination.of} {meta.total}
          </p>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="corner-brackets"
              disabled={pending || meta.page <= 1}
              onClick={() => navigate({ page: String(meta.page - 1) }, { keepPage: true })}
            >
              <ChevronLeftIcon />
              {t.teachers.pagination.previous}
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="corner-brackets"
              disabled={pending || meta.page >= lastPage}
              onClick={() => navigate({ page: String(meta.page + 1) }, { keepPage: true })}
            >
              {t.teachers.pagination.next}
              <ChevronRightIcon />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
