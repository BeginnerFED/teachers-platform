'use client'

import type { ReactNode } from 'react'
import { AlertTriangleIcon, CalendarCheck2Icon, ClipboardCheckIcon, XIcon } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useCount } from '../../engine/clock'
import { STAGGER_CAP, STAGGER_MS, staggered } from '../../engine/motion'
import { DEFAULT_TIMING, SceneFrame } from '../../engine/scene-frame'
import type { ProgressCopy } from './copy'
import { OLYA } from './data'

/**
 * What the drawer holds starts rising just after the drawer itself (the real Sheet fades
 * and slides for 200 ms), so the rows fill in as it becomes visible and it never shows as
 * an empty card: one arrival, not two.
 */
const BODY_DELAY = 40

/** The facts count up while their section rises: short, so it reads as settling, not as a show. */
const COUNT_MS = 380

/** When the nth part of the drawer's body starts to rise, in scene time. */
function bodyAt(index: number): number {
  return DEFAULT_TIMING.fragmentAt + BODY_DELAY + Math.min(index, STAGGER_CAP) * STAGGER_MS
}

/** TabsTrigger's classes (components/ui/tabs.tsx); the active one wears the list's white pill. */
const TRIGGER =
  'relative z-10 inline-flex h-[calc(100%-1px)] items-center justify-center gap-1.5 rounded-full border border-transparent px-3 py-0.5 text-xs font-medium whitespace-nowrap'

/**
 * The student overview drawer, opened from «Мої учні» on the teacher's home: a picture of
 * QuickStudents' Sheet with StudentProgressSummary inside it, drawn with their own classes
 * and copy (no Sheet, no Tabs, no links). The drawer floats in the column here instead of
 * hanging off the window's edge.
 *
 * No pointer: after three chapters of doing, this one only shows — the loop's breath. The
 * drawer arrives the way the product's Sheet does, its parts rise behind it, the numbers
 * settle, and the rest of the chapter is time to read it.
 */
export function ProgressScene({ copy }: { copy: ProgressCopy }) {
  const { lessons, homework } = OLYA

  return (
    <SceneFrame title={copy.title} line={copy.line}>
      <div className="bg-popover text-popover-foreground ring-foreground/10 animate-in fade-in-0 slide-in-from-right-10 relative flex flex-col overflow-hidden rounded-xl text-sm shadow-lg ring-1 duration-200 ease-in-out">
        <span
          className={cn(
            buttonVariants({ variant: 'ghost', size: 'icon-sm' }),
            'absolute right-3 top-3',
          )}
        >
          <XIcon />
        </span>

        <div className="flex flex-col gap-0.5 border-b p-5">
          <h2 className="font-heading text-foreground pr-5 text-base font-medium">
            {copy.student}
          </h2>
          <p className="text-muted-foreground text-sm">{copy.description}</p>
        </div>

        <div className="p-3">
          <div className="flex flex-col gap-4">
            <div
              className="animate-rise-in bg-muted text-muted-foreground grid h-8 w-full grid-cols-2 items-center rounded-full p-1"
              style={staggered(0, BODY_DELAY)}
            >
              <span
                className={cn(
                  TRIGGER,
                  'bg-background text-foreground dark:border-input dark:bg-input/30 shadow-sm',
                )}
              >
                {copy.overviewTab}
              </span>
              <span className={cn(TRIGGER, 'text-foreground/60 dark:text-muted-foreground')}>
                {copy.creditsTab}
              </span>
            </div>

            {/* The real summary goes on to the recent homework; the drawer is cut after the
                facts here, so it closes with the same 16px it has at its sides. */}
            <div className="space-y-5 px-1 pb-1">
              <Section
                index={1}
                icon={<AlertTriangleIcon className="text-muted-foreground size-4" />}
                title={copy.attention}
              >
                <ul className="divide-border/60 bg-muted/20 divide-y rounded-xl border px-3">
                  <li className="py-2.5 text-xs leading-relaxed">{copy.lowCredits}</li>
                </ul>
              </Section>

              <Section
                index={2}
                icon={<CalendarCheck2Icon className="text-muted-foreground size-4" />}
                title={copy.lessonTotals}
              >
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: copy.attended, value: lessons.attended },
                    { label: copy.missed, value: lessons.missed },
                    { label: copy.excused, value: lessons.excused },
                    { label: copy.planned, value: lessons.planned },
                  ].map((fact, tile) => (
                    <Fact
                      key={fact.label}
                      label={fact.label}
                      value={fact.value}
                      at={bodyAt(2) + tile * STAGGER_MS}
                    />
                  ))}
                </div>
              </Section>

              <Section
                index={3}
                icon={<ClipboardCheckIcon className="text-muted-foreground size-4" />}
                title={copy.homework}
              >
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: copy.open, value: homework.assigned },
                    { label: copy.waiting, value: homework.submitted },
                    { label: copy.completed, value: homework.graded },
                  ].map((fact, tile) => (
                    <Fact
                      key={fact.label}
                      label={fact.label}
                      value={fact.value}
                      at={bodyAt(3) + tile * STAGGER_MS}
                    />
                  ))}
                </div>
              </Section>
            </div>
          </div>
        </div>
      </div>
    </SceneFrame>
  )
}

/** One part of StudentProgressSummary: a muted lucide icon, a small heading, its content. */
function Section({
  index,
  icon,
  title,
  children,
}: {
  index: number
  icon: ReactNode
  title: string
  children: ReactNode
}) {
  return (
    <section className="animate-rise-in space-y-2" style={staggered(index, BODY_DELAY)}>
      <h3 className="flex items-center gap-2 text-sm font-medium">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  )
}

/** StudentProgressSummary's Fact tile, its number counting up from `at`. */
function Fact({ label, value, at }: { label: string; value: number; at: number }) {
  const shown = useCount(value, at, COUNT_MS)

  return (
    <div className="bg-muted/30 rounded-lg border px-3 py-2.5">
      <p className="text-lg font-semibold tabular-nums">{shown}</p>
      <p className="text-muted-foreground mt-0.5 text-[10px] leading-tight">{label}</p>
    </div>
  )
}
