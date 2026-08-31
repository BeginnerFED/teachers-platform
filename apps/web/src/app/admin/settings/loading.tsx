import { SettingsSkeleton } from '@/features/settings/components/settings-skeleton'
import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-4 w-72" />
      </div>

      <SettingsSkeleton />
    </>
  )
}
