'use client'

import { SearchIcon, XIcon } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'
import { SUBSCRIPTION_STATUSES, type ListTeachersQuery } from '@tp/shared'
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

const ALL = 'all'
const SEARCH_DEBOUNCE_MS = 350

/**
 * Filters live in the URL rather than in component state, so a filtered list can be
 * bookmarked, shared and reloaded, and the back button does what it looks like it does.
 * The server component re-runs on every change, which is what keeps the results honest.
 */
export function TeachersToolbar({ query, t }: { query: ListTeachersQuery; t: Messages }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [term, setTerm] = useState(query.query ?? '')
  const firstRender = useRef(true)

  function apply(changes: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams)

    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === '') next.delete(key)
      else next.set(key, value)
    }

    // Any change to what is being looked at returns to the first page; staying on page
    // four of a list that now has one page shows nothing at all.
    next.delete('page')

    startTransition(() => router.replace(`${pathname}?${next}`, { scroll: false }))
  }

  // Typing waits for a pause rather than firing a request per keystroke.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }

    const timer = setTimeout(() => {
      if (term !== (query.query ?? '')) apply({ query: term })
    }, SEARCH_DEBOUNCE_MS)

    return () => clearTimeout(timer)
    // apply is recreated each render; depending on it would restart the timer constantly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term])

  const filtered = Boolean(query.query || query.status)

  return (
    <div className="flex flex-wrap items-center gap-2" data-pending={pending ? '' : undefined}>
      <div className="relative flex-1 sm:max-w-xs">
        <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder={t.teachers.searchPlaceholder}
          className="pl-9"
          aria-label={t.teachers.searchPlaceholder}
        />
      </div>

      <Select
        value={query.status ?? ALL}
        onValueChange={(value) => apply({ status: value === ALL ? null : value })}
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

      {filtered ? (
        <Button
          variant="ghost"
          className="corner-brackets"
          onClick={() => {
            setTerm('')
            apply({ query: null, status: null })
          }}
        >
          <XIcon />
          {t.teachers.clear}
        </Button>
      ) : null}
    </div>
  )
}
