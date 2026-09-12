import Link from 'next/link'
import { LockKeyholeIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Messages } from '@/messages'

export function AccessNotice({ t }: { t: Messages }) {
  return (
    <div className="bg-card grid grid-cols-[auto_minmax(0,1fr)] items-start gap-4 rounded-2xl border p-5 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
      <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
        <LockKeyholeIcon className="size-4" />
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm font-medium">{t.teachingAccess.title}</p>
        <p className="text-muted-foreground text-sm">{t.teachingAccess.body}</p>
      </div>
      <Button
        asChild
        variant="outline"
        className="corner-brackets col-span-2 w-full sm:col-span-1 sm:w-auto"
      >
        <Link href="/inbox">{t.teachingAccess.contact}</Link>
      </Button>
    </div>
  )
}
