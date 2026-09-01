'use client'

import Link from 'next/link'
import {
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'

export function NavMain({
  items,
}: {
  items: {
    title: string
    url: string
    icon: React.ReactNode
    isActive?: boolean
    /**
     * How many are waiting. Shown as a dot rather than the number: on a row of six words
     * the fact that something is there is the whole message, and the count is a thing to
     * read once you have gone and looked.
     */
    badge?: number
  }[]
}) {
  return (
    <SidebarMenu>
      {items.map((item) => (
        <SidebarMenuItem key={item.title}>
          <SidebarMenuButton asChild isActive={item.isActive}>
            {/* Link rather than a plain anchor: the block shipped with anchors, which
                reload the whole application on every click and throw away the sidebar. */}
            <Link href={item.url}>
              {item.icon}
              <span>{item.title}</span>
            </Link>
          </SidebarMenuButton>

          {item.badge ? (
            // The dot is its own element rather than the badge's text, because the badge
            // recolours its text on hover to match the row — which turned a white number
            // on orange into a black one.
            <SidebarMenuBadge className="right-2.5 px-0">
              <span className="relative flex size-2">
                {/* A ring leaving the dot and fading, on a loop. Behind rather than
                    around it, so the dot itself stays a crisp two pixels while the
                    signal it sends is bigger than that. */}
                <span className="bg-primary motion-safe:animate-ping absolute inline-flex size-full rounded-full opacity-70" />
                <span className="bg-primary relative inline-flex size-2 rounded-full" />
              </span>
              <span className="sr-only">{item.badge}</span>
            </SidebarMenuBadge>
          ) : null}
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  )
}
