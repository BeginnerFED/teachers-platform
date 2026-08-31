import type { ReactNode } from 'react'
import { AppSidebar } from '@/components/app-sidebar'
import { NavActions } from '@/components/nav-actions'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb'
import { Separator } from '@/components/ui/separator'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import type { Viewer } from '@/lib/auth'

/**
 * The sidebar-10 frame, in one place. Each role page had its own copy of this markup,
 * which was fine at three and would not have been at ten.
 */
export function AppShell({
  viewer,
  breadcrumb,
  children,
}: {
  viewer: Viewer
  breadcrumb: string
  children: ReactNode
}) {
  return (
    <SidebarProvider>
      <AppSidebar
        role={viewer.role}
        user={{ name: viewer.full_name ?? viewer.email, email: viewer.email }}
      />

      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b">
          <div className="flex flex-1 items-center gap-2 px-3">
            <SidebarTrigger />
            <Separator
              orientation="vertical"
              className="data-vertical:h-4 data-vertical:self-auto mr-2"
            />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbPage className="line-clamp-1">{breadcrumb}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="ml-auto px-3">
            <NavActions />
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-6 px-4 py-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
