import { MessagesSquareIcon } from 'lucide-react'
import { getMessages } from '@/messages/server'

export default async function InboxPage() {
  const t = await getMessages()

  return (
    <div className="text-muted-foreground m-auto flex flex-col items-center gap-3 p-8 text-center">
      <MessagesSquareIcon className="size-8 opacity-40" />
      <p className="text-sm">{t.inbox.pickOne}</p>
    </div>
  )
}
