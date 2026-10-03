import Link from 'next/link'
import { ArrowLeftIcon, FileQuestionIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Forget } from '@/features/recent/recent'
import { getMessages } from '@/messages/server'

/**
 * Covers both the lesson page and the player beneath it. Rendered inside the library
 * layout, so the sidebar stays put and this reads as a room with nothing in it rather
 * than as the site having fallen over.
 *
 * "Not available" rather than "does not exist", because the API answers those two the same
 * way on purpose — telling somebody a lesson exists but is not theirs is itself a leak.
 *
 * Worth knowing: the sibling loading.tsx puts this segment in a Suspense boundary, so the
 * 200 has already gone out by the time notFound() is thrown and the status stays 200. What
 * a person sees is right; a crawler would be misled, and nothing here is crawlable.
 */
export default async function MaterialNotFound() {
  const t = await getMessages()

  return (
    <>
      {/* The way back to this is a way to nowhere now, so it leaves the recent list. */}
      <Forget />
      <div className="flex flex-col items-center justify-center gap-3 rounded-md border py-20 text-center">
        <FileQuestionIcon className="text-muted-foreground size-6" />

        <div className="space-y-1">
          {/* The page's heading, at body text's size and so with its spacing too, rather than
              the tighter one drawn for large headings. */}
          <h1 className="font-medium tracking-normal">{t.library.missing.title}</h1>
          <p className="text-muted-foreground text-sm">{t.library.missing.body}</p>
        </div>

        <Button asChild variant="outline" className="mt-2">
          <Link href="/library">
            <ArrowLeftIcon />
            {t.library.missing.back}
          </Link>
        </Button>
      </div>
    </>
  )
}
