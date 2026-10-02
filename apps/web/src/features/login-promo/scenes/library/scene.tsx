'use client'

import { CheckIcon, ChevronDownIcon, SearchIcon } from 'lucide-react'
import { LevelChip } from '@/features/library/components/level-chip'
import { cn } from '@/lib/utils'
import { useCue } from '../../engine/clock'
import { staggered } from '../../engine/motion'
import { PromoPointer, type PointerStep } from '../../engine/pointer'
import { SceneFrame } from '../../engine/scene-frame'
import type { LibraryCopy } from './copy'
import { LEVELS, PICKED_LEVEL } from './data'

/** The beats, in ms from the scene's start. The fragment arrives at 1060. */
const AT = {
  /** The pointer fades in at the lower right… */
  pointerIn: 1500,
  /** …and glides to the level picker (500 ms). */
  toPicker: 1550,
  /** Press: the list opens over the picker, its current choice ticked. */
  open: 2320,
  /** Down the list to B1 (400 ms), lighting each row it crosses. */
  toLevel: 2620,
  /** Press: B1 is chosen, the list closes, and the shelf dims while it loads. */
  pick: 3300,
  pointerOut: 3540,
  /** The dimmed cards leave (120 ms)… */
  leave: 3720,
  /** …and the B1 lessons rise in their place, 35 ms apart. Settled by ~4370. */
  land: 3840,
} as const

/**
 * When the pointer enters A1, A2 and B1 on its way down. On the house curve it covers
 * most of the distance early, so it sweeps the first rows and slows onto its target.
 */
const CROSSED = [AT.toLevel + 15, AT.toLevel + 52, AT.toLevel + 120]

const POINTER: PointerStep[] = [
  { at: AT.pointerIn, appear: { x: 468, y: 600 } },
  { at: AT.toPicker, to: 'level', duration: 500 },
  { at: AT.open, press: true },
  { at: AT.toLevel, to: 'level-pick', duration: 400 },
  { at: AT.pick, press: true },
  { at: AT.pointerOut, leave: true },
]

/** How the old cards go when the new ones are in: up 4px and out, before anything rises. */
const LEAVING_CARDS =
  'animate-out fade-out-0 slide-out-to-top-1 fill-mode-forwards duration-120 ease-[cubic-bezier(0.22,1,0.36,1)]'

/**
 * The library: the platform's lessons on their shelf, narrowed to one level.
 *
 * Drawn from library-browser.tsx and material-card.tsx — the shelf tabs, the search, the
 * level picker and the two-column grid of cards — with the page title left to the frame's
 * caption. The column is narrower than the page, so the control row wraps once, the way a
 * wrapping flex row does.
 */
export function LibraryScene({ copy }: { copy: LibraryCopy }) {
  return (
    <SceneFrame title={copy.title} line={copy.line} overlay={<PromoPointer script={POINTER} />}>
      <div className="flex h-full flex-col gap-4 pb-[88px]">
        <div className="flex flex-col items-start gap-2">
          <ShelfTabs tabs={copy.tabs} />

          <div className="flex w-full items-center gap-2">
            <SearchField placeholder={copy.search} />
            <LevelPicker allLevels={copy.allLevels} />
          </div>
        </div>

        <Shelf copy={copy} />
      </div>
    </SceneFrame>
  )
}

const TAB =
  'relative z-10 inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-transparent px-3 py-0.5 text-xs font-medium'

/** TabsList with the platform shelf chosen; its sliding pill drawn on the chosen tab. */
function ShelfTabs({ tabs }: { tabs: LibraryCopy['tabs'] }) {
  return (
    <div className="bg-muted text-muted-foreground relative inline-flex h-8 w-fit items-center justify-center rounded-full p-1">
      <span
        className={cn(
          TAB,
          'bg-background text-foreground dark:border-input dark:bg-input/30 shadow-sm',
        )}
      >
        {tabs.platform}
      </span>
      <span className={cn(TAB, 'text-foreground/60 dark:text-muted-foreground')}>{tabs.mine}</span>
      <span className={cn(TAB, 'text-foreground/60 dark:text-muted-foreground')}>{tabs.all}</span>
    </div>
  )
}

/** The round search field, empty: this teacher arrives at a level, not at a query. */
function SearchField({ placeholder }: { placeholder: string }) {
  return (
    <div className="relative min-w-0 flex-1">
      <SearchIcon className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2" />

      <div className="border-input bg-background dark:bg-input/30 text-muted-foreground flex h-8 w-full min-w-0 items-center rounded-full border py-1 pl-8 pr-8 text-sm">
        <span className="truncate">{placeholder}</span>
      </div>
    </div>
  )
}

/**
 * The level Select. It opens the way the product's does — item-aligned, the current choice
 * laid over the trigger and the levels under it, no animation — and closes on the pick.
 */
function LevelPicker({ allLevels }: { allLevels: string }) {
  const state = useCue([AT.open, AT.pick])
  const open = state === 1
  const picked = state === 2
  const lit = useCue(CROSSED)
  const options = [allLevels, ...LEVELS]

  return (
    <div className="relative shrink-0">
      {/* 130px as in the product, but never narrower than its label: the product's own
          trigger clips "Tüm seviyeler" in the Turkish reading aid. */}
      <div className="border-input bg-background dark:bg-input/30 relative flex h-8 w-fit min-w-[130px] select-none items-center justify-between gap-1.5 whitespace-nowrap rounded-full border py-2 pl-2.5 pr-2 text-sm">
        <span className="line-clamp-1 flex items-center gap-1.5">
          {picked ? PICKED_LEVEL : allLevels}
        </span>
        <ChevronDownIcon className="text-muted-foreground pointer-events-none size-4 shrink-0" />
        {/* Where the click lands: past the label and a little low, so the arrow never
            sits on the words it is choosing between. */}
        <span data-anchor="level" className="absolute left-[60%] top-[72%] size-px" />
      </div>

      {open ? (
        <div className="bg-popover text-popover-foreground ring-foreground/10 absolute right-0 top-0.5 z-50 min-w-36 overflow-hidden rounded-lg shadow-md ring-1">
          {options.map((option, index) => (
            <div
              key={option}
              data-anchor={option === PICKED_LEVEL ? 'level-pick' : undefined}
              className={cn(
                'relative flex w-full cursor-default select-none items-center gap-1.5 rounded-md py-1 pl-1.5 pr-8 text-sm',
                index === lit && 'bg-accent text-accent-foreground',
              )}
            >
              {index === 0 ? (
                <span className="pointer-events-none absolute right-2 flex size-4 items-center justify-center">
                  <CheckIcon className="size-4" />
                </span>
              ) : null}
              <span>{option}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

/**
 * The results, as LibraryBrowser holds them: on a new level the cards that are there dim
 * in place (`data-pending`, 45%) rather than being torn out, then the new ones rise.
 *
 * Three rows and the top edge of a fourth, fading out: the shelf carries on below, and
 * what shows of it stops short of the next titles rather than slicing through them.
 */
function Shelf({ copy }: { copy: LibraryCopy }) {
  const phase = useCue([AT.pick, AT.leave, AT.land])
  const pending = phase === 1 || phase === 2
  const landed = phase === 3
  const lessons = landed ? copy.picked : copy.shelf

  return (
    // Clipped from 4px above the grid, so the leaving cards' lift is not cut off.
    <div className="-mt-1 max-h-[377px] min-h-0 flex-1 overflow-hidden pt-1 [mask-image:linear-gradient(to_bottom,black_calc(100%-28px),transparent)]">
      <div
        data-pending={pending ? '' : undefined}
        className="data-pending:opacity-45 transition-opacity duration-200 motion-reduce:transition-none"
      >
        <div
          key={landed ? 'picked' : 'shelf'}
          className={cn('grid grid-cols-2 gap-3', phase === 2 && LEAVING_CARDS)}
        >
          {lessons.map((lesson, index) => (
            <ShelfCard key={lesson.id} lesson={lesson} index={index} />
          ))}
        </div>
      </div>
    </div>
  )
}

/** MaterialCard: the title, then one quiet line — level, steps, the length estimate. */
function ShelfCard({ lesson, index }: { lesson: LibraryCopy['shelf'][number]; index: number }) {
  return (
    <article
      style={staggered(index)}
      className="border-border/60 bg-card animate-rise-in relative flex flex-col gap-3 rounded-2xl border p-4"
    >
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-balance text-[15px] font-medium leading-snug">{lesson.title}</h2>
        {/* The "···" menu shows on hover; at rest it is only the room it keeps. */}
        <div className="-mr-1 -mt-1 size-7 shrink-0" />
      </div>

      <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
        <LevelChip level={lesson.level} />
        <span className="tabular-nums">{lesson.meta}</span>
      </div>
    </article>
  )
}
