import { GraduationCapIcon } from 'lucide-react'

/**
 * The product's name at the top of the sidebar.
 *
 * The block shipped a team switcher here, with three invented companies behind it. There
 * is nothing to switch between — one platform, one shelf — so this is a nameplate rather
 * than a control: a row that opens nothing teaches whoever clicks it that the product is
 * unfinished.
 */
export function AppBrand({ name }: { name: string }) {
  return (
    <div className="flex h-8 items-center gap-2 px-1.5">
      <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-5 shrink-0 items-center justify-center rounded-md">
        <GraduationCapIcon className="size-3.5" />
      </div>

      <span className="truncate text-sm font-medium group-data-[collapsible=icon]:hidden">
        {name}
      </span>
    </div>
  )
}
