'use client'

import { Clock3Icon, GaugeIcon } from 'lucide-react'
import type { AiLimitDetails, AiUsageStatus } from '@tp/shared'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import type { Messages } from '@/messages'

export type AiUsageFeature = 'lessonDraft' | 'homeworkFeedback'

export function formatAiReset(resetAt: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(resetAt))
}

export function aiLimitMessage({
  details,
  feature,
  locale,
  t,
}: {
  details: AiLimitDetails
  feature: AiUsageFeature
  locale: string
  t: Messages
}) {
  const copy = t.aiUsage

  if (details.scope === 'request') {
    return copy.cooldown.replace('{seconds}', String(details.retryAfterSeconds))
  }

  if (details.scope === 'provider') return copy.providerBusy

  const reset = formatAiReset(details.resetAt, locale)
  if (details.scope === 'platform') return copy.platformReached.replace('{time}', reset)

  return (feature === 'lessonDraft' ? copy.dailyLessonReached : copy.dailyFeedbackReached).replace(
    '{time}',
    reset,
  )
}

export function AiUsageMeter({
  usage,
  loading,
  feature,
  locale,
  t,
}: {
  usage: AiUsageStatus | null
  loading: boolean
  feature: AiUsageFeature
  locale: string
  t: Messages
}) {
  const copy = t.aiUsage

  if (loading && !usage) {
    return (
      <div
        className="border-border/60 bg-muted/20 grid gap-2.5 rounded-xl border p-3"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        aria-busy="true"
      >
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <Skeleton className="h-1.5 w-full rounded-full" />
        <Skeleton className="h-3 w-52" />
        <span className="sr-only">{copy.loading}</span>
      </div>
    )
  }

  if (!usage) {
    return (
      <div
        className="border-border/60 bg-muted/20 text-muted-foreground flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <GaugeIcon className="size-3.5 shrink-0" aria-hidden="true" />
        {copy.unavailable}
      </div>
    )
  }

  const allowance = usage[feature]
  const otherFeature = feature === 'lessonDraft' ? 'homeworkFeedback' : 'lessonDraft'
  const otherAllowance = usage[otherFeature]
  const featurePercent = Math.min(100, (allowance.used / allowance.limit) * 100)
  const platformPercent = Math.min(
    100,
    (usage.platform.usedUnits / usage.platform.limitUnits) * 100,
  )
  const featureLabel = feature === 'lessonDraft' ? copy.lessonDraft : copy.homeworkFeedback
  const otherLabel = otherFeature === 'lessonDraft' ? copy.lessonDraft : copy.homeworkFeedback
  const reset = formatAiReset(usage.resetAt, locale)

  return (
    <div
      className="border-border/60 bg-muted/20 grid gap-3 rounded-xl border p-3"
      role="status"
      aria-label={copy.title}
      aria-live="polite"
      aria-atomic="true"
      aria-busy={loading || undefined}
    >
      <div className="grid gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <GaugeIcon className="text-primary size-4 shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-xs font-medium">{featureLabel}</p>
              <p className="text-muted-foreground text-[11px] tabular-nums">
                {copy.used
                  .replace('{used}', String(allowance.used))
                  .replace('{limit}', String(allowance.limit))}
              </p>
            </div>
          </div>
          <Badge variant={allowance.remaining === 0 ? 'destructive' : 'secondary'}>
            {copy.remaining.replace('{count}', String(allowance.remaining))}
          </Badge>
        </div>
        <Progress value={featurePercent} aria-label={featureLabel} className="h-1.5" />
        <div className="border-border/60 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t pt-2 text-[11px]">
          <span className="text-muted-foreground">{otherLabel}</span>
          <span className="tabular-nums">
            {copy.used
              .replace('{used}', String(otherAllowance.used))
              .replace('{limit}', String(otherAllowance.limit))}
            {' · '}
            {copy.remaining.replace('{count}', String(otherAllowance.remaining))}
          </span>
        </div>
        <p className="text-muted-foreground text-[11px]">{copy.separate}</p>
        <p className="text-muted-foreground text-[11px]">{copy.attempts}</p>
      </div>

      <div className="border-border/60 grid gap-2 border-t pt-2.5">
        <div className="flex items-center justify-between gap-3 text-[11px]">
          <span className="text-muted-foreground">{copy.platform}</span>
          <span className="shrink-0 tabular-nums">
            {copy.platformUsed
              .replace('{used}', usage.platform.usedUnits.toLocaleString(locale))
              .replace('{limit}', usage.platform.limitUnits.toLocaleString(locale))}
          </span>
        </div>
        <Progress value={platformPercent} aria-label={copy.platform} />
        <p className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
          <Clock3Icon className="size-3 shrink-0" aria-hidden="true" />
          {copy.resets.replace('{time}', reset)}
        </p>
      </div>
    </div>
  )
}
