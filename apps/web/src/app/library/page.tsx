import { PlusIcon } from 'lucide-react'
import { listMaterialsQuery, type ListMaterialsQuery } from '@tp/shared'
import { Button } from '@/components/ui/button'
import { listRecipients } from '@/features/homework/api'
import { createDraft } from '@/features/library/actions'
import { listMaterials } from '@/features/library/api'
import { LibraryBrowser } from '@/features/library/components/library-browser'
import { MaterialGrid } from '@/features/library/components/material-grid'
import { requireViewer } from '@/lib/auth'
import { counted } from '@/lib/format'
import type { Messages } from '@/messages'
import { getMessages } from '@/messages/server'

export default async function LibraryPage({ searchParams }: PageProps<'/library'>) {
  const [viewer, t, raw] = await Promise.all([requireViewer(), getMessages(), searchParams])

  // A hand-edited query string should not blank the page. Anything unparseable falls back
  // to what the schema already defines.
  const parsed = listMaterialsQuery.safeParse(raw)
  const base = parsed.success ? parsed.data : listMaterialsQuery.parse({})

  // The schema's default is "everything I can see", which is right for an API client. The
  // page has two tabs and no third state, so it starts on the official library.
  const query: ListMaterialsQuery = {
    ...base,
    scope: base.scope === 'mine' ? 'mine' : 'platform',
  }

  const filtering = Boolean(query.query || query.level || query.tag)

  // The shelf, the students any card on it could be given to, and — on your own shelf —
  // how many of the lessons are still drafts, which is the one number worth a word.
  const [{ data, meta }, recipients, drafts] = await Promise.all([
    listMaterials(query),
    listRecipients(),
    query.scope === 'mine' && !filtering
      ? listMaterials({ ...query, status: 'draft', page: 1, perPage: 1 }).then(
          (result) => result.meta.total,
        )
      : 0,
  ])

  const empty = filtering
    ? { title: t.library.empty.search }
    : query.scope === 'mine'
      ? { title: t.library.empty.mine, hint: t.library.empty.mineHint }
      : { title: t.library.empty.platform }

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-baseline gap-2 text-2xl font-semibold tracking-tight">
            {t.library.title}
            <span className="text-muted-foreground text-lg font-normal tabular-nums">
              ({meta.total})
            </span>
          </h1>

          <p className="text-muted-foreground text-sm tabular-nums">
            {statusLine({ query, total: meta.total, drafts, filtering, locale: viewer.locale, t })}
          </p>
        </div>

        {/* The page's one filled action, level with its title. No dialog behind it: it
            makes a draft and takes you into it, because a form in front of a blank canvas
            only delays reaching the canvas. */}
        <form action={createDraft}>
          <Button type="submit">
            <PlusIcon />
            {t.library.actions.create}
          </Button>
        </form>
      </div>

      <LibraryBrowser query={query} meta={meta} t={t}>
        <MaterialGrid
          materials={data}
          recipients={recipients}
          isAdmin={viewer.role === 'admin'}
          empty={empty}
          footnote={t.library.footnote[query.scope === 'mine' ? 'mine' : 'platform']}
          t={t}
        />
      </LibraryBrowser>
    </>
  )
}

/** "У бібліотеці платформи 8 уроків", "У вас 5 уроків · 2 чернетки", or what the search found. */
function statusLine({
  query,
  total,
  drafts,
  filtering,
  locale,
  t,
}: {
  query: ListMaterialsQuery
  total: number
  drafts: number
  filtering: boolean
  locale: string
  t: Messages
}): string {
  const lessons = counted(total, t.library.units.lessons, locale)

  if (filtering) return `${t.library.status.matching} ${lessons}`
  if (query.scope === 'platform') return `${t.library.status.platform} ${lessons}`

  const parts = [`${t.library.status.mine} ${lessons}`]
  if (drafts > 0) parts.push(counted(drafts, t.library.status.drafts, locale))

  return parts.join(' · ')
}
