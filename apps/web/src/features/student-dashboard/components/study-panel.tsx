import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowUpRightIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { RefreshDashboard } from '@/features/admin-dashboard/components/refresh-dashboard'
import type { Messages } from '@/messages'

export function StudyPanel({
  title,
  hint,
  href,
  action,
  children,
}: {
  title: string
  hint: string
  href?: string
  action?: string
  children: ReactNode
}) {
  return (
    <section className="bg-card flex min-w-0 flex-col overflow-hidden rounded-xl border">
      <div className="border-b px-5 py-4">
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-muted-foreground mt-1 text-xs leading-relaxed">{hint}</p>
      </div>
      <div className="flex flex-1 flex-col">{children}</div>
      {href && (
        <div className="bg-muted/10 flex justify-end border-t px-4 py-1.5">
          <Button asChild variant="ghost" size="sm" className="corner-brackets">
            <Link href={href}>
              {action}
              <ArrowUpRightIcon />
            </Link>
          </Button>
        </div>
      )}
    </section>
  )
}
export function StudyEmpty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex min-h-44 flex-1 flex-col items-center justify-center gap-2 px-5 py-10 text-center">
      <p className="text-sm font-medium">{title}</p>
      {hint && <p className="text-muted-foreground max-w-sm text-xs leading-relaxed">{hint}</p>}
    </div>
  )
}
export function StudyError({ t }: { t: Messages }) {
  return (
    <div
      role="alert"
      className="flex min-h-40 flex-1 flex-col items-center justify-center gap-3 p-5 text-center"
    >
      <p className="text-muted-foreground text-sm">{t.studentHome.loadingFailed}</p>
      <RefreshDashboard label={t.common.retry} />
    </div>
  )
}
