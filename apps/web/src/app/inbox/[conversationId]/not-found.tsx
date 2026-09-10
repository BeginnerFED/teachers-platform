import Link from 'next/link'
import { ArrowLeftIcon, FileQuestionIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Forget } from '@/features/recent/recent'
import { getMessages } from '@/messages/server'

/**
 * A conversation that is no longer there — or was never this person's, which the API
 * answers the same way on purpose. Only this segment, so the list of conversations stays
 * beside it and this reads as an empty pane rather than as the site falling over.
 */
export default async function ConversationNotFound() {
  const t = await getMessages()

  return (
    <>
      {/* The way back to this is a way to nowhere now, so it leaves the recent list. */}
      <Forget />
      <div className="text-muted-foreground m-auto flex flex-col items-center gap-3 p-8 text-center">
        <FileQuestionIcon className="size-6" />

        <div className="space-y-1">
          <p className="text-foreground font-medium">{t.inbox.missing.title}</p>
          <p className="text-sm">{t.inbox.missing.body}</p>
        </div>

        <Button asChild variant="outline" size="sm" className="mt-2">
          <Link href="/inbox">
            <ArrowLeftIcon />
            {t.inbox.missing.back}
          </Link>
        </Button>
      </div>
    </>
  )
}
