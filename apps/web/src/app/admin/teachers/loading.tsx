import { Skeleton } from '@/components/ui/skeleton'
import { TeachersTableSkeleton } from '@/features/teachers/components/teachers-table-skeleton'

export default function Loading() {
  return (
    <>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-80" />
      </div>

      <TeachersTableSkeleton />
    </>
  )
}
