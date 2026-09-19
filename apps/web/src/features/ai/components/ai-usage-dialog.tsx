'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ClipboardCheckIcon, Clock3Icon, GaugeIcon, SparklesIcon } from 'lucide-react'
import type { AiUsageAllowance, AiUsageStatus } from '@tp/shared'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { loadAiUsage } from '@/features/ai/actions'
import { formatAiReset } from '@/features/ai/components/ai-usage-meter'
import type { Messages } from '@/messages'

function UsageCard({
  allowance,
  label,
  icon,
  t,
}: {
  allowance: AiUsageAllowance
  label: string
  icon: ReactNode
  t: Messages
}) {
  const percentage = Math.min(100, (allowance.used / allowance.limit) * 100)

  return (
    <Card size="sm" className="bg-muted/15">
      <CardHeader className="grid grid-cols-[1fr_auto] gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-full">
            {icon}
          </span>
          <CardTitle className="truncate">{label}</CardTitle>
        </div>
        <Badge variant={allowance.remaining === 0 ? 'destructive' : 'secondary'}>
          {t.aiUsage.remaining.replace('{count}', String(allowance.remaining))}
        </Badge>
      </CardHeader>
      <CardContent className="grid gap-2.5">
        <p className="text-2xl font-semibold tabular-nums">
          {allowance.used}
          <span className="text-muted-foreground text-sm font-normal"> / {allowance.limit}</span>
        </p>
        <Progress value={percentage} aria-label={label} className="h-1.5" />
        <p className="text-muted-foreground text-xs">
          {t.aiUsage.used
            .replace('{used}', String(allowance.used))
            .replace('{limit}', String(allowance.limit))}
        </p>
      </CardContent>
    </Card>
  )
}

function UsageSkeleton({ loading }: { loading: string }) {
  return (
    <div className="grid gap-3" role="status" aria-live="polite" aria-busy="true">
      <div className="grid gap-3 sm:grid-cols-2">
        {[0, 1].map((item) => (
          <div key={item} className="border-border/60 grid gap-3 rounded-xl border p-4">
            <div className="flex items-center justify-between gap-4">
              <Skeleton className="h-8 w-36" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-1.5 w-full" />
          </div>
        ))}
      </div>
      <Skeleton className="h-28 w-full rounded-xl" />
      <span className="sr-only">{loading}</span>
    </div>
  )
}

export function AiUsageDialog({
  open,
  onOpenChange,
  locale,
  t,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  locale: string
  t: Messages
}) {
  const [usage, setUsage] = useState<AiUsageStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const requestId = useRef(0)

  const refresh = useCallback(async () => {
    const currentRequest = ++requestId.current
    setLoading(true)
    setFailed(false)

    try {
      const result = await loadAiUsage()
      if (currentRequest !== requestId.current) return

      setUsage(result.usage)
      setFailed(Boolean(result.error) || !result.usage)
    } catch {
      if (currentRequest !== requestId.current) return
      setFailed(true)
    } finally {
      if (currentRequest === requestId.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return

    // Opening the controlled dialog is an external UI event. Defer the request one tick
    // so this effect only schedules synchronization instead of cascading a state update.
    const timer = window.setTimeout(() => void refresh(), 0)
    return () => {
      window.clearTimeout(timer)
      requestId.current += 1
    }
  }, [open, refresh])

  useEffect(() => {
    if (!open) return

    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }

    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [open, refresh])

  useEffect(() => {
    if (!open || !usage) return

    const delay = Math.max(1_000, Date.parse(usage.resetAt) - Date.now() + 1_000)
    const timer = window.setTimeout(() => void refresh(), delay)
    return () => window.clearTimeout(timer)
  }, [open, refresh, usage])

  const platformPercentage = usage
    ? Math.min(100, (usage.platform.usedUnits / usage.platform.limitUnits) * 100)
    : 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(720px,calc(100vh-2rem))] overflow-y-auto sm:max-w-2xl">
        <DialogHeader className="pr-8">
          <DialogTitle className="flex items-center gap-2">
            <span className="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-full">
              <GaugeIcon className="size-4" aria-hidden="true" />
            </span>
            {t.aiUsage.title}
          </DialogTitle>
          <DialogDescription>{t.aiUsage.dialogDescription}</DialogDescription>
        </DialogHeader>

        {loading && !usage ? <UsageSkeleton loading={t.aiUsage.loading} /> : null}

        {usage ? (
          <div className="grid gap-3" aria-busy={loading || undefined}>
            <div className="grid gap-3 sm:grid-cols-2">
              <UsageCard
                allowance={usage.lessonDraft}
                label={t.aiUsage.lessonDraft}
                icon={<SparklesIcon className="size-4" aria-hidden="true" />}
                t={t}
              />
              <UsageCard
                allowance={usage.homeworkFeedback}
                label={t.aiUsage.homeworkFeedback}
                icon={<ClipboardCheckIcon className="size-4" aria-hidden="true" />}
                t={t}
              />
            </div>

            <Card size="sm" className="bg-muted/15">
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <CardTitle>{t.aiUsage.platform}</CardTitle>
                <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                  {t.aiUsage.platformUsed
                    .replace('{used}', usage.platform.usedUnits.toLocaleString(locale))
                    .replace('{limit}', usage.platform.limitUnits.toLocaleString(locale))}
                </span>
              </CardHeader>
              <CardContent className="grid gap-3">
                <Progress value={platformPercentage} aria-label={t.aiUsage.platform} />
                <p className="text-muted-foreground flex items-start gap-1.5 text-xs leading-relaxed">
                  <Clock3Icon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  {t.aiUsage.resets.replace('{time}', formatAiReset(usage.resetAt, locale))}
                </p>
              </CardContent>
            </Card>

            <p className="text-muted-foreground px-1 text-xs leading-relaxed">
              {t.aiUsage.separate} {t.aiUsage.attempts}
            </p>
          </div>
        ) : null}

        {failed ? (
          <div
            className="border-destructive/25 bg-destructive/5 text-destructive flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-xs"
            role="alert"
          >
            <span>{t.aiUsage.unavailable}</span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="corner-brackets"
              disabled={loading}
              onClick={() => void refresh()}
            >
              {t.common.retry}
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
