'use client'

import { useOptimistic, useState, useTransition } from 'react'
import { ClipboardListIcon, RotateCcwIcon, Trash2Icon, XIcon } from 'lucide-react'
import { toast } from 'sonner'
import { purgeDate, type MaterialListItem } from '@tp/shared'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { formatRelative } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Messages } from '@/messages'
import { purgeBinned, restoreBinned } from '../actions'
import { LevelChip } from './level-chip'
import { PurgeDialog } from './purge-dialog'

const GRID = 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4'

/** Cards after the eighth arrive together; a long shelf should land, not trickle. */
const STAGGER_CAP = 8
const STAGGER_MS = 35

/** Whether a binned lesson is within its last three days. */
function purgeSoon(deletedAt: string): boolean {
  return purgeDate(deletedAt).getTime() - Date.now() < 3 * 86_400_000
}

const without = (set: Set<string>, ids: string[]) => {
  const next = new Set(set)
  for (const id of ids) next.delete(id)
  return next
}

/**
 * The bin's shelf. A card here is a thing to pick rather than a thing to open: clicking it
 * selects it, and a bar rises from the bottom offering to put the selection back or to
 * destroy it. Each card also carries the two actions on its own, for the common case of
 * one lesson thrown away by mistake.
 *
 * What is acted on leaves the grid at once and comes back only if the server refuses —
 * a card that lingers, greyed, until a round trip completes reads as a click that did
 * not take.
 */
export function BinGrid({
  materials,
  locale,
  t,
}: {
  materials: MaterialListItem[]
  locale: string
  t: Messages
}) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [purging, setPurging] = useState<string[] | null>(null)
  const [, startTransition] = useTransition()

  // Reverts on its own once the navigation lands, by which point the rows are really gone.
  const [hidden, hide] = useOptimistic<string[], string[]>([], (state, ids) => [...state, ...ids])

  const shown = materials.filter((material) => !hidden.includes(material.id))
  const present = new Set(shown.map((material) => material.id))
  // Ids that were selected and have since left the grid do not count.
  const chosen = [...selected].filter((id) => present.has(id))
  const selecting = chosen.length > 0

  const homeworkIn = (ids: string[]) =>
    materials
      .filter((material) => ids.includes(material.id))
      .reduce((sum, material) => sum + (material.homeworkCount ?? 0), 0)

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function restore(ids: string[]) {
    startTransition(async () => {
      hide(ids)
      const { restored, error } = await restoreBinned(ids)

      if (error) {
        toast.error(t.library.toast.failed)
        return
      }

      toast.success(
        ids.length === 1
          ? t.library.toast.restored
          : `${t.library.trash.toast.restoredMany}: ${restored}`,
      )
      setSelected((current) => without(current, ids))
    })
  }

  function purge(ids: string[]) {
    startTransition(async () => {
      hide(ids)
      const { deleted, error } = await purgeBinned(ids)

      if (error) {
        toast.error(t.library.toast.failed)
        return
      }

      toast.success(
        ids.length === 1
          ? t.library.trash.toast.purged
          : `${t.library.trash.toast.purgedMany}: ${deleted}`,
      )
      setSelected((current) => without(current, ids))
    })
  }

  if (shown.length === 0) {
    return (
      <div className="border-border/60 bg-card flex flex-col items-center gap-3 rounded-2xl border px-6 py-14 text-center">
        <span className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-full">
          <Trash2Icon className="size-4" />
        </span>
        <p className="text-sm font-medium">{t.library.empty.bin}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div data-selecting={selecting || undefined} className={cn('group/grid', GRID)}>
        {shown.map((material, index) => {
          const isSelected = selected.has(material.id)
          const homework = material.homeworkCount ?? 0

          return (
            <article
              key={material.id}
              role="checkbox"
              aria-checked={isSelected}
              aria-label={`${t.library.trash.select}: ${material.title}`}
              tabIndex={0}
              data-selected={isSelected || undefined}
              onClick={() => toggle(material.id)}
              onKeyDown={(event) => {
                if (event.key === ' ' || event.key === 'Enter') {
                  event.preventDefault()
                  toggle(material.id)
                }
              }}
              style={{ animationDelay: `${Math.min(index, STAGGER_CAP) * STAGGER_MS}ms` }}
              className="group/card border-border/60 bg-card hover:bg-muted/40 data-selected:border-primary/50 data-selected:bg-primary/5 data-selected:ring-primary/25 focus-visible:ring-ring/50 animate-rise-in data-selected:ring-1 relative flex cursor-pointer select-none flex-col gap-3 rounded-2xl border p-4 outline-none transition-[color,background-color,border-color,box-shadow] focus-visible:ring-2 motion-reduce:animate-none"
            >
              <div className="flex items-start gap-3">
                {/* A mark rather than a control: the card is the control. It shows on hover,
                    and stays shown while anything is selected, so the second pick is as
                    easy to find as the first. */}
                <Checkbox
                  checked={isSelected}
                  tabIndex={-1}
                  aria-hidden
                  className="group-data-selecting/grid:opacity-100 data-checked:opacity-100 pointer-events-none mt-0.5 opacity-0 transition-opacity group-hover/card:opacity-100 max-sm:opacity-100"
                />

                <h2 className="flex-1 text-balance text-[15px] font-medium leading-snug">
                  {material.title}
                </h2>

                <div className="-mr-2 -mt-1.5 flex shrink-0 items-center opacity-0 transition-opacity focus-within:opacity-100 group-hover/card:opacity-100 max-sm:opacity-100">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t.library.actions.restore}
                    title={t.library.actions.restore}
                    onClick={(event) => {
                      event.stopPropagation()
                      restore([material.id])
                    }}
                    className="text-muted-foreground hover:text-foreground size-7"
                  >
                    <RotateCcwIcon className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t.library.trash.deleteForever}
                    title={t.library.trash.deleteForever}
                    onClick={(event) => {
                      event.stopPropagation()
                      setPurging([material.id])
                    }}
                    className="text-muted-foreground size-7 hover:text-red-700 dark:hover:text-red-300"
                  >
                    <Trash2Icon className="size-4" />
                  </Button>
                </div>
              </div>

              <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                <LevelChip level={material.level} />
                <span className="tabular-nums">
                  {material.stepCount} {t.library.card.steps}
                  {material.durationMinutes
                    ? ` · ≈ ${material.durationMinutes} ${t.library.card.minutes}`
                    : ''}
                </span>
              </div>

              {material.deletedAt ? (
                <p className="text-muted-foreground text-xs">
                  {t.library.trash.deletedAt} {formatRelative(material.deletedAt, locale)}
                  {' · '}
                  <span
                    className={cn(
                      purgeSoon(material.deletedAt) && 'text-red-700 dark:text-red-300',
                    )}
                  >
                    {t.library.trash.purge}{' '}
                    {formatRelative(purgeDate(material.deletedAt).toISOString(), locale)}
                  </span>
                </p>
              ) : null}

              {/* Said on the card, not only in the confirm: a lesson with marked homework
                  behind it is one to think twice about before even selecting. */}
              {homework > 0 ? (
                <p className="text-muted-foreground flex items-center gap-1.5 text-xs tabular-nums">
                  <ClipboardListIcon className="size-3.5" />
                  {t.library.trash.homework}: {homework}
                </p>
              ) : null}
            </article>
          )
        })}
      </div>

      {/* Rises when the first card is picked and follows the viewport while more are. */}
      {selecting ? (
        <div className="animate-in fade-in-0 slide-in-from-bottom-2 sticky bottom-4 z-20 flex justify-center duration-200 motion-reduce:animate-none">
          <div className="bg-background/90 supports-[backdrop-filter]:bg-background/75 border-border/60 flex items-center gap-1 rounded-full border px-2 py-1.5 shadow-lg backdrop-blur">
            <span className="px-2 text-sm tabular-nums">
              {chosen.length} {t.library.trash.selected}
            </span>

            <Separator
              orientation="vertical"
              className="data-vertical:h-5 data-vertical:self-auto"
            />

            <Button type="button" variant="ghost" size="sm" onClick={() => restore(chosen)}>
              <RotateCcwIcon />
              {t.library.actions.restore}
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setPurging(chosen)}
              className="text-red-700 hover:text-red-700 dark:text-red-300 dark:hover:text-red-300"
            >
              <Trash2Icon />
              {t.library.trash.deleteForever}
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t.library.trash.clearSelection}
              onClick={() => setSelected(new Set())}
              className="text-muted-foreground size-7"
            >
              <XIcon className="size-4" />
            </Button>
          </div>
        </div>
      ) : null}

      <PurgeDialog
        open={purging !== null}
        onOpenChange={(open) => {
          if (!open) setPurging(null)
        }}
        count={purging?.length ?? 0}
        homework={purging ? homeworkIn(purging) : 0}
        onConfirm={() => {
          if (purging) purge(purging)
          setPurging(null)
        }}
        t={t}
      />
    </div>
  )
}
