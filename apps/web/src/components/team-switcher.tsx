'use client'

import * as React from 'react'

import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar'

/**
 * A plain brand row. The block shipped this as a dropdown for switching between teams,
 * which there is nothing to switch between here — so the menu and its chevron are gone
 * rather than left as a control that opens onto a list of one.
 */
export function TeamSwitcher({
  teams,
}: {
  teams: {
    name: string
    logo: React.ReactNode
    plan: string
  }[]
}) {
  const team = teams[0]

  if (!team) {
    return null
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton className="w-fit px-1.5">
          <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-5 items-center justify-center rounded-md">
            {team.logo}
          </div>
          <span className="truncate font-medium">{team.name}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
