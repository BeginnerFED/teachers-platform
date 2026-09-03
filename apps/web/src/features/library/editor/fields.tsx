'use client'

import type { ReactNode } from 'react'
import { PlusIcon, XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** The two controls a list of rows needs: one more, and this one gone. */

export function AddRow({
  children,
  onClick,
  className,
}: {
  children: ReactNode
  onClick: () => void
  className?: string
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      className={cn('text-muted-foreground h-7 w-fit gap-1.5 px-2 text-xs', className)}
    >
      <PlusIcon className="size-3.5" />
      {children}
    </Button>
  )
}

export function RemoveRow({
  label,
  onClick,
  disabled,
  className,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  className?: string
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn('text-muted-foreground hover:text-destructive size-6 shrink-0', className)}
    >
      <XIcon className="size-3.5" />
    </Button>
  )
}
