'use client'

import { useState } from 'react'
import { ClockIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const minutes = ['00', '15', '30', '45']

export function TimePicker({
  id,
  name,
  value,
  onValueChange,
  label,
  hourLabel,
  minuteLabel,
  disabled,
}: {
  id: string
  name: string
  value: string
  onValueChange: (value: string) => void
  label: string
  hourLabel: string
  minuteLabel: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [hour, minute] = value.split(':')

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
            className="corner-brackets h-8 w-full justify-between rounded-lg px-2.5 text-sm font-normal tabular-nums"
          >
            {value}
            <ClockIcon className="text-muted-foreground size-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-56 p-3" aria-label={label} collisionPadding={12}>
          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
            <Field className="min-w-0 gap-2">
              <FieldLabel htmlFor={`${id}-hour`} className="text-xs">
                {hourLabel}
              </FieldLabel>
              <Select
                value={hour}
                onValueChange={(next) => onValueChange(`${next}:${minute}`)}
                disabled={disabled}
              >
                <SelectTrigger
                  id={`${id}-hour`}
                  className="corner-brackets hover:bg-muted w-full tabular-nums"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  align="start"
                  className="max-h-60 min-w-20"
                  collisionPadding={12}
                >
                  <SelectGroup>
                    {hours.map((option) => (
                      <SelectItem key={option} value={option} className="tabular-nums">
                        {option}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <span aria-hidden="true" className="text-muted-foreground pb-1.5">
              :
            </span>
            <Field className="min-w-0 gap-2">
              <FieldLabel htmlFor={`${id}-minute`} className="text-xs">
                {minuteLabel}
              </FieldLabel>
              <Select
                value={minute}
                onValueChange={(next) => onValueChange(`${hour}:${next}`)}
                disabled={disabled}
              >
                <SelectTrigger
                  id={`${id}-minute`}
                  className="corner-brackets hover:bg-muted w-full tabular-nums"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  align="start"
                  className="max-h-60 min-w-20"
                  collisionPadding={12}
                >
                  <SelectGroup>
                    {minutes.map((option) => (
                      <SelectItem key={option} value={option} className="tabular-nums">
                        {option}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </div>
        </PopoverContent>
      </Popover>
    </>
  )
}
