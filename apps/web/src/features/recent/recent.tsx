'use client'

import { createContext, useCallback, useContext, useEffect, useSyncExternalStore } from 'react'
import { usePathname } from 'next/navigation'
import { pageNameFor } from '@/components/app-breadcrumb'
import type { Messages } from '@/messages'

/**
 * The pages somebody opened lately, so the way back to what they were in the middle of is
 * one click rather than a search.
 *
 * Every page is remembered as it is opened, under the name the breadcrumb gives it. A page
 * that knows better — a lesson knows its title, a conversation knows who it is with —
 * says so for itself, and that name wins.
 *
 * Kept in this browser rather than on the server: it is a convenience of the machine
 * somebody works at, it costs no round trip, and nothing here is worth a table. It is
 * kept under the account, so the next person to sign in on a shared computer is not shown
 * the last one's lessons.
 */

export type RecentKind = 'lesson' | 'homework' | 'task' | 'conversation' | 'page'

export type RecentPage = {
  href: string
  title: string
  kind: RecentKind
  /** When it was last opened, so the newest is at the top. */
  at: number
}

/** A sidebar list, not a history: the last few, at a glance, without a scroll. */
const KEPT = 4
/** One shared empty list, so React is handed the same one every time nothing is there. */
const NOTHING: RecentPage[] = []

const KINDS = new Set<string>(['lesson', 'homework', 'task', 'conversation', 'page'])

const AccountContext = createContext<string | null>(null)

const keyFor = (account: string) => `tp.recent.${account}`

// What was last read from storage, so that a render is handed the same array until
// something actually changes — `useSyncExternalStore` asks for it on every render.
const held = new Map<string, RecentPage[]>()
const listeners = new Set<() => void>()

function isPage(value: unknown): value is RecentPage {
  const page = value as Partial<RecentPage> | null

  return (
    !!page &&
    typeof page === 'object' &&
    typeof page.href === 'string' &&
    // A path on this site, and only that: "//elsewhere.example" also starts with a slash,
    // and would be a link out of the app wearing a lesson's name.
    /^\/(?![/\\])/.test(page.href) &&
    typeof page.title === 'string' &&
    page.title.length > 0 &&
    typeof page.kind === 'string' &&
    KINDS.has(page.kind) &&
    typeof page.at === 'number' &&
    Number.isFinite(page.at)
  )
}

function read(key: string): RecentPage[] {
  const cached = held.get(key)
  if (cached) return cached

  let pages: RecentPage[] = NOTHING
  try {
    const raw = window.localStorage.getItem(key)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    if (Array.isArray(parsed)) {
      const kept = parsed.filter(isPage).slice(0, KEPT)
      if (kept.length > 0) pages = kept
    }
  } catch {
    // A browser that refuses storage, or something else's data under our key: no list.
  }

  held.set(key, pages)

  return pages
}

function write(key: string, pages: RecentPage[]) {
  held.set(key, pages)
  try {
    window.localStorage.setItem(key, JSON.stringify(pages))
  } catch {
    // Remembered for this visit even when the browser will not keep it for the next.
  }
  for (const listener of listeners) listener()
}

/**
 * Puts a page at the top of the list, where it was already or not.
 *
 * A weak note is the frame saying "they are here now" with the name the route gives it. It
 * moves a page it already knows to the top without touching the better name the page gave
 * itself — so a lesson stays under its title rather than reverting to the word "lesson"
 * every time somebody opens it.
 */
function remember(key: string, page: RecentPage, { weak = false } = {}) {
  const current = read(key)
  const known = current.find((other) => other.href === page.href)
  const kept = weak && known ? { ...known, at: page.at } : page

  // Re-noting the page already at the top, under the same name, is not worth a write.
  const first = current[0]
  if (first && first.href === kept.href && first.title === kept.title) return

  write(key, [kept, ...current.filter((other) => other.href !== kept.href)].slice(0, KEPT))
}

/** Takes a page off the list, for one that is no longer there to go back to. */
function forget(key: string, href: string) {
  const current = read(key)
  if (!current.some((page) => page.href === href)) return

  write(
    key,
    current.filter((page) => page.href !== href),
  )
}

/**
 * Empties every account's list on this machine. Called when somebody signs out — the
 * titles are the names of their students, and the next person at a shared computer has no
 * business with them.
 */
export function forgetEveryone() {
  try {
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith('tp.recent.')) window.localStorage.removeItem(key)
    }
  } catch {
    // A browser that refuses storage had nothing to clear.
  }
  held.clear()
  for (const listener of listeners) listener()
}

/**
 * Whose list this is. Rendered around the frame, so both the sidebar that shows the list
 * and the pages that add to it are talking about the same person.
 */
export function RecentProvider({
  account,
  children,
}: {
  account: string
  children: React.ReactNode
}) {
  return <AccountContext.Provider value={account}>{children}</AccountContext.Provider>
}

/** The pages this person opened lately, newest first. */
export function useRecent(): RecentPage[] {
  const account = useContext(AccountContext)
  const key = account ? keyFor(account) : null

  const subscribe = useCallback(
    (onChange: () => void) => {
      listeners.add(onChange)
      // Another tab of the same account: what it opened belongs on this list too.
      const onStorage = (event: StorageEvent) => {
        if (key && (event.key === key || event.key === null)) {
          held.delete(key)
          onChange()
        }
      }
      window.addEventListener('storage', onStorage)

      return () => {
        listeners.delete(onChange)
        window.removeEventListener('storage', onStorage)
      }
    },
    [key],
  )

  return useSyncExternalStore(
    subscribe,
    () => (key ? read(key) : NOTHING),
    // The server has no browser to read, and says so rather than guessing.
    () => NOTHING,
  )
}

/**
 * Whether the browser's own list has been read yet. The server has no list to render, so
 * the first paint of every hard load has none either — and a sidebar that says "nothing
 * here yet" during it is telling somebody with eight pages open that they have none.
 */
const NEVER_CHANGES = () => () => {}

export function useHydrated(): boolean {
  return useSyncExternalStore(
    NEVER_CHANGES,
    () => true,
    () => false,
  )
}

/**
 * Rendered by a page that has a better name than its address does — a lesson's title, the
 * person a conversation is with. Its note is not weak, so it overwrites the frame's
 * whichever of the two lands second, and the title it gives is the one that stays.
 */
export function Visited({ kind, title }: { kind: RecentKind; title: string }) {
  const account = useContext(AccountContext)
  const pathname = usePathname()

  useEffect(() => {
    if (!account || title.length === 0) return

    remember(keyFor(account), { href: pathname, title, kind, at: Date.now() })
  }, [account, pathname, kind, title])

  return null
}

/**
 * Rendered by the panel a dead link lands on — a lesson that was emptied out of the bin,
 * homework that was withdrawn. The way back to it is a way to nowhere, so it goes.
 */
export function Forget() {
  const account = useContext(AccountContext)
  const pathname = usePathname()

  useEffect(() => {
    if (account) forget(keyFor(account), pathname)
  }, [account, pathname])

  return null
}

/** Pages there is no use coming back to: a room that closes, and the way in. */
const NOT_WORTH_IT = ['/live/', '/login', '/signup']

/**
 * Rendered once by the frame: whatever page somebody is on goes on the list, under the
 * name the route gives it, unless the page has already given a better one.
 */
export function RecordPage({ t }: { t: Messages }) {
  const account = useContext(AccountContext)
  const pathname = usePathname()

  useEffect(() => {
    if (!account) return
    if (NOT_WORTH_IT.some((leave) => pathname.startsWith(leave))) return

    remember(
      keyFor(account),
      { href: pathname, title: pageNameFor(pathname, t), kind: 'page', at: Date.now() },
      { weak: true },
    )
  }, [account, pathname, t])

  return null
}
