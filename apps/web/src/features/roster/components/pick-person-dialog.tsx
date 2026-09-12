'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { Loader2Icon, PlusIcon, RefreshCwIcon, SearchIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { initials } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Person } from '../actions'

const SEARCH_DEBOUNCE_MS = 300

/**
 * Picking one person from a list: a teacher for a student, a student for a teacher.
 * Type to narrow, click the row, done — no confirm step, because the link can be ended a
 * moment later and a question in front of every pick is a tax on the common case.
 *
 * The list is fetched when the dialog opens rather than with the page, since it is only
 * wanted once somebody has decided to add somebody.
 */
export function PickPersonDialog({
  label,
  title,
  description,
  searchPlaceholder,
  emptyMessage,
  exclude,
  load,
  onPick,
  success,
  failure,
  retryLabel,
}: {
  label: string
  title: string
  description: string
  searchPlaceholder: string
  emptyMessage: string
  /** Already linked. Offering them again would only ever answer "already there". */
  exclude: string[]
  load: (query: string) => Promise<Person[]>
  onPick: (id: string) => Promise<{ error: string | null }>
  success: string
  failure: string
  retryLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [people, setPeople] = useState<Person[] | null>(null)
  const [picking, setPicking] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [retry, setRetry] = useState(0)
  const pickingRef = useRef(false)
  const [, startTransition] = useTransition()

  // Fetched on open and again after a pause in typing. A request per keystroke would
  // race itself; the last one to land would win, and it is not always the latest.
  useEffect(() => {
    if (!open) return
    let cancelled = false

    const timer = setTimeout(
      () => {
        startTransition(async () => {
          setFailed(false)
          try {
            const found = await load(query)
            if (!cancelled) setPeople(found)
          } catch {
            if (!cancelled) setFailed(true)
          }
        })
      },
      people === null ? 0 : SEARCH_DEBOUNCE_MS,
    )

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
    // `people` is read only to skip the debounce on the very first load; depending on it
    // would refetch after every result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, query, load, retry])

  const excluded = new Set(exclude)
  const shown = (people ?? []).filter((person) => !excluded.has(person.id))

  function pick(person: Person) {
    if (pickingRef.current) return
    pickingRef.current = true
    setPicking(person.id)

    startTransition(async () => {
      try {
        const { error } = await onPick(person.id)
        if (error) {
          toast.error(failure)
          return
        }
        toast.success(success)
        pickingRef.current = false
        onOpenChange(false)
      } catch {
        toast.error(failure)
      } finally {
        pickingRef.current = false
        setPicking(null)
      }
    })
  }

  function onOpenChange(next: boolean) {
    if (pickingRef.current) return
    setOpen(next)

    if (!next) {
      setQuery('')
      setPeople(null)
      setFailed(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="h-7 gap-1.5 text-xs"
      >
        <PlusIcon className="size-3.5" />
        {label}
      </Button>

      <DialogContent className="gap-4 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="break-words">{description}</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <SearchIcon className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2" />
          <Input
            value={query}
            disabled={picking !== null}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            autoFocus
            className="h-8 pl-8 text-sm"
          />
        </div>

        <div className="divide-border max-h-72 divide-y overflow-y-auto rounded-md border">
          {failed ? (
            <div role="alert" className="flex items-center justify-between gap-3 px-3 py-5">
              <p className="text-muted-foreground text-sm">{failure}</p>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={retryLabel ?? failure}
                onClick={() => setRetry((value) => value + 1)}
              >
                <RefreshCwIcon className="size-4" />
              </Button>
            </div>
          ) : people === null ? (
            Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="flex items-center gap-3 px-3 py-2">
                <Skeleton className="size-7 rounded-md" />
                <div className="grid flex-1 gap-1">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3 w-44" />
                </div>
              </div>
            ))
          ) : shown.length === 0 ? (
            <p className="text-muted-foreground px-3 py-6 text-center text-sm">{emptyMessage}</p>
          ) : (
            shown.map((person) => {
              const name = person.fullName ?? person.email
              const busy = picking === person.id

              return (
                <button
                  key={person.id}
                  type="button"
                  disabled={picking !== null}
                  onClick={() => pick(person)}
                  className={cn(
                    'hover:bg-muted/60 flex w-full items-center gap-3 px-3 py-2 text-left transition-colors disabled:opacity-60',
                    busy && 'bg-muted/60',
                  )}
                >
                  <Avatar className="size-7 rounded-md">
                    <AvatarFallback className="rounded-md text-[10px] font-medium">
                      {initials(name)}
                    </AvatarFallback>
                  </Avatar>

                  <span className="grid min-w-0 flex-1">
                    <span className="truncate text-sm">{name}</span>
                    <span className="text-muted-foreground truncate text-xs">{person.email}</span>
                  </span>

                  {busy ? (
                    <Loader2Icon className="text-muted-foreground size-4 shrink-0 animate-spin" />
                  ) : null}
                </button>
              )
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
