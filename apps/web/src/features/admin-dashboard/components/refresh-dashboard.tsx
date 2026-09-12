'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCwIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function RefreshDashboard({ label }: { label: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      title={label}
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
    >
      <RefreshCwIcon className={cn('size-3.5', pending && 'animate-spin')} />
    </Button>
  )
}
