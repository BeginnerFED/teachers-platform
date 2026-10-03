import Link from 'next/link'
import { FileQuestionIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getMessages } from '@/messages/server'

/**
 * An address that leads nowhere. Next renders this inside the root layout alone, with no
 * section and so no sidebar around it, so it stands on its own in the middle of the page.
 *
 * The way out is "/", which sends each person on to the home page for their role — or to
 * the sign-in page, for somebody who has not signed in.
 */
export default async function NotFound() {
  const t = await getMessages()

  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <div className="flex w-full max-w-md flex-col items-center gap-3 rounded-md border px-6 py-16 text-center">
        <FileQuestionIcon className="text-muted-foreground size-6" />

        <div className="space-y-1">
          <h1 className="font-medium">{t.shell.notFound.title}</h1>
          <p className="text-muted-foreground text-sm">{t.shell.notFound.body}</p>
        </div>

        <Button asChild variant="outline" className="corner-brackets mt-2">
          <Link href="/">{t.shell.notFound.home}</Link>
        </Button>
      </div>
    </main>
  )
}
