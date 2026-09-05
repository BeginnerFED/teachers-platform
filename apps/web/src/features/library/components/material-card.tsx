import Link from 'next/link'
import type { MaterialListItem, MaterialOwner } from '@tp/shared'
import type { Messages } from '@/messages'
import { LevelChip } from './level-chip'
import { MaterialCardMenu } from './material-card-menu'

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
  recipients = [],
  isAdmin = false,
  delayMs = 0,
  t,
}: {
  material: MaterialListItem
  /** Who the "give as homework" item can offer. */
  recipients?: MaterialOwner[]
  /** Whether to offer the platform-library switch. */
  isAdmin?: boolean
  /** Its place in the shelf's stagger as it arrives. */
  delayMs?: number
  t: Messages
}) {
  return (
    // `has-[[data-pending]]`: the menu button marks itself while a delete or copy is in
    // flight, and the card fades on that mark. The feedback lives where the click
    // happened rather than in a global spinner somewhere else on the page.
    <article
      style={{ animationDelay: `${delayMs}ms` }}
      className="border-border/60 bg-card hover:bg-muted/40 animate-rise-in group relative flex flex-col gap-3 rounded-2xl border p-4 transition-[background-color,opacity] has-[[data-pending]]:pointer-events-none has-[[data-pending]]:opacity-50 motion-reduce:animate-none"
    >
      <div className="flex items-start justify-between gap-2">
        {/* The whole card is the link, via the overlay — but the anchor is on the title
            so that what a screen reader announces is the lesson's name. */}
        <h2 className="text-balance text-[15px] font-medium leading-snug">
          <Link
            href={`/library/${material.id}`}
            className="before:absolute before:inset-0 before:content-['']"
          >
            {material.title}
          </Link>
        </h2>

        <div className="-mr-1 -mt-1 shrink-0">
          <MaterialCardMenu material={material} recipients={recipients} isAdmin={isAdmin} t={t} />
        </div>
      </div>

      <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
        <LevelChip level={material.level} />

        <span className="tabular-nums">
          {material.stepCount} {t.library.card.steps}
          {/* Estimated from the content, so a card is never silent about how long the
              lesson takes — and never has two figures for it. */}
          {material.durationMinutes
            ? ` · ≈ ${material.durationMinutes} ${t.library.card.minutes}`
            : ''}
        </span>

        {material.status === 'draft' ? (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
            {t.library.card.draft}
          </span>
        ) : null}
      </div>
    </article>
  )
}
