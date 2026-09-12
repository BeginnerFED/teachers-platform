import { Skeleton } from '@/components/ui/skeleton'
export default function Loading() {
  return (
    <>
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-4 w-full max-w-md" />
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-96 rounded-xl" />
    </>
  )
}
