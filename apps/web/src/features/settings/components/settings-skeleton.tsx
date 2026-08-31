import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Shaped like the cards it stands in for — heading, a row of fields, a footer with a
 * button on the right — so the page does not rearrange itself the moment data lands.
 */
function CardSkeleton({ fields }: { fields: number }) {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3.5 w-64" />
      </CardHeader>

      <CardContent className="pt-1">
        <div className="grid gap-5 sm:grid-cols-3">
          {Array.from({ length: fields }, (_, index) => (
            <div key={index} className="flex flex-col gap-2">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </div>
      </CardContent>

      <CardFooter className="justify-between gap-4">
        <Skeleton className="h-3 w-56" />
        <Skeleton className="h-9 w-24 shrink-0" />
      </CardFooter>
    </Card>
  )
}

export function SettingsSkeleton() {
  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <CardSkeleton fields={3} />
      <CardSkeleton fields={3} />
      <CardSkeleton fields={2} />
      <CardSkeleton fields={3} />

      <Card>
        <CardHeader className="border-b">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3.5 w-56" />
        </CardHeader>
        <CardContent className="flex flex-col gap-4 py-4">
          {Array.from({ length: 2 }, (_, index) => (
            <div key={index} className="flex items-center gap-4">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-56" />
              <Skeleton className="ml-auto h-5 w-20" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
