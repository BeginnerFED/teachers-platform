import type { ReactNode } from 'react'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

/**
 * One setting: what it is on the left, the control for it on the right.
 *
 * The alternative — a grid of fields — leaves a hole wherever a card has a number of
 * settings that does not divide by the column count, and gives a hint no obvious owner.
 * Here every row reads the same way however many there are, a description sits under the
 * label it describes, and adding a setting is one more row rather than a reflow.
 *
 * The control fills the column rather than sitting in the middle of it. Capping it left a
 * strip of nothing between every field and the edge of the card, which is the emptiness
 * you notice: not the margin outside the page, but the gap inside a box that was supposed
 * to be full. The card itself is held to a reading width instead, which is where a limit
 * on how wide a text field grows actually belongs.
 */
export function SettingRow({
  label,
  htmlFor,
  description,
  children,
  className,
}: {
  label: string
  /** Points the label at its control, so clicking the text focuses the field. */
  htmlFor?: string
  description?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'px-(--card-spacing) grid gap-1.5 py-3 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)] sm:items-start sm:gap-6',
        className,
      )}
    >
      <div className="flex flex-col gap-0.5 sm:pt-1.5">
        <Label htmlFor={htmlFor} className="font-medium">
          {label}
        </Label>
        {description ? (
          <p className="text-muted-foreground text-xs leading-snug text-balance">{description}</p>
        ) : null}
      </div>

      <div className="min-w-0">{children}</div>
    </div>
  )
}
