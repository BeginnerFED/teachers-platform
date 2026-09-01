import { notFound } from 'next/navigation'
import { getThread } from '@/features/inbox/api'
import { ThreadView } from '@/features/inbox/components/thread-view'
import { requireViewer } from '@/lib/auth'
import { getMessages } from '@/messages/server'

export default async function ConversationPage({
  params,
}: PageProps<'/inbox/[conversationId]'>) {
  const [viewer, t, { conversationId }] = await Promise.all([
    requireViewer(),
    getMessages(),
    params,
  ])

  const thread = await getThread(conversationId)

  // The API answers "not yours" and "not there" the same way on purpose, so a stale link
  // lands here rather than telling somebody a conversation exists.
  if (!thread) notFound()

  return <ThreadView thread={thread} locale={viewer.locale} t={t} />
}
