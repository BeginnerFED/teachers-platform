'use client'

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Tabs as TabsPrimitive } from 'radix-ui'

import { cn } from '@/lib/utils'

function Tabs({
  className,
  orientation = 'horizontal',
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn('group/tabs data-horizontal:flex-col flex gap-2', className)}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  'group/tabs-list relative inline-flex w-fit items-center justify-center rounded-full p-1 text-muted-foreground group-data-horizontal/tabs:h-8 group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col data-[variant=line]:rounded-none',
  {
    variants: {
      variant: {
        default: 'bg-muted',
        line: 'gap-1 bg-transparent',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

function TabsList({
  className,
  variant = 'default',
  children,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> & VariantProps<typeof tabsListVariants>) {
  const list = React.useRef<HTMLDivElement | null>(null)
  const pill = React.useRef<HTMLSpanElement | null>(null)

  /**
   * One pill that slides, rather than a background fading out on one tab while another
   * fades in — which is what makes switching read as a jump. Written straight to the node:
   * this is a position, it changes on a click and on a resize, and routing it through state
   * would re-render the tabs to move something React does not need to know about.
   */
  React.useEffect(() => {
    const container = list.current
    const marker = pill.current
    if (!container || !marker) return

    const place = () => {
      // `aria-selected` rather than a data attribute: it is part of the tabs ARIA pattern
      // itself, so no upgrade can quietly rename it out from under this.
      const active = container.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')

      if (!active) {
        marker.style.opacity = '0'
        return
      }

      marker.style.opacity = '1'
      marker.style.width = `${active.offsetWidth}px`
      marker.style.height = `${active.offsetHeight}px`
      marker.style.transform = `translate(${active.offsetLeft}px, ${active.offsetTop}px)`

      // Transitions are turned on only after it has been put somewhere once, or the first
      // paint would slide it in from the corner of the list.
      requestAnimationFrame(() => marker.setAttribute('data-ready', ''))
    }

    place()

    // Radix flips aria-selected on the buttons themselves, and the list can change width
    // — a font arriving, the window resizing — with no React render at all.
    const selection = new MutationObserver(place)
    selection.observe(container, {
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-selected'],
    })

    const size = new ResizeObserver(place)
    size.observe(container)

    return () => {
      selection.disconnect()
      size.disconnect()
    }
  }, [])

  return (
    <TabsPrimitive.List
      ref={list}
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    >
      {/* The line variant marks its tab with an underline of its own, so there is no pill
          to move there. */}
      {variant === 'default' ? (
        <span
          ref={pill}
          aria-hidden
          className="bg-background dark:border-input dark:bg-input/30 data-ready:duration-300 data-ready:ease-[cubic-bezier(0.22,1,0.36,1)] data-ready:transition-[transform,width,height,opacity] pointer-events-none absolute left-0 top-0 rounded-full border border-transparent opacity-0 shadow-sm motion-reduce:transition-none"
        />
      ) : null}

      {children}
    </TabsPrimitive.List>
  )
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "text-foreground/60 group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start hover:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1 dark:text-muted-foreground dark:hover:text-foreground relative z-10 inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-transparent px-3 py-0.5 text-xs font-medium transition-colors focus-visible:outline-1 focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        'group-data-[variant=line]/tabs-list:bg-transparent',
        // The pill behind the tabs carries the active background now — a tab paints only
        // its own text, so the two cannot both animate and fight each other.
        'data-active:text-foreground dark:data-active:text-foreground',
        'after:bg-foreground group-data-horizontal/tabs:after:inset-x-0 group-data-horizontal/tabs:after:bottom-[-5px] group-data-horizontal/tabs:after:h-0.5 group-data-vertical/tabs:after:inset-y-0 group-data-vertical/tabs:after:-right-1 group-data-vertical/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-active:after:opacity-100 after:absolute after:opacity-0 after:transition-opacity',
        className,
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn('flex-1 text-sm outline-none', className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
