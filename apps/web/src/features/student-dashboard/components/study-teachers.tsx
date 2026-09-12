import Link from 'next/link'
import { MessageSquareIcon } from 'lucide-react'
import type { StudyTeacher } from '@tp/shared'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { startConversation } from '@/features/inbox/actions'
import { initials } from '@/lib/format'
import type { Messages } from '@/messages'
import { StudyEmpty } from './study-panel'

export function StudyTeachers({
  teachers,
  t,
  locale,
}: {
  teachers: StudyTeacher[]
  t: Messages
  locale: string
}) {
  if (!teachers.length)
    return (
      <>
        <StudyEmpty title={t.studentHome.noTeachers} hint={t.studentHome.noTeachersHint} />
        <Button asChild variant="outline" className="corner-brackets mx-auto mb-5">
          <Link href="/inbox">
            <MessageSquareIcon />
            {t.inbox.title}
          </Link>
        </Button>
      </>
    )
  const number = new Intl.NumberFormat(locale)
  return (
    <ul className="divide-y">
      {teachers.map((teacher) => (
        <li key={teacher.id} className="flex flex-wrap items-start gap-4 p-5">
          <Avatar className="size-10 rounded-xl">
            <AvatarFallback className="rounded-xl">
              {initials(teacher.fullName || teacher.email)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="break-words text-sm font-medium">{teacher.fullName || teacher.email}</p>
            {!teacher.active && (
              <p className="text-muted-foreground mt-1 text-xs">{t.studentHome.previousTeacher}</p>
            )}
            <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-2xl font-semibold tabular-nums tracking-tight">
                {number.format(teacher.remaining)}
              </span>
              <span className="text-muted-foreground text-xs">{t.studentHome.remaining}</span>
            </div>
            <p className="text-muted-foreground mt-1 text-xs tabular-nums">
              {t.studentHome.granted}: {number.format(teacher.granted)} · {t.studentHome.used}:{' '}
              {number.format(teacher.used)}
            </p>
            {teacher.active && teacher.remaining <= 2 && (
              <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
                {teacher.granted === 0 && teacher.used === 0
                  ? t.studentHome.noPackage
                  : t.studentHome.lowBalance}
              </p>
            )}
          </div>
          {teacher.active && (
            <form action={startConversation}>
              <input type="hidden" name="recipientId" value={teacher.id} />
              <Button type="submit" variant="outline" size="sm" className="corner-brackets">
                <MessageSquareIcon />
                {t.studentHome.message}
              </Button>
            </form>
          )}
        </li>
      ))}
    </ul>
  )
}
