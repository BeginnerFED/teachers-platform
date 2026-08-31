import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Shaped like the cards it stands in for — a heading, label-and-control rows separated by
 * rules, a footer with a button on the right — so the page does not rearrange itself the
 * moment the data lands.
 */
function CardSkeleton({ rows }: { rows: number }) {
  return (
    <Card>
      <CardHeader className="border-b">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3.5 w-64" />
      </CardHeader>

      <CardContent className="divide-border -mt-1 divide-y px-0">
        {Array.from({ length: rows }, (_, index) => (
          <div
            key={index}
            className="px-(--card-spacing) grid gap-1.5 py-3 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)] sm:gap-6"
          >
            <Skeleton className="h-4 w-24 sm:mt-1.5" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
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
    <div className="flex items-start gap-8">
      {/* Stands in for the section rail, so the cards do not slide sideways when it
          appears. */}
      <div className="border-border hidden w-40 shrink-0 flex-col gap-3.5 border-l pt-4 pl-4 lg:flex">
        {[24, 20, 22, 26, 28].map((width, index) => (
          <Skeleton key={index} className="h-3.5" style={{ width: `${width * 4}px` }} />
        ))}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-5">
        <CardSkeleton rows={3} />
        <CardSkeleton rows={3} />
        <CardSkeleton rows={3} />
        <CardSkeleton rows={2} />

        <Card>
          <CardHeader className="border-b">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3.5 w-56" />
          </CardHeader>
          <CardContent className="flex flex-col gap-4 py-2">
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
    </div>
  )
}
