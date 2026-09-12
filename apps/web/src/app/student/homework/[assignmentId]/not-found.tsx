import Link from 'next/link'
import { ArrowLeftIcon, FileQuestionIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Forget } from '@/features/recent/recent'
import { getMessages } from '@/messages/server'

export default async function StudentHomeworkNotFound() {
  const t = await getMessages()

  return (
    <>
      {/* The way back to this is a way to nowhere now, so it leaves the recent list. */}
      <Forget />
      <div className="flex flex-col items-center justify-center gap-3 rounded-md border py-20 text-center">
        <FileQuestionIcon className="text-muted-foreground size-6" />

        <div className="space-y-1">
          <p className="font-medium">{t.homework.missing.title}</p>
          <p className="text-muted-foreground text-sm">{t.homework.missing.body}</p>
        </div>

        <Button asChild variant="outline" size="sm" className="corner-brackets mt-2">
          <Link href="/student/homework">
            <ArrowLeftIcon />
            {t.homework.missing.back}
          </Link>
        </Button>
      </div>
    </>
  )
}
