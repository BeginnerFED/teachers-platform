import { listMaterialsQuery } from '@tp/shared'
import { listMaterials } from '@/features/library/api'
import { BinGrid } from '@/features/library/components/bin-grid'
import { BinHeaderActions } from '@/features/library/components/bin-header-actions'
import { requireViewer } from '@/lib/auth'
import { getMessages } from '@/messages/server'

/**
 * Nothing is ever destroyed by the delete button, and this is where it goes — for thirty
 * days, after which it is. Only your own: the API scopes the bin to its owner, and nobody
 * browses somebody else's. The way back to the shelf is the breadcrumb.
 */
export default async function LibraryTrashPage() {
  const [viewer, t] = await Promise.all([requireViewer(), getMessages()])

  const { data, meta } = await listMaterials(
    listMaterialsQuery.parse({ deleted: 'true', scope: 'mine', perPage: '100' }),
  )

  const homework = data.reduce((sum, material) => sum + (material.homeworkCount ?? 0), 0)

  return (
    // The header's buttons mark themselves while a whole-bin action is out, and the page
    // fades on the mark until the refreshed, emptier list lands.
    <div className="flex flex-col gap-6 transition-opacity has-[[data-pending]]:pointer-events-none has-[[data-pending]]:opacity-50">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-baseline gap-2 text-2xl font-semibold tracking-tight">
            {t.library.trash.title}
            <span className="text-muted-foreground text-lg font-normal tabular-nums">
              ({meta.total})
            </span>
          </h1>
          <p className="text-muted-foreground text-sm">{t.library.trash.description}</p>
        </div>

        <BinHeaderActions count={meta.total} homework={homework} t={t} />
      </div>

      <BinGrid materials={data} locale={viewer.locale} t={t} />
    </div>
  )
}
