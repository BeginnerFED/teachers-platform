'use client'

import { SendIcon } from 'lucide-react'
import { useEffect, useMemo, useOptimistic, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { PLATFORM_TIME_ZONE, type Thread, type ThreadMessage } from '@tp/shared'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { initials } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Messages } from '@/messages'
import { initialSendState } from '../action-state'
import { markRead, sendMessage } from '../actions'

type Shown = ThreadMessage & { pending?: boolean }

/**
 * A conversation is read as a sequence of days, not as a list of full timestamps: the date
 * is said once at the top of each day and every line under it needs only an hour.
 */
function groupByDay(messages: Shown[], locale: string) {
  const day = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    timeZone: PLATFORM_TIME_ZONE,
  })

  const groups: { key: string; label: string; messages: Shown[] }[] = []

  for (const message of messages) {
    const label = day.format(new Date(message.createdAt))
    const last = groups.at(-1)

    if (last && last.key === label) last.messages.push(message)
    else groups.push({ key: label, label, messages: [message] })
  }

  return groups
}

export function ThreadView({
  thread,
  locale,
  t,
}: {
  thread: Thread
  locale: string
  t: Messages
}) {
  const [body, setBody] = useState('')
  const [pending, startTransition] = useTransition()
  const bottom = useRef<HTMLDivElement>(null)

  /**
   * The message appears the moment it is typed rather than after a round trip to
   * Frankfurt and back. React drops it again when the server's own copy arrives, and the
   * two are indistinguishable because the server returns the same text.
   */
  const [messages, addOptimistic] = useOptimistic(
    thread.messages as Shown[],
    (current, added: Shown) => [...current, added],
  )

  const name = thread.other.fullName ?? thread.other.email
  const groups = useMemo(() => groupByDay(messages, locale), [messages, locale])

  const clock = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: PLATFORM_TIME_ZONE,
      }),
    [locale],
  )

  // Opening a conversation is reading it.
  useEffect(() => {
    void markRead(thread.id)
  }, [thread.id])

  // A conversation is read from the bottom, which is where the newest line is.
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' })
  }, [thread.id, messages.length])

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const text = body.trim()
    if (!text) return

    const formData = new FormData()
    formData.set('conversationId', thread.id)
    formData.set('body', text)

    // Cleared straight away: waiting for the round trip to empty the box makes a fast
    // connection feel slow and a slow one feel broken.
    setBody('')

    startTransition(async () => {
      // Stamped here rather than inside the reducer, which re-runs on every render and
      // would give the same message a different time each time.
      addOptimistic({
        id: `pending-${Date.now()}`,
        body: text,
        createdAt: new Date().toISOString(),
        mine: true,
        pending: true,
      })

      const result = await sendMessage(initialSendState, formData)

      if (result.error) {
        toast.error(t.errors[result.error])
        // Handed back rather than lost, so a failure costs nothing that was typed.
        setBody(text)
      }
    })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b p-4">
        <Avatar className="size-9 rounded-full">
          <AvatarFallback className="rounded-full border border-current/50 text-xs font-semibold">
            {initials(name)}
          </AvatarFallback>
        </Avatar>
        <div className="grid min-w-0">
          <span className="truncate text-sm font-medium">{name}</span>
          <span className="text-muted-foreground truncate text-xs">
            {t.roles[thread.other.role]} · {thread.other.email}
          </span>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
        {messages.length === 0 ? (
          <p className="text-muted-foreground m-auto text-sm">{t.inbox.noMessages}</p>
        ) : (
          // mt-auto rather than justify-end: a short conversation sits against the
          // composer where the newest line belongs, and a long one still scrolls from the
          // top instead of having its first day cut off, which is what justify-end does to
          // content taller than its box.
          <div className="mt-auto flex flex-col">
          {groups.map((group) => (
            <div key={group.key} className="flex flex-col">
              <div className="my-3 flex items-center gap-3">
                <span className="bg-border h-px flex-1" />
                <span className="text-muted-foreground text-[11px]">{group.label}</span>
                <span className="bg-border h-px flex-1" />
              </div>

              {group.messages.map((message, index) => {
                // Consecutive lines from one person read as one turn, so they sit close
                // together and only the last of them carries the time.
                const previous = group.messages[index - 1]
                const next = group.messages[index + 1]
                const starts = !previous || previous.mine !== message.mine
                const ends = !next || next.mine !== message.mine

                return (
                  <div
                    key={message.id}
                    className={cn(
                      // self-start, not the default stretch: a bubble should be as wide as
                      // what is in it, not as wide as the room it is in.
                      'flex max-w-[75%] flex-col',
                      message.mine ? 'self-end items-end' : 'self-start items-start',
                      starts ? 'mt-2' : 'mt-0.5',
                      message.pending && 'opacity-60',
                    )}
                  >
                    <div
                      className={cn(
                        'px-3 py-1.5 text-sm whitespace-pre-wrap',
                        message.mine
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-foreground',
                        // Square off the corner where a turn continues, so a run of lines
                        // reads as one block rather than as separate remarks.
                        message.mine
                          ? cn(
                              'rounded-l-2xl',
                              starts ? 'rounded-tr-2xl' : 'rounded-tr-md',
                              ends ? 'rounded-br-md' : 'rounded-br-md',
                            )
                          : cn(
                              'rounded-r-2xl',
                              starts ? 'rounded-tl-2xl' : 'rounded-tl-md',
                              ends ? 'rounded-bl-md' : 'rounded-bl-md',
                            ),
                      )}
                    >
                      {message.body}
                    </div>

                    {ends ? (
                      <span className="text-muted-foreground mt-1 text-[11px] tabular-nums">
                        {clock.format(new Date(message.createdAt))}
                      </span>
                    ) : null}
                  </div>
                )
              })}
            </div>
          ))}
          </div>
        )}

        <div ref={bottom} />
      </div>

      <form onSubmit={submit} className="flex shrink-0 items-center gap-2 border-t p-4">
        <Input
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder={t.inbox.writePlaceholder}
          aria-label={t.inbox.writePlaceholder}
          maxLength={4000}
          autoComplete="off"
        />
        <Button
          type="submit"
          size="icon"
          disabled={pending || body.trim().length === 0}
          aria-label={t.inbox.send}
          className="corner-brackets shrink-0"
        >
          <SendIcon />
        </Button>
      </form>
    </div>
  )
}
