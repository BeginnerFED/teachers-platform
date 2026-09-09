'use client'

import { useState, useSyncExternalStore } from 'react'
import { ArrowRightIcon, RadioIcon } from 'lucide-react'
import type { LivePublicRoom } from '@tp/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Messages } from '@/messages'
import { LiveRoom } from './live-room'

const STORAGE_KEY = 'tp.live.guest'

type Guest = { id: string; name: string }

/**
 * Who this browser was last time, read as an external store: the server knows nobody, the
 * browser may remember somebody, and React reconciles the two without a flash of the
 * wrong one being set into state.
 */
const subscribe = (onChange: () => void) => {
  window.addEventListener('storage', onChange)
  return () => window.removeEventListener('storage', onChange)
}
const readStored = () => {
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}
const readNothing = () => null

function parseGuest(raw: string | null): Guest | null {
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as Partial<Guest>
    return parsed.id && parsed.name ? { id: parsed.id, name: parsed.name } : null
  } catch {
    return null
  }
}

/**
 * The door for somebody who holds the link and nothing else. One question — what to call
 * them — and they are in, as a guest, with a colour of their own. The name is kept in
 * this browser so the same person comes back as the same person.
 */
export function GuestGate({
  room,
  t,
  locale,
}: {
  room: LivePublicRoom
  t: Messages
  locale: string
}) {
  const stored = parseGuest(useSyncExternalStore(subscribe, readStored, readNothing))
  const [entered, setEntered] = useState<Guest | null>(null)
  const [name, setName] = useState('')

  const guest = entered ?? stored

  if (guest) {
    return <LiveRoom room={{ ...room, role: 'guest', me: guest }} anonymous t={t} locale={locale} />
  }

  const enter = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = name.trim().slice(0, 60)
    if (!trimmed) return

    const next = { id: `guest-${crypto.randomUUID()}`, name: trimmed }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // A browser that refuses storage still gets in; it will just be asked again next time.
    }
    setEntered(next)
  }

  const teacher = room.session.teacher.fullName || room.session.teacher.email || t.live.hostTag

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{room.lesson.title}</h1>
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <RadioIcon className="size-3.5" />
          {t.live.withTeacher} {teacher}
        </p>
      </div>

      <form
        onSubmit={enter}
        className="border-border/60 bg-card mx-auto flex w-full max-w-md flex-col gap-5 rounded-2xl border p-7"
      >
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold tracking-tight">{t.live.join.namePrompt}</h2>
          <p className="text-muted-foreground text-sm">{t.live.join.nameHelp}</p>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="guest-name" className="text-xs font-medium">
            {t.live.join.nameLabel}
          </Label>
          <Input
            id="guest-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t.live.join.namePlaceholder}
            maxLength={60}
            autoFocus
            required
          />
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={!name.trim()}>
            {t.live.join.enter}
            <ArrowRightIcon />
          </Button>
        </div>
      </form>
    </>
  )
}
