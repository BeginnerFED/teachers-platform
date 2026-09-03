import Link from 'next/link'
import type { MaterialListItem } from '@tp/shared'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/format'
import type { Messages } from '@/messages'
import { MaterialActions } from './material-actions'

/**
 * Two rows: what it is called, and one quiet line saying what it is. The card is as tall
 * as that and no taller.
 *
 * The height used to be fixed, which meant emptying the card of everything it did not
 * need just moved the clutter out and left a hole where it had been — three lines of text
 * spread over a box twice their size, which reads worse than the crowded version did.
 */
export function MaterialCard({
  material,
  locale,
  t,
}: {
  material: MaterialListItem
  locale: string
  t: Messages
}) {
  const binned = material.deletedAt !== null

  return (
    // `has-[[data-pending]]`: the menu button marks itself while a delete, restore or copy
    // is in flight, and the card fades on that mark. The feedback lives where the click
    // happened rather than in a global spinner somewhere else on the page.
    <article className="hover:border-foreground/20 hover:bg-muted/40 group relative flex flex-col gap-2.5 rounded-xl border p-4 transition-[color,background-color,border-color,opacity] has-[[data-pending]]:pointer-events-none has-[[data-pending]]:opacity-50">
      <div className="flex items-start justify-between gap-2">
        {/* The whole card is the link, via the overlay — but the anchor is on the title
            so that what a screen reader announces is the lesson's name. */}
        <h2 className="text-balance text-[15px] font-medium leading-snug">
          <Link
            href={binned ? '/library/trash' : `/library/${material.id}`}
            className="before:absolute before:inset-0 before:content-['']"
          >
            {material.title}
          </Link>
        </h2>

        {/* Out of the way until wanted. Always there on a touch screen, which has no
            hover to reveal it with. */}
        <div className="-mr-1 -mt-1 shrink-0 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 max-sm:opacity-100">
          <MaterialActions material={material} t={t} compact />
        </div>
      </div>

      <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="outline" className="px-1.5 py-0 font-mono text-[10px] font-normal">
          {material.level}
        </Badge>

        <span className="tabular-nums">
          {material.stepCount} {t.library.card.steps}
          {material.estimatedMinutes
            ? ` · ${material.estimatedMinutes} ${t.library.card.minutes}`
            : ''}
          {binned
            ? ` · ${t.library.trash.deletedAt} ${formatDate(material.deletedAt, locale)}`
            : ''}
        </span>

        {material.status === 'draft' && !binned ? (
          <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-normal">
            {t.library.card.draft}
          </Badge>
        ) : null}
      </div>
    </article>
  )
}
