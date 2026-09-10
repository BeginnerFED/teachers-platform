'use client'

import { useEffect, useId, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowUpRightIcon,
  BookOpenIcon,
  CalendarDaysIcon,
  ClipboardListIcon,
  CornerDownLeftIcon,
  GraduationCapIcon,
  HouseIcon,
  InboxIcon,
  Loader2Icon,
  MessageCircleQuestionIcon,
  SearchIcon,
  Settings2Icon,
  Trash2Icon,
  UsersIcon,
  XIcon,
  type LucideIcon,
} from 'lucide-react'
import { normalizeSearch, searchQuery, type Role, type SearchResults } from '@tp/shared'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { Messages } from '@/messages'
import { openSearchContact } from './actions'

type Result = {
  id: string
  title: string
  description?: string
  icon: LucideIcon
  href?: string
  contactId?: string
}

function pagesFor(role: Role, t: Messages): Result[] {
  const pages = [
    {
      href: { admin: '/admin', teacher: '/dashboard', student: '/student' }[role],
      title: t.nav.home,
      icon: HouseIcon,
    },
    { href: '/inbox', title: t.inbox.title, icon: InboxIcon },
    ...(role !== 'student'
      ? [
          { href: '/library', title: t.library.title, icon: BookOpenIcon },
          { href: '/homework', title: t.nav.assignments, icon: ClipboardListIcon },
        ]
      : []),
    ...(role === 'admin'
      ? [
          { href: '/admin/teachers', title: t.nav.teachers, icon: UsersIcon },
          { href: '/admin/students', title: t.nav.students, icon: GraduationCapIcon },
          { href: '/admin/calendar', title: t.calendar.title, icon: CalendarDaysIcon },
          { href: '/admin/settings', title: t.nav.settings, icon: Settings2Icon },
        ]
      : []),
    ...(role !== 'student'
      ? [{ href: '/library/trash', title: t.library.trash.title, icon: Trash2Icon }]
      : []),
    { href: '/help', title: t.nav.help, icon: MessageCircleQuestionIcon },
  ]
  return pages.map((page) => ({ ...page, id: page.href }))
}

export function GlobalSearch({ role, t }: { role: Role; t: Messages }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.isComposing || event.altKey) return
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOpen((current) => !current)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="text-muted-foreground h-8 gap-2 rounded-lg px-2 sm:w-52 sm:justify-start sm:px-3"
          aria-label={t.search.title}
          aria-keyshortcuts="Control+k Meta+k"
        >
          <SearchIcon className="size-3.5" />
          <span className="hidden sm:inline">{t.search.trigger}</span>
          <kbd className="bg-muted ml-auto hidden rounded border px-1 py-0.5 font-sans text-[10px] sm:inline">
            Ctrl / ⌘ K
          </kbd>
        </Button>
      </DialogTrigger>
      <DialogContent
        showCloseButton={false}
        className="top-[12dvh] max-h-[80dvh] -translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl"
      >
        <DialogTitle className="sr-only">{t.search.title}</DialogTitle>
        <DialogDescription className="sr-only">
          {role === 'student' ? t.search.studentDescription : t.search.description}
        </DialogDescription>
        {open && <SearchContent role={role} t={t} close={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function SearchContent({ role, t, close }: { role: Role; t: Messages; close: () => void }) {
  const router = useRouter()
  const listId = useId()
  const mounted = useRef(true)
  const list = useRef<HTMLDivElement>(null)
  const [term, setTerm] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  const [remote, setRemote] = useState<{
    query: string
    data?: SearchResults
    failed?: boolean
  } | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [opening, startOpening] = useTransition()
  const query = term.trim()
  const canSearch = searchQuery.safeParse({ query }).success
  const current = remote?.query === query ? remote : null
  const loading = canSearch && !current

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    if (!canSearch) return
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?${new URLSearchParams({ query })}`, {
          signal: controller.signal,
          cache: 'no-store',
        })
        if (!response.ok) throw new Error('Search failed')
        const body = (await response.json()) as { data: SearchResults }
        if (!controller.signal.aborted) setRemote({ query, data: body.data })
      } catch {
        if (!controller.signal.aborted) setRemote({ query, failed: true })
      }
    }, 250)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query, canSearch, retry])

  const needle = normalizeSearch(query)
  const pages = pagesFor(role, t).filter((page) => normalizeSearch(page.title).includes(needle))
  const materials: Result[] = (current?.data?.materials ?? []).map((material) => ({
    id: `material-${material.id}`,
    title: material.title,
    description: [material.level, material.description].filter(Boolean).join(' · '),
    icon: BookOpenIcon,
    href: `/library/${material.id}`,
  }))
  const people: Result[] = (current?.data?.people ?? []).map((person) => ({
    id: `person-${person.id}`,
    title: person.fullName ?? person.email,
    description: `${t.roles[person.role]} · ${person.email} · ${role === 'admin' ? t.search.viewProfile : t.search.openConversation}`,
    icon: person.role === 'student' ? GraduationCapIcon : UsersIcon,
    ...(role === 'admin'
      ? {
          href: `/admin/${person.role === 'teacher' ? 'teachers' : 'students'}?${new URLSearchParams({ query: person.email, person: person.id })}`,
        }
      : { contactId: person.id }),
  }))
  const groups = [
    { id: 'materials', title: t.search.materials, items: materials },
    { id: 'people', title: t.search.people, items: people },
    { id: 'pages', title: query ? t.search.pages : t.search.quickAccess, items: pages },
  ].filter((group) => group.items.length)
  const results = groups.flatMap((group) => group.items)
  const active = results.find((result) => result.id === selected) ?? results[0]
  const activeIndex = active ? results.indexOf(active) : -1
  const activeId = activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined

  useEffect(() => {
    list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [activeId])

  function choose(result: Result) {
    if (opening) return
    setActionError(null)
    if (result.href) {
      router.push(result.href)
      close()
    } else if (result.contactId) {
      const contactId = result.contactId
      startOpening(async () => {
        try {
          const response = await openSearchContact(contactId)
          if (!mounted.current) return
          if (response.error) setActionError(t.errors[response.error])
          else if (response.href) {
            router.push(response.href)
            close()
          }
        } catch {
          if (mounted.current) setActionError(t.errors.internal)
        }
      })
    }
  }

  return (
    <>
      <div className="flex items-center gap-3 border-b px-4">
        <SearchIcon className="text-muted-foreground size-5 shrink-0" />
        <input
          autoFocus
          role="combobox"
          aria-label={t.search.title}
          aria-autocomplete="list"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={activeId}
          placeholder={role === 'student' ? t.search.studentPlaceholder : t.search.placeholder}
          value={term}
          maxLength={120}
          disabled={opening}
          autoComplete="off"
          spellCheck={false}
          className="placeholder:text-muted-foreground h-14 min-w-0 flex-1 bg-transparent text-sm outline-none disabled:opacity-50"
          onChange={(event) => {
            setTerm(event.target.value)
            setSelected(null)
            if (event.target.value.trim() !== query) setRemote(null)
            setActionError(null)
          }}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing || opening) return
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault()
              if (!results.length) return
              const delta = event.key === 'ArrowDown' ? 1 : -1
              setSelected(results[(activeIndex + delta + results.length) % results.length].id)
            } else if (event.key === 'Enter' && active) {
              event.preventDefault()
              choose(active)
            }
          }}
        />
        {loading || opening ? (
          <Loader2Icon aria-hidden="true" className="text-muted-foreground size-4 animate-spin" />
        ) : null}
        <DialogClose asChild>
          <Button variant="ghost" size="icon-sm" aria-label={t.search.close}>
            <XIcon />
          </Button>
        </DialogClose>
      </div>

      <div
        className="min-h-0 overflow-y-auto overscroll-contain p-2"
        style={{ maxHeight: 'min(52dvh, 420px)' }}
        ref={list}
      >
        <div
          id={listId}
          role="listbox"
          aria-label={t.search.results}
          aria-busy={loading || opening}
        >
          {groups.map((group) => (
            <div
              key={group.id}
              role="group"
              aria-labelledby={`${listId}-${group.id}`}
              className="mb-2 last:mb-0"
            >
              <div
                id={`${listId}-${group.id}`}
                className="text-muted-foreground px-2 py-2 text-[11px] font-medium"
              >
                {group.title}
              </div>
              {group.items.map((result) => {
                const Icon = result.icon
                const isActive = result.id === active?.id
                return (
                  <div
                    key={result.id}
                    id={`${listId}-${results.indexOf(result)}`}
                    role="option"
                    aria-selected={isActive}
                    aria-disabled={opening}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5',
                      isActive && 'bg-accent text-accent-foreground',
                      opening && 'pointer-events-none opacity-50',
                    )}
                    onPointerMove={() => setSelected(result.id)}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => choose(result)}
                  >
                    <span className="border-border bg-background flex size-8 shrink-0 items-center justify-center rounded-md border">
                      <Icon className="text-muted-foreground size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{result.title}</span>
                      {result.description && (
                        <span
                          className="text-muted-foreground block truncate text-xs"
                          title={result.description}
                        >
                          {result.description}
                        </span>
                      )}
                    </span>
                    {isActive ? (
                      <CornerDownLeftIcon className="text-muted-foreground size-3.5 shrink-0" />
                    ) : (
                      <ArrowUpRightIcon className="text-muted-foreground/50 size-3.5 shrink-0" />
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
        <div role="status" aria-live="polite" className="text-muted-foreground text-center text-xs">
          {loading ? <p className="px-4 py-5">{t.search.loading}</p> : null}
          {!canSearch ? <p className="px-4 py-3">{t.search.hint}</p> : null}
          {canSearch && !loading && !current?.failed && !results.length ? (
            <div className="px-4 py-10">
              <p className="text-foreground mb-1 text-sm font-medium">{t.search.empty}</p>
              <p>{t.search.emptyHint}</p>
            </div>
          ) : null}
          {current?.failed ? (
            <div className="px-4 py-5">
              <p>{t.search.failed}</p>
              <Button
                variant="outline"
                className="mt-3"
                onClick={() => {
                  setRemote(null)
                  setRetry((value) => value + 1)
                }}
              >
                {t.common.retry}
              </Button>
            </div>
          ) : null}
          {!loading && current?.data && results.length > 0 ? (
            <span className="sr-only">
              {t.search.results}: {results.length}
            </span>
          ) : null}
          {opening ? <p className="px-4 py-3">{t.common.loading}</p> : null}
        </div>
        {actionError && (
          <p role="alert" className="text-destructive px-4 py-3 text-center text-xs">
            {actionError}
          </p>
        )}
      </div>
      <div className="text-muted-foreground bg-muted/30 flex items-center gap-4 border-t px-4 py-3 text-[11px]">
        <span>
          <kbd className="font-sans">↑ ↓</kbd> {t.search.navigate}
        </span>
        <span>
          <kbd className="font-sans">↵</kbd> {t.search.open}
        </span>
        <span className="ml-auto">
          <kbd className="font-sans">Esc</kbd> {t.search.close}
        </span>
      </div>
    </>
  )
}
