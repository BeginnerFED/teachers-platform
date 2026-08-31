import { cn } from '@/lib/utils'

/**
 * Loading placeholder with a shimmer sweep.
 *
 * The sweep is a pseudo-element rather than an animation on the block itself, so the
 * skeleton keeps a steady base colour and only the highlight moves. Anyone who has asked
 * their system to reduce motion gets the plain block: a pulsing page is a real problem
 * for some people, and the placeholder still reads perfectly well without it.
 */
function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn(
        'bg-muted relative isolate overflow-hidden rounded-md',
        "before:absolute before:inset-0 before:content-['']",
        'before:animate-shimmer before:-translate-x-full',
        'before:bg-linear-to-r before:from-transparent before:via-white/60 before:to-transparent',
        'dark:before:via-white/10',
        'motion-reduce:before:hidden',
        className,
      )}
      {...props}
    />
  )
}

export { Skeleton }
