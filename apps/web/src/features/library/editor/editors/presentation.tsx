'use client'

import { HeadphonesIcon, ImageIcon, VideoIcon } from 'lucide-react'
import { CALLOUT_TONES } from '@tp/shared'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { CALLOUT_STYLE, MediaPlaceholder } from '../../blocks/presentation'
import { extractYouTubeId, type EditorProps } from '../block-defaults'
import { InlineText, InlineTextarea, SettingNumber, Settings } from '../inline'

/**
 * The blocks that say something, drawn exactly as the player draws them, with the words
 * typed straight into place. Compare each with its twin in blocks/presentation.tsx: the
 * classes on the text are the same classes.
 */

export function HeadingEditor({ draft, onChange, t }: EditorProps<'heading'>) {
  const level = draft.level ?? 2

  return (
    <div className="grid gap-1">
      <Settings>
        <span>{t.library.editor.fields.headingLevel}</span>
        <Select
          value={String(level)}
          onValueChange={(value) => onChange({ level: value === '3' ? 3 : 2 })}
        >
          <SelectTrigger className="h-6 w-16 px-2 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="2">H2</SelectItem>
            <SelectItem value="3">H3</SelectItem>
          </SelectContent>
        </Select>
      </Settings>

      <InlineText
        value={draft.text ?? ''}
        onChange={(text) => onChange({ text })}
        placeholder={t.library.editor.blocks.heading}
        maxLength={200}
        className={cn('font-semibold', level === 2 ? 'text-xl' : 'text-base')}
      />
    </div>
  )
}

export function TextEditor({ draft, onChange, t }: EditorProps<'text'>) {
  return (
    <InlineTextarea
      value={draft.text ?? ''}
      onChange={(text) => onChange({ text, format: 'plain' })}
      placeholder={t.library.editor.fields.text}
      maxLength={5000}
      className="text-[15px] leading-relaxed"
    />
  )
}

export function CalloutEditor({ draft, onChange, t }: EditorProps<'callout'>) {
  const tone = draft.tone ?? 'info'
  const { icon: Icon, className } = CALLOUT_STYLE[tone]

  return (
    <div className="grid gap-1">
      <Settings>
        <span>{t.library.editor.fields.tone}</span>
        <Select
          value={tone}
          onValueChange={(next) => onChange({ tone: next as (typeof CALLOUT_TONES)[number] })}
        >
          <SelectTrigger className="h-6 w-32 px-2 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CALLOUT_TONES.map((option) => (
              <SelectItem key={option} value={option}>
                {t.library.editor.fields.tones[option]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Settings>

      {/* The box the student sees, with the cursor inside it. */}
      <aside className={cn('flex gap-3 rounded-lg border p-4', className)}>
        <Icon className="mt-0.5 size-4 shrink-0" />

        <div className="min-w-0 flex-1 space-y-1">
          <InlineText
            value={draft.title ?? ''}
            onChange={(title) => onChange({ title: title || undefined })}
            placeholder={t.library.editor.fields.title}
            maxLength={120}
            className="text-sm font-semibold"
          />
          <InlineTextarea
            value={draft.text ?? ''}
            onChange={(text) => onChange({ text })}
            placeholder={t.library.editor.fields.text}
            maxLength={2000}
            className="text-foreground/90 text-sm leading-relaxed"
          />
        </div>
      </aside>
    </div>
  )
}

/** Uploads land with a later phase; until then these hold their words and wait. */
export function ImageEditor({ draft, onChange, t }: EditorProps<'image'>) {
  return (
    <div className="grid gap-1">
      <MediaPlaceholder
        icon={ImageIcon}
        label={t.library.editor.fields.mediaSoon}
        caption={
          <InlineText
            value={draft.caption ?? ''}
            onChange={(caption) => onChange({ caption: caption || undefined })}
            placeholder={t.library.editor.fields.caption}
            maxLength={300}
            className="text-xs"
          />
        }
      />
      <InlineText
        value={draft.alt ?? ''}
        onChange={(alt) => onChange({ alt })}
        placeholder={t.library.editor.fields.alt}
        maxLength={300}
        className="text-muted-foreground text-xs"
      />
    </div>
  )
}

export function AudioEditor({ draft, onChange, t }: EditorProps<'audio'>) {
  return (
    <div className="grid gap-1">
      <MediaPlaceholder
        icon={HeadphonesIcon}
        label={t.library.editor.fields.mediaSoon}
        caption={
          <InlineText
            value={draft.caption ?? ''}
            onChange={(caption) => onChange({ caption: caption || undefined })}
            placeholder={t.library.editor.fields.caption}
            maxLength={300}
            className="text-xs"
          />
        }
      />
      <InlineTextarea
        value={draft.transcript ?? ''}
        onChange={(transcript) => onChange({ transcript: transcript || undefined })}
        placeholder={t.library.editor.fields.transcript}
        maxLength={5000}
        className="text-muted-foreground text-sm"
      />
    </div>
  )
}

export function VideoEditor({ draft, onChange, t }: EditorProps<'video'>) {
  const videoId = draft.videoId ?? ''
  const playable = /^[\w-]{11}$/.test(videoId)

  return (
    <div className="grid gap-2">
      <Settings>
        <SettingNumber
          label={t.library.editor.fields.start}
          value={draft.start}
          min={0}
          onChange={(start) => onChange({ start })}
        />
        <SettingNumber
          label={t.library.editor.fields.end}
          value={draft.end}
          min={0}
          onChange={(end) => onChange({ end })}
        />
      </Settings>

      <figure className="space-y-2">
        {playable ? (
          <div className="aspect-video overflow-hidden rounded-lg border">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${videoId}?rel=0`}
              title={draft.caption ?? 'Video'}
              allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture"
              allowFullScreen
              className="size-full"
            />
          </div>
        ) : (
          <div className="bg-muted/40 text-muted-foreground flex aspect-video flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-6 text-sm">
            <VideoIcon className="size-5" />
            <InlineText
              value={videoId}
              // A pasted link is the common case; the id is what is stored.
              onChange={(value) =>
                onChange({ provider: 'youtube', videoId: extractYouTubeId(value) })
              }
              placeholder={t.library.editor.fields.videoId}
              className="max-w-sm text-center"
            />
          </div>
        )}

        <InlineText
          value={draft.caption ?? ''}
          onChange={(caption) => onChange({ caption: caption || undefined })}
          placeholder={t.library.editor.fields.caption}
          maxLength={300}
          className="text-muted-foreground text-xs"
        />
      </figure>

      {playable ? (
        <InlineText
          value={videoId}
          onChange={(value) => onChange({ provider: 'youtube', videoId: extractYouTubeId(value) })}
          label={t.library.editor.fields.videoId}
          className="text-muted-foreground font-mono text-xs"
        />
      ) : null}
    </div>
  )
}

export function DividerEditor() {
  return <hr className="border-border" />
}

export function ReadingEditor({ draft, onChange, t }: EditorProps<'reading'>) {
  return (
    <article className="bg-muted/30 space-y-3 rounded-lg border p-4 sm:p-5">
      <InlineText
        value={draft.title ?? ''}
        onChange={(title) => onChange({ title: title || undefined })}
        placeholder={t.library.editor.fields.title}
        maxLength={200}
        className="text-base font-semibold"
      />
      <InlineTextarea
        value={draft.passage ?? ''}
        onChange={(passage) => onChange({ passage })}
        placeholder={t.library.editor.fields.passage}
        maxLength={20000}
        rows={3}
        className="text-[15px] leading-7"
      />
    </article>
  )
}
