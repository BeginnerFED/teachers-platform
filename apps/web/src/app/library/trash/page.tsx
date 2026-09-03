import Link from 'next/link'
import { ArrowLeftIcon } from 'lucide-react'
import { listMaterialsQuery } from '@tp/shared'
import { Button } from '@/components/ui/button'
import { listMaterials } from '@/features/library/api'
import { MaterialGrid } from '@/features/library/components/material-grid'
import { requireViewer } from '@/lib/auth'
import { getMessages } from '@/messages/server'

/**
 * Nothing is ever really destroyed by the delete button, and this is where it goes. Only
 * your own: the API scopes the bin to its owner, and nobody browses somebody else's.
 */
export default async function LibraryTrashPage() {
  const [viewer, t] = await Promise.all([requireViewer(), getMessages()])

  const { data, meta } = await listMaterials(
    listMaterialsQuery.parse({ deleted: 'true', scope: 'mine', perPage: '50' }),
  )

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-baseline gap-2 text-2xl font-semibold">
            {t.library.trash.title}
            <span className="text-muted-foreground text-lg font-normal tabular-nums">
              ({meta.total})
            </span>
          </h1>
          <p className="text-muted-foreground text-sm">{t.library.trash.description}</p>
        </div>

        <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
          <Link href="/library">
            <ArrowLeftIcon />
            {t.library.trash.back}
          </Link>
        </Button>
      </div>

      <MaterialGrid materials={data} locale={viewer.locale} empty={t.library.empty.bin} t={t} />
    </>
  )
}
