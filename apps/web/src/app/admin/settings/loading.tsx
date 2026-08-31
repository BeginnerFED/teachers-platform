import { Skeleton } from '@/components/ui/skeleton'
import { SettingsSkeleton } from '@/features/settings/components/settings-skeleton'

export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-[88rem] flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-4 w-72" />
      </div>

      <SettingsSkeleton />
    </div>
  )
}
