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
 * The control is capped well short of the column it sits in. A text input stretched to
 * the full width of a wide screen is harder to use, not easier: the eye has to travel
 * from a label on the left to a caret far off to the right.
 */
export function SettingRow({
  label,
  htmlFor,
  description,
  children,
  wide = false,
}: {
  label: string
  /** Points the label at its control, so clicking the text focuses the field. */
  htmlFor?: string
  description?: ReactNode
  children: ReactNode
  /** For a control that is not a field — a preview strip — and wants the room. */
  wide?: boolean
}) {
  return (
    <div className="px-(--card-spacing) grid gap-2 py-4 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)] sm:items-start sm:gap-6">
      <div className="flex flex-col gap-1 sm:pt-1.5">
        <Label htmlFor={htmlFor} className="font-medium">
          {label}
        </Label>
        {description ? (
          <p className="text-muted-foreground text-xs text-balance">{description}</p>
        ) : null}
      </div>

      <div className={cn('min-w-0', wide ? 'w-full' : 'sm:max-w-sm')}>{children}</div>
    </div>
  )
}
