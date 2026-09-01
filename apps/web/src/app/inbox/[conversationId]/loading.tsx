import { ThreadSkeleton } from '@/features/inbox/components/thread-skeleton'

/** Only this segment, so the list beside it stays put while a conversation is on its way. */
export default function Loading() {
  return <ThreadSkeleton />
}
