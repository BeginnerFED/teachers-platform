'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowLeftIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { parentFor } from '@/components/app-breadcrumb'
import { cn } from '@/lib/utils'
import type { Messages } from '@/messages'

/**
 * The way back from a second-level page — a lesson, a piece of homework, the bin — to
 * the page it hangs off. Rendered nowhere on a first-level page: a back button that goes
 * to Home is a Home button pretending.
 *
 * It goes to the parent rather than through history, so it lands in the same place
 * whether the page was reached from the list, from a link somebody sent, or from a reload.
 */
export function BackButton({ t, className }: { t: Messages; className?: string }) {
  const pathname = usePathname()
  const parent = parentFor(pathname, t)

  if (!parent) return null

  return (
    <Button
      asChild
      variant="outline"
      size="icon"
      className={cn('text-muted-foreground hover:text-foreground', className)}
    >
      <Link href={parent} aria-label={t.common.back} title={t.common.back}>
        <ArrowLeftIcon />
      </Link>
    </Button>
  )
}
