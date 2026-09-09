import Link from 'next/link'
import { RadioIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getMessages } from '@/messages/server'

/** "Not available" rather than "does not exist": the API answers both the same way on purpose. */
export default async function LiveNotFound() {
  const t = await getMessages()

  return (
    <div className="border-border/60 bg-card flex flex-col items-center gap-3 rounded-2xl border px-6 py-14 text-center">
      <span className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-full">
        <RadioIcon className="size-4" />
      </span>

      <div className="space-y-1">
        <p className="text-sm font-medium">{t.live.missing.title}</p>
        <p className="text-muted-foreground text-sm">{t.live.missing.body}</p>
      </div>

      <Button asChild variant="ghost" className="text-muted-foreground">
        <Link href="/">{t.live.missing.back}</Link>
      </Button>
    </div>
  )
}
