'use client'

import { PlusIcon } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useMemo, useState, useTransition, type ReactNode } from 'react'
import type { ConversationSummary, Correspondent } from '@tp/shared'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Label } from '@/components/ui/label'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInput,
} from '@/components/ui/sidebar'
import { Switch } from '@/components/ui/switch'
import { formatRelative } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Messages } from '@/messages'
import { loadRecipients, startConversation } from '../actions'
import { ThreadSkeleton } from './thread-skeleton'

/**
 * The list of conversations beside the one being read, on the shape of the mail block:
 * a header carrying the title, an unread filter and a search box, then rows.
 *
 * The block's outer icon rail is not repeated here — this application already has one, and
 * two of them side by side would be two answers to the same question.
 */
export function InboxPanel({
  conversations,
  t,
  locale,
  children,
}: {
  conversations: ConversationSummary[]
  t: Messages
  locale: string
  children: ReactNode
}) {
  const pathname = usePathname()
  const [term, setTerm] = useState('')
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [, startTransition] = useTransition()
  // Loaded when the picker is opened. Most visits to the inbox are to read something, and
  // paying for this list on each of them was a round trip nobody asked for.
  const [recipients, setRecipients] = useState<Correspondent[] | null>(null)
  /**
   * Opening a conversation from the picker is a request and then a navigation, and the
   * route's own skeleton only covers the second half. Without this the panel sits on
   * whatever was there before for the length of the first.
   *
   * Held as the path it started from rather than a boolean, so arriving somewhere else is
   * what ends it — no effect watching for a change it cannot see the end of.
   */
  const [startedAt, setStartedAt] = useState<string | null>(null)
  const starting = startedAt !== null && startedAt === pathname

  const shown = useMemo(() => {
    const needle = term.trim().toLowerCase()

    return conversations.filter((conversation) => {
      if (unreadOnly && conversation.unread === 0) return false
      if (!needle) return true

      const name = (conversation.other.fullName ?? conversation.other.email).toLowerCase()

      // Both ends of what a person would type: who it is with, and what was said.
      return (
        name.includes(needle) ||
        conversation.other.email.toLowerCase().includes(needle) ||
        (conversation.lastMessage?.body.toLowerCase().includes(needle) ?? false)
      )
    })
  }, [conversations, term, unreadOnly])

  const total = conversations.reduce((sum, conversation) => sum + conversation.unread, 0)

  return (
    <>
      <Sidebar collapsible="none" className="w-96 shrink-0 border-r">
        <SidebarHeader className="gap-3.5 border-b p-4">
          <div className="flex w-full items-center justify-between">
            <div className="text-foreground flex items-baseline gap-2 text-base font-medium">
              {t.inbox.title}
              {total > 0 ? (
                <span className="text-muted-foreground text-sm tabular-nums">({total})</span>
              ) : null}
            </div>

            <div className="flex items-center gap-3">
              <Label className="flex items-center gap-2 text-sm">
                <span>{t.inbox.unreadsOnly}</span>
                <Switch
                  className="shadow-none"
                  checked={unreadOnly}
                  onCheckedChange={setUnreadOnly}
                />
              </Label>

              <DropdownMenu
                onOpenChange={(open) => {
                  if (open && recipients === null) {
                    startTransition(async () => setRecipients(await loadRecipients()))
                  }
                }}
              >
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-7"
                    aria-label={t.inbox.newConversation}
                  >
                    <PlusIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="max-h-80 w-64 overflow-y-auto">
                  {recipients === null ? (
                    <DropdownMenuItem disabled>{t.common.loading}</DropdownMenuItem>
                  ) : recipients.length === 0 ? (
                    <DropdownMenuItem disabled>{t.inbox.nobodyToWriteTo}</DropdownMenuItem>
                  ) : (
                    recipients.map((person) => (
                      <DropdownMenuItem
                        key={person.id}
                        onSelect={() => {
                          const formData = new FormData()
                          formData.set('recipientId', person.id)
                          setStartedAt(pathname)
                          startTransition(async () => {
                            await startConversation(formData)
                            // Covers the one case the path cannot: picking somebody whose
                            // conversation is already the one on screen.
                            setStartedAt(null)
                          })
                        }}
                      >
                        <span className="truncate">{person.fullName ?? person.email}</span>
                        <span className="text-muted-foreground ml-auto text-xs">
                          {t.roles[person.role]}
                        </span>
                      </DropdownMenuItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <SidebarInput
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder={t.inbox.search}
            aria-label={t.inbox.search}
          />
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup className="px-0">
            <SidebarGroupContent>
              {shown.length === 0 ? (
                <p className="text-muted-foreground p-4 text-sm">
                  {conversations.length === 0 ? t.inbox.empty : t.inbox.noMatches}
                </p>
              ) : (
                shown.map((conversation) => {
                  const name = conversation.other.fullName ?? conversation.other.email
                  const active = pathname === `/inbox/${conversation.id}`

                  return (
                    <Link
                      href={`/inbox/${conversation.id}`}
                      key={conversation.id}
                      className={cn(
                        'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex flex-col items-start gap-2 border-b p-4 text-sm leading-tight whitespace-nowrap last:border-b-0',
                        active && 'bg-sidebar-accent text-sidebar-accent-foreground',
                      )}
                    >
                      <div className="flex w-full items-center gap-2">
                        <span className={cn('truncate', conversation.unread > 0 && 'font-medium')}>
                          {name}
                        </span>

                        {conversation.unread > 0 ? (
                          <span className="bg-primary text-primary-foreground flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums">
                            {conversation.unread}
                          </span>
                        ) : null}

                        <span className="text-muted-foreground ml-auto shrink-0 text-xs">
                          {conversation.lastMessage
                            ? formatRelative(conversation.lastMessage.createdAt, locale)
                            : ''}
                        </span>
                      </div>

                      <span
                        className={cn(
                          'line-clamp-2 w-[300px] text-xs whitespace-break-spaces',
                          conversation.unread > 0 ? 'text-foreground' : 'text-muted-foreground',
                        )}
                      >
                        {/* Whose line it was, so a list of replies is not a list of
                            sentences with no speaker. */}
                        {conversation.lastMessage?.mine ? `${t.inbox.you}: ` : ''}
                        {conversation.lastMessage?.body ?? ''}
                      </span>
                    </Link>
                  )
                })
              )}
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {starting ? <ThreadSkeleton /> : children}
      </div>
    </>
  )
}
