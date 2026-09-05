import type { MaterialListItem, MaterialOwner } from '@tp/shared'
import { Skeleton } from '@/components/ui/skeleton'
import type { Messages } from '@/messages'
import { MaterialCard } from './material-card'

// A fourth column on a wide monitor. Three columns across 1900px gives each card more
// width than its two lines of text can fill, and the emptiness lands inside the card.
const GRID = 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4'

export function MaterialGrid({
  materials,
  recipients,
  isAdmin,
  empty,
  t,
}: {
  materials: MaterialListItem[]
  /** The students each card's "give as homework" can offer. Fetched once, by the page. */
  recipients?: MaterialOwner[]
  /** Whether each card's menu offers the platform-library switch. */
  isAdmin?: boolean
  /** Already chosen by the page: "nothing here" and "nothing matched" are different. */
  empty: string
  t: Messages
}) {
  if (materials.length === 0) {
    // Its own dashed frame, because the cards no longer sit inside a box that would
    // otherwise give an empty shelf an outline.
    return (
      <div className="text-muted-foreground flex min-h-40 items-center justify-center rounded-xl border border-dashed p-8 text-sm">
        {empty}
      </div>
    )
  }

  return (
    <div className={GRID}>
      {materials.map((material) => (
        <MaterialCard
          key={material.id}
          material={material}
          recipients={recipients}
          isAdmin={isAdmin}
          t={t}
        />
      ))}
    </div>
  )
}

/** Mirrors the card's shape so the swap does not move the page around. */
export function MaterialGridSkeleton({ cards = 6 }: { cards?: number }) {
  return (
    <div className={GRID}>
      {Array.from({ length: cards }, (_, index) => (
        <div key={index} className="flex flex-col gap-2.5 rounded-xl border p-4">
          <Skeleton className="h-5 w-3/4" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-8 rounded-full" />
            <Skeleton className="h-3 w-28" />
          </div>
        </div>
      ))}
    </div>
  )
}
