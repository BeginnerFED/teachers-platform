'use client'

import { useState } from 'react'
import { CalendarIcon } from 'lucide-react'
import type { Locale } from 'react-day-picker'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { fromZoned, parseIsoDate, toIsoDate, toZoned } from '@/lib/zoned-time'

export function DatePicker({
  id,
  name,
  value,
  onValueChange,
  locale,
  timeZone,
  label,
  required = true,
  clearLabel,
  disabled,
}: {
  id: string
  name: string
  value: string
  onValueChange: (value: string) => void
  locale: Locale
  timeZone: string
  label: string
  required?: boolean
  clearLabel?: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const day = parseIsoDate(value)
  // A date is a calendar day in the supplied zone, regardless of the device's zone.
  const selected = day ? fromZoned({ ...day, hour: 12, minute: 0 }, timeZone) : undefined

  return (
    <>
      <input type="hidden" name={name} value={value} disabled={disabled} />
      <Popover open={open && !disabled} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            className="corner-brackets h-8 w-full justify-between rounded-lg px-2.5 text-sm font-normal"
          >
            {selected
              ? selected.toLocaleDateString(locale.code, {
                  timeZone,
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                })
              : label}
            <CalendarIcon className="text-muted-foreground size-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-auto p-0"
          aria-label={label}
          collisionPadding={12}
        >
          <Calendar
            mode="single"
            required={required}
            autoFocus
            selected={selected}
            defaultMonth={selected}
            onSelect={(date: Date | undefined) => {
              onValueChange(date ? toIsoDate(toZoned(date, timeZone)) : '')
              setOpen(false)
            }}
            locale={locale}
            timeZone={timeZone}
            weekStartsOn={1}
            className="rounded-lg p-3 [--cell-size:--spacing(8)]"
          />
          {!required && selected && clearLabel && (
            <div className="border-t p-2">
              <Button
                type="button"
                variant="ghost"
                className="corner-brackets w-full"
                onClick={() => {
                  onValueChange('')
                  setOpen(false)
                }}
              >
                {clearLabel}
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </>
  )
}
