'use client'

import { useEffect, useState } from 'react'
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FileTextIcon,
  Loader2Icon,
  SearchIcon,
} from 'lucide-react'
import { LEVELS, type MaterialListItem, type PageMeta } from '@tp/shared'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Messages } from '@/messages'

export type MaterialOptions = { data: MaterialListItem[]; meta: PageMeta }

export function LiveMaterialDialog({
  initial,
  selectedId,
  onSelect,
  onClose,
  t,
}: {
  initial: MaterialOptions | null
  selectedId?: string
  onSelect: (material: MaterialListItem) => void
  onClose: () => void
  t: Messages
}) {
  const [search, setSearch] = useState('')
  const [level, setLevel] = useState('all')
  const [page, setPage] = useState(1)
  const [retry, setRetry] = useState(0)
  const key = JSON.stringify([search.trim(), level, page, retry])
  const [result, setResult] = useState({ key, data: initial, error: false })
  const pending = result.key !== key || (!result.data && !result.error)
  useEffect(() => {
    if (!search.trim() && level === 'all' && page === 1 && retry === 0 && initial) return
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ page: String(page) })
        if (search.trim()) params.set('query', search.trim())
        if (level !== 'all') params.set('level', level)
        const response = await fetch(`/api/live/materials?${params}`, {
          signal: controller.signal,
          cache: 'no-store',
        })
        if (!response.ok) throw new Error('Material lookup failed')
        const data = (await response.json()) as MaterialOptions
        if (!controller.signal.aborted) setResult({ key, data, error: false })
      } catch {
        if (!controller.signal.aborted) setResult({ key, data: null, error: true })
      }
    }, 250)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [key, search, level, page, retry, initial])
  const data =
    !search.trim() && level === 'all' && page === 1 && retry === 0 && initial
      ? initial
      : result.data
  const loading =
    !(!search.trim() && level === 'all' && page === 1 && retry === 0 && initial) && pending
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="max-h-[85dvh] gap-4 overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t.liveDesk.materialTitle}</DialogTitle>
          <DialogDescription>{t.liveDesk.materialHint}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-0 flex-1">
            <SearchIcon className="text-muted-foreground absolute left-3 top-2.5 size-4" />
            <Input
              autoFocus
              maxLength={120}
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
              placeholder={t.library.searchPlaceholder}
              aria-label={t.library.searchPlaceholder}
              className="pl-9"
            />
          </div>
          <Select
            value={level}
            onValueChange={(value) => {
              setLevel(value)
              setPage(1)
            }}
          >
            <SelectTrigger aria-label={t.library.allLevels}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.library.allLevels}</SelectItem>
              {LEVELS.map((value) => (
                <SelectItem key={value} value={value}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-h-48" aria-busy={loading}>
          {loading ? (
            <div className="text-muted-foreground flex justify-center py-16">
              <Loader2Icon className="size-5 animate-spin" />
              <span className="sr-only">{t.liveDesk.loading}</span>
            </div>
          ) : result.error && !data ? (
            <div className="space-y-3 py-10 text-center">
              <p className="text-muted-foreground text-sm">{t.teacherLive.materialsFailed}</p>
              <Button
                variant="outline"
                className="corner-brackets"
                onClick={() => setRetry((n) => n + 1)}
              >
                {t.common.retry}
              </Button>
            </div>
          ) : !data?.data.length ? (
            <p className="text-muted-foreground py-12 text-center text-sm">
              {t.library.empty.search}
            </p>
          ) : (
            <ul className="divide-y rounded-xl border">
              {data.data.map((material) => (
                <li key={material.id}>
                  <Button
                    variant="ghost"
                    type="button"
                    disabled={!material.stepCount}
                    onClick={() => {
                      onSelect(material)
                      onClose()
                    }}
                    className="corner-brackets h-auto w-full justify-start gap-3 rounded-none p-3 text-left font-normal"
                  >
                    <span className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-lg">
                      <FileTextIcon className="text-muted-foreground size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{material.title}</span>
                      <span className="text-muted-foreground mt-1 block text-xs">
                        {material.level} ·{' '}
                        {material.stepCount
                          ? `${material.stepCount} ${t.library.card.steps}`
                          : t.teacherLive.needsSteps}
                      </span>
                    </span>
                    {material.id === selectedId && <CheckIcon className="text-primary size-4" />}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {data && data.meta.total > data.meta.perPage && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {page} / {Math.ceil(data.meta.total / data.meta.perPage)}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon-sm"
                className="corner-brackets"
                aria-label={t.teacherLive.previous}
                disabled={loading || page <= 1}
                onClick={() => setPage((n) => n - 1)}
              >
                <ChevronLeftIcon />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                className="corner-brackets"
                aria-label={t.teacherLive.next}
                disabled={loading || page * data.meta.perPage >= data.meta.total}
                onClick={() => setPage((n) => n + 1)}
              >
                <ChevronRightIcon />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
