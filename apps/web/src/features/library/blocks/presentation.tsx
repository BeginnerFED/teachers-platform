'use client'

import { useState, type ReactNode } from 'react'
import { HeadphonesIcon, ImageIcon, InfoIcon, LightbulbIcon, TriangleAlertIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Messages } from '@/messages'
import type { StudentBlockOf } from './types'

/** Blocks that say something rather than ask something. Nothing here takes an answer. */

export function HeadingBlock({ block }: { block: StudentBlockOf<'heading'> }) {
  const Tag = block.level === 2 ? 'h2' : 'h3'

  return (
    <Tag className={cn('font-semibold', block.level === 2 ? 'text-xl' : 'text-base')}>
      {block.text}
    </Tag>
  )
}

export function TextBlock({ block }: { block: StudentBlockOf<'text'> }) {
  // Line breaks the author typed are line breaks the student sees. Without this a
  // two-line contrast — the whole point of most grammar notes — collapses into one.
  return <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{block.text}</p>
}

/** Exported for the editor, which draws the same box around the text being typed into it. */
export const CALLOUT_STYLE = {
  info: {
    icon: InfoIcon,
    className: 'border-sky-500/30 bg-sky-500/5 text-sky-700 dark:text-sky-300',
  },
  tip: {
    icon: LightbulbIcon,
    className: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300',
  },
  warning: {
    icon: TriangleAlertIcon,
    className: 'border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300',
  },
  grammar: {
    icon: InfoIcon,
    className: 'border-primary/30 bg-primary/5 text-foreground',
  },
} as const

export function CalloutBlock({ block }: { block: StudentBlockOf<'callout'> }) {
  const { icon: Icon, className } = CALLOUT_STYLE[block.tone]

  return (
    <aside className={cn('flex gap-3 rounded-lg border p-4', className)}>
      <Icon className="mt-0.5 size-4 shrink-0" />

      <div className="space-y-1">
        {block.title ? <p className="text-sm font-semibold">{block.title}</p> : null}
        <p className="text-foreground/90 whitespace-pre-wrap text-sm leading-relaxed">
          {block.text}
        </p>
      </div>
    </aside>
  )
}

/**
 * Uploads arrive with the editor, so there is nothing behind an assetId yet. Drawn as a
 * labelled placeholder rather than a broken image: a lesson that contains one should still
 * read correctly around it.
 */
export function MediaPlaceholder({
  icon: Icon,
  label,
  caption,
}: {
  icon: typeof ImageIcon
  label: string
  caption?: ReactNode
}) {
  return (
    <figure className="space-y-2">
      <div className="bg-muted/40 text-muted-foreground flex min-h-28 items-center justify-center gap-2 rounded-lg border border-dashed text-sm">
        <Icon className="size-4" />
        {label}
      </div>
      {caption ? (
        <figcaption className="text-muted-foreground text-xs">{caption}</figcaption>
      ) : null}
    </figure>
  )
}

export function ImageBlock({ block }: { block: StudentBlockOf<'image'> }) {
  return <MediaPlaceholder icon={ImageIcon} label={block.alt} caption={block.caption} />
}

export function AudioBlock({ block, t }: { block: StudentBlockOf<'audio'>; t: Messages }) {
  const [showTranscript, setShowTranscript] = useState(false)

  return (
    <div className="space-y-2">
      <MediaPlaceholder icon={HeadphonesIcon} label="Audio" caption={block.caption} />

      {block.transcript ? (
        <div>
          {/* Hidden by default: a visible transcript turns listening practice into
              reading practice. */}
          <button
            type="button"
            onClick={() => setShowTranscript((open) => !open)}
            className="text-muted-foreground hover:text-foreground text-xs underline underline-offset-4"
          >
            {showTranscript ? t.library.blocks.hideTranscript : t.library.blocks.showTranscript}
          </button>

          {showTranscript ? (
            <p className="text-muted-foreground mt-2 whitespace-pre-wrap text-sm">
              {block.transcript}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export function VideoBlock({ block }: { block: StudentBlockOf<'video'> }) {
  const params = new URLSearchParams({ rel: '0', modestbranding: '1' })
  if (block.start !== undefined) params.set('start', String(block.start))
  if (block.end !== undefined) params.set('end', String(block.end))

  return (
    <figure className="space-y-2">
      <div className="aspect-video overflow-hidden rounded-lg border">
        {/* nocookie, because embedding a tracker into a lesson a child watches is not a
            decision this product gets to make on a teacher's behalf. */}
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${block.videoId}?${params}`}
          title={block.caption ?? 'Video'}
          allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture"
          allowFullScreen
          className="size-full"
        />
      </div>
      {block.caption ? (
        <figcaption className="text-muted-foreground text-xs">{block.caption}</figcaption>
      ) : null}
    </figure>
  )
}

export function DividerBlock() {
  return <hr className="border-border" />
}

/**
 * A passage. Comprehension questions are separate blocks placed under it, so this one
 * carries no answer of its own — it is something to read before the questions start.
 */
export function ReadingBlock({ block }: { block: StudentBlockOf<'reading'> }) {
  return (
    <article className="bg-muted/30 space-y-3 rounded-lg border p-4 sm:p-5">
      {block.title ? <h3 className="text-base font-semibold">{block.title}</h3> : null}
      <p className="whitespace-pre-wrap text-[15px] leading-7">{block.passage}</p>
    </article>
  )
}
