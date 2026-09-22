'use client'

import { ChevronLeftIcon, ChevronRightIcon, SearchIcon, XIcon } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useOptimistic, useRef, useTransition, type ReactNode } from 'react'
import { LEVELS, type ListMaterialsQuery, type MaterialScope, type PageMeta } from '@tp/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { Messages } from '@/messages'
import { useUrlSearchTerm } from '@/hooks/use-url-search-term'

const ALL = 'all'
const SEARCH_DEBOUNCE_MS = 350

/**
 * Filters, results and paging in one frame, the same shape the students list uses. It also
 * owns the pending state: the grid is server-rendered and arrives as children, so while a
 * new page is on its way the cards it already has dim rather than being torn out for a
 * skeleton — the frame stays still and the new ones fade up in place.
 *
 * The chosen shelf is held optimistically as well as in the URL. A navigation takes a
 * moment, and a tab that only moves once the server has answered feels like a tab that did
 * not register the click.
 */
export function LibraryBrowser({
  query,
  meta,
  t,
  children,
}: {
  query: ListMaterialsQuery
  meta: PageMeta
  t: Messages
  children: ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const urlTerm = query.query ?? ''
  const navigationParams = useRef(searchParams.toString())
  const { term, setTerm, submitNow } = useUrlSearchTerm(
    urlTerm,
    (next) => navigate({ query: next }),
    SEARCH_DEBOUNCE_MS,
  )

  useEffect(() => {
    if (!pending) navigationParams.current = searchParams.toString()
  }, [pending, searchParams])

  // Reverts to the URL's answer on its own once the navigation lands, by which point the
  // two agree anyway.
  const [scope, setScope] = useOptimistic<MaterialScope>(query.scope)

  const lastPage = Math.max(1, Math.ceil(meta.total / meta.perPage))
  const from = meta.total === 0 ? 0 : (meta.page - 1) * meta.perPage + 1
  const to = Math.min(meta.page * meta.perPage, meta.total)

  function navigate(
    changes: Record<string, string | null>,
    {
      keepPage = false,
      optimistic,
    }: {
      keepPage?: boolean
      /** Runs inside the same transition, so a control can answer the click at once. */
      optimistic?: () => void
    } = {},
  ) {
    const next = new URLSearchParams(navigationParams.current)

    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === '') next.delete(key)
      else next.set(key, value)
    }

    // Changing what is being looked at returns to the first page; staying on page four of
    // a list that now has one page shows nothing at all.
    if (!keepPage) next.delete('page')

    navigationParams.current = next.toString()
    startTransition(() => {
      optimistic?.()
      router.replace(`${pathname}?${next}`, { scroll: false })
    })
  }

  return (
    // No outer box. The cards have their own edges, and a frame around a grid of framed
    // things reads as a box inside a box — which was most of why the page felt busy.
    <div className="flex flex-col gap-4">
      {/*
       * One row, left-aligned, every control the same 32px tall.
       *
       * It was three heights in a line — a 32px tab group beside a 36px field beside a
       * 36px select — with the create button pushed to the far edge by `ml-auto`, which
       * left eight hundred pixels of nothing in the middle. The button has moved up beside
       * the page title, which is where a page's main action belongs and which is what
       * empties this row of its stranded element.
       */}
      <div className="flex flex-wrap items-center gap-2">
        <Tabs
          value={scope}
          onValueChange={(next) =>
            navigate({ scope: next }, { optimistic: () => setScope(next as MaterialScope) })
          }
        >
          <TabsList>
            <TabsTrigger value="platform">{t.library.tabs.platform}</TabsTrigger>
            <TabsTrigger value="mine">{t.library.tabs.mine}</TabsTrigger>
            {/* Both shelves at once. The sidebar counts a level this way — everything this
                person can see — so without it the two would disagree about how many. */}
            <TabsTrigger value="all">{t.library.tabs.all}</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative flex-1 sm:max-w-[260px]">
          <SearchIcon className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2" />

          <Input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder={t.library.searchPlaceholder}
            aria-label={t.library.searchPlaceholder}
            className="h-8 rounded-full pl-8 pr-8"
          />

          {term ? (
            <button
              type="button"
              onClick={() => {
                submitNow('')
              }}
              aria-label={t.library.clear}
              className="text-muted-foreground hover:bg-muted hover:text-foreground absolute right-1.5 top-1/2 -translate-y-1/2 rounded-sm p-1 transition-colors"
            >
              <XIcon className="size-3.5" />
            </button>
          ) : null}
        </div>

        <Select
          value={query.level ?? ALL}
          onValueChange={(value) => navigate({ level: value === ALL ? null : value })}
        >
          <SelectTrigger className="h-8 w-[130px] rounded-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t.library.allLevels}</SelectItem>
            {LEVELS.map((level) => (
              <SelectItem key={level} value={level}>
                {level}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* A tag is arrived at by tapping one on a lesson's own page, so it appears here
            as something to remove rather than as a dropdown listing every tag anyone has
            ever typed. It is off the cards entirely — three chips per card was most of
            what made the grid noisy, and a tag is a thing you follow, not a thing you
            scan sixty of. */}
        {query.tag ? (
          <Button variant="secondary" onClick={() => navigate({ tag: null })} className="gap-1.5">
            {query.tag}
            <XIcon className="size-3" />
          </Button>
        ) : null}
      </div>

      {/* The cards that are already there stay there, dimmed, until the new ones arrive.
          Swapping them for a skeleton flashed the whole grid away and back for what is
          usually a couple of hundred milliseconds; this reads as the same list changing.
          The first load has no cards to keep, and loading.tsx draws the skeleton for it. */}
      <div
        data-pending={pending ? '' : undefined}
        className="data-pending:pointer-events-none data-pending:opacity-45 transition-opacity duration-200 motion-reduce:transition-none"
      >
        {children}
      </div>

      {lastPage > 1 ? (
        <div className="flex items-center justify-between gap-4">
          <p className="text-muted-foreground text-sm tabular-nums">
            {from}–{to} {t.students.pagination.of} {meta.total}
          </p>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              disabled={pending || meta.page <= 1}
              onClick={() => navigate({ page: String(meta.page - 1) }, { keepPage: true })}
            >
              <ChevronLeftIcon />
              {t.students.pagination.previous}
            </Button>

            <Button
              variant="ghost"
              disabled={pending || meta.page >= lastPage}
              onClick={() => navigate({ page: String(meta.page + 1) }, { keepPage: true })}
            >
              {t.students.pagination.next}
              <ChevronRightIcon />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
