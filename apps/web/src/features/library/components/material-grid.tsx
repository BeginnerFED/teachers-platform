import { LibraryBigIcon } from 'lucide-react'
import type { MaterialListItem, MaterialOwner } from '@tp/shared'
import { Skeleton } from '@/components/ui/skeleton'
import type { Messages } from '@/messages'
import { MaterialCard } from './material-card'

// A fourth column on a wide monitor. Three columns across 1900px gives each card more
// width than its two lines of text can fill, and the emptiness lands inside the card.
const GRID = 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4'

/** Cards after the eighth arrive together; a long shelf should land, not trickle. */
const STAGGER_CAP = 8
const STAGGER_MS = 35

export function MaterialGrid({
  materials,
  recipients,
  isAdmin,
  empty,
  footnote,
  t,
}: {
  materials: MaterialListItem[]
  /** The students each card's "give as homework" can offer. Fetched once, by the page. */
  recipients?: MaterialOwner[]
  /** Whether each card's menu offers the platform-library switch. */
  isAdmin?: boolean
  /** Already chosen by the page: "nothing here" and "nothing matched" are different. */
  empty: { title: string; hint?: string }
  /** The one rule worth knowing about this shelf, in small print under it. */
  footnote?: string
  t: Messages
}) {
  if (materials.length === 0) {
    return (
      <div className="border-border/60 bg-card flex flex-col items-center gap-3 rounded-2xl border px-6 py-14 text-center">
        <span className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-full">
          <LibraryBigIcon className="size-4" />
        </span>

        <div className="space-y-1">
          <p className="text-sm font-medium">{empty.title}</p>
          {empty.hint ? <p className="text-muted-foreground text-sm">{empty.hint}</p> : null}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className={GRID}>
        {materials.map((material, index) => (
          <MaterialCard
            key={material.id}
            material={material}
            recipients={recipients}
            isAdmin={isAdmin}
            delayMs={Math.min(index, STAGGER_CAP) * STAGGER_MS}
            t={t}
          />
        ))}
      </div>

      {footnote ? <p className="text-muted-foreground px-1 text-xs">{footnote}</p> : null}
    </div>
  )
}

/** Mirrors the card's shape so the swap does not move the page around. */
export function MaterialGridSkeleton({ cards = 6 }: { cards?: number }) {
  return (
    <div className={GRID}>
      {Array.from({ length: cards }, (_, index) => (
        <div
          key={index}
          className="border-border/60 bg-card flex flex-col gap-3 rounded-2xl border p-4"
        >
          <Skeleton className="h-5 w-3/4" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-9 rounded-full" />
            <Skeleton className="h-3 w-28" />
          </div>
        </div>
      ))}
    </div>
  )
}
