import { PlusIcon } from 'lucide-react'
import { listMaterialsQuery } from '@tp/shared'
import { Button } from '@/components/ui/button'
import { createDraft } from '@/features/library/actions'
import { listMaterials } from '@/features/library/api'
import { LibraryBrowser } from '@/features/library/components/library-browser'
import { MaterialGrid } from '@/features/library/components/material-grid'
import { requireViewer } from '@/lib/auth'
import { getMessages } from '@/messages/server'

export default async function LibraryPage({ searchParams }: PageProps<'/library'>) {
  const [viewer, t, raw] = await Promise.all([requireViewer(), getMessages(), searchParams])

  // A hand-edited query string should not blank the page. Anything unparseable falls back
  // to what the schema already defines.
  const parsed = listMaterialsQuery.safeParse(raw)
  const base = parsed.success ? parsed.data : listMaterialsQuery.parse({})

  // The schema's default is "everything I can see", which is right for an API client. The
  // page has two tabs and no third state, so it starts on the official library.
  const query = {
    ...base,
    scope: base.scope === 'mine' ? ('mine' as const) : ('platform' as const),
  }

  const { data, meta } = await listMaterials(query)

  const filtering = Boolean(query.query || query.level || query.tag)
  const empty = filtering
    ? t.library.empty.search
    : query.scope === 'mine'
      ? t.library.empty.mine
      : t.library.empty.platform

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-baseline gap-2 text-2xl font-semibold">
            {t.library.title}
            <span className="text-muted-foreground text-lg font-normal tabular-nums">
              ({meta.total})
            </span>
          </h1>

          {/* Says which shelf you are on rather than describing the feature. The tab and
              this line are one sentence between them. */}
          <p className="text-muted-foreground text-sm">{t.library.subtitle[query.scope]}</p>
        </div>

        {/* The page's one real action, level with its title. No dialog behind it: it
            makes a draft and takes you into it, because a form in front of a blank canvas
            only delays reaching the canvas. */}
        <form action={createDraft}>
          <Button type="submit" size="sm" className="corner-brackets">
            <PlusIcon />
            {t.library.actions.create}
          </Button>
        </form>
      </div>

      <LibraryBrowser query={query} meta={meta} t={t}>
        <MaterialGrid materials={data} locale={viewer.locale} empty={empty} t={t} />
      </LibraryBrowser>
    </>
  )
}
