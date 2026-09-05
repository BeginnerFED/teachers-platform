'use client'

import type { ReactNode } from 'react'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

/**
 * Fields that look like the text they replace. A heading is edited as a heading, a
 * paragraph as a paragraph, an option as the option row the student will tap — the
 * typography comes in through `className`, the field itself brings no border and no label.
 * That is what makes the canvas the lesson rather than a form about the lesson.
 */

const FIELD =
  'w-full min-w-0 rounded bg-transparent outline-none transition-colors hover:bg-muted/50 focus:bg-muted/50 focus:ring-2 focus:ring-ring/40 placeholder:text-muted-foreground/50'

export function InlineText({
  value,
  onChange,
  placeholder,
  className,
  label,
  maxLength,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  /** For the screen reader, when the placeholder is not a good enough name. */
  label?: string
  maxLength?: number
}) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      aria-label={label ?? placeholder}
      maxLength={maxLength}
      className={cn(FIELD, '-mx-1 px-1', className)}
    />
  )
}

/** Grows with its content, so a paragraph being written never scrolls inside itself. */
export function InlineTextarea({
  value,
  onChange,
  placeholder,
  className,
  label,
  maxLength,
  rows = 1,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  label?: string
  maxLength?: number
  rows?: number
}) {
  return (
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      aria-label={label ?? placeholder}
      maxLength={maxLength}
      rows={rows}
      className={cn(FIELD, 'field-sizing-content -mx-1 resize-none px-1', className)}
    />
  )
}

/**
 * The settings that are not visible text — a callout's tone, a heading's size, a quiz's
 * clock. A small capsule floating over the block's top-left edge, opposite the frame's
 * tools capsule, that appears when the pointer is over the block.
 *
 * Floating rather than in the flow, because a row that is invisible but still takes its
 * height put a band of nothing above every block: the canvas no longer matched the
 * player, which is the one thing a WYSIWYG canvas must do. On a touch screen there is no
 * hover to reveal it with, so there it sits in the flow, above the content, always shown.
 */
export function Settings({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'bg-background text-muted-foreground absolute -top-3 left-3 z-10 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border px-2 py-0.5 text-xs opacity-0 shadow-sm transition-opacity focus-within:opacity-100 group-hover/block:opacity-100',
        // Stays while a select inside it is open: the pointer is on the menu, not the block.
        'has-data-[state=open]:opacity-100',
        'max-sm:static max-sm:mb-1 max-sm:border-0 max-sm:bg-transparent max-sm:px-0 max-sm:opacity-100 max-sm:shadow-none',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function SettingToggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center gap-1.5">
      <Switch checked={checked} onCheckedChange={onChange} />
      {label}
    </label>
  )
}

export function SettingNumber({
  label,
  value,
  onChange,
  min,
  max,
  step,
}: {
  label: string
  value: number | undefined
  onChange: (value: number | undefined) => void
  min?: number
  max?: number
  step?: number
}) {
  return (
    <label className="flex items-center gap-1.5">
      {label}
      <Input
        type="number"
        inputMode={step && step < 1 ? 'decimal' : 'numeric'}
        min={min}
        max={max}
        step={step}
        value={value ?? ''}
        onChange={(event) =>
          onChange(event.target.value === '' ? undefined : Number(event.target.value))
        }
        className="h-6 w-14 px-1.5 text-center text-xs tabular-nums"
      />
    </label>
  )
}
