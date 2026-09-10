'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronDownIcon, ChevronRightIcon } from 'lucide-react'
import type { Level, MaterialLevelShelf } from '@tp/shared'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar'
import { rememberLevel } from '@/features/library/levels'
import { counted } from '@/lib/format'
import type { Messages } from '@/messages'

/**
 * The library by level: six rows, A1 to C2, each opening onto the lessons at it.
 *
 * The spine of the product's content, and the reason it belongs in the navigation rather
 * than only on the library page — a teacher thinks in levels ("the six o'clock student is
 * B1"), and from here the lesson itself is one click away on whatever page they are on.
 *
 * A row is a disclosure and nothing else. The block this replaces put a link, a chevron
 * and a menu on every row, which is three targets in 240 pixels; the way to the whole
 * shelf is the one row at the bottom, where it is needed — when there is more than fits.
 */
export function NavLevels({
  shelves,
  open,
  locale,
  t,
}: {
  shelves: MaterialLevelShelf[]
  /** Which level was open when this person was last here. */
  open: Level | null
  locale: string
  t: Messages
}) {
  // One at a time. Six open levels at eight lessons each is a sidebar you scroll, and the
  // question a level answers is "what is at this one", not "what is at all of them".
  const [openLevel, setOpenLevel] = useState<Level | null>(open)
  const pathname = usePathname()

  const toggle = (level: Level) => {
    const next = openLevel === level ? null : level
    setOpenLevel(next)
    rememberLevel(next)
  }

  return (
    <Collapsible defaultOpen className="group/nav-group">
      {/* No icons to shrink to: a level is two characters of text, so in the rail the
          whole group stands down rather than miming itself. */}
      <SidebarGroup className="group-data-[collapsible=icon]:hidden">
        <SidebarGroupLabel asChild>
          <CollapsibleTrigger className="w-full">
            {t.nav.levels}
            <ChevronDownIcon className="ml-auto size-4 transition-transform group-data-[state=closed]/nav-group:-rotate-90" />
          </CollapsibleTrigger>
        </SidebarGroupLabel>

        <CollapsibleContent>
          <SidebarGroupContent>
            <SidebarMenu>
              {shelves.map((shelf) => {
                const rest = shelf.total - shelf.lessons.length

                return (
                  <Collapsible
                    key={shelf.level}
                    open={openLevel === shelf.level}
                    onOpenChange={() => toggle(shelf.level)}
                    className="group/level"
                  >
                    <SidebarMenuItem>
                      {/* The button outside, the trigger inside: whichever is outermost
                          lends the rendered element its `data-slot`, and a row that stops
                          calling itself a menu button loses the sidebar's own styling
                          along with it. The group label above does the same thing. */}
                      <SidebarMenuButton asChild>
                        <CollapsibleTrigger>
                          <ChevronRightIcon className="transition-transform group-data-[state=open]/level:rotate-90" />
                          <span className="font-medium tabular-nums">{shelf.level}</span>
                          <span className="text-sidebar-foreground/50 ml-auto text-xs tabular-nums">
                            {shelf.total}
                          </span>
                        </CollapsibleTrigger>
                      </SidebarMenuButton>

                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {shelf.lessons.length === 0 ? (
                            <SidebarMenuSubItem>
                              <span className="text-sidebar-foreground/60 block px-2 py-1.5 text-xs leading-relaxed">
                                {t.nav.levelEmpty}
                              </span>
                            </SidebarMenuSubItem>
                          ) : (
                            shelf.lessons.map((lesson) => (
                              <SidebarMenuSubItem key={lesson.id}>
                                <SidebarMenuSubButton
                                  asChild
                                  // Prefix-matched, so playing the lesson keeps its row lit
                                  // rather than dropping the mark for the page underneath.
                                  isActive={pathname.startsWith(`/library/${lesson.id}`)}
                                >
                                  <Link href={`/library/${lesson.id}`} title={lesson.title}>
                                    <span>{lesson.title}</span>
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            ))
                          )}

                          {/* The way to the rest of the shelf, offered only when there is a
                              rest — otherwise it is a second door to a room you can already
                              see all of. */}
                          {rest > 0 ? (
                            <SidebarMenuSubItem>
                              <SidebarMenuSubButton asChild className="text-sidebar-foreground/60">
                                <Link href={`/library?scope=all&level=${shelf.level}`}>
                                  <span>
                                    {t.nav.levelMore}{' '}
                                    {counted(rest, t.library.units.lessons, locale)}
                                  </span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ) : null}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  )
}
