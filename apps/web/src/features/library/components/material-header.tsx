'use client'

import Link from 'next/link'
import { useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { LEVELS, type MaterialDetail, type UpdateMaterialBody } from '@tp/shared'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { formatDate } from '@/lib/format'
import type { Messages } from '@/messages'
import { updateMaterial } from '../actions'
import { LevelChip } from './level-chip'
import { flushPendingSaves } from '../editor/editor-flush'

/** The header's fields as the server has them. */
const savedFields = (material: MaterialDetail) => ({
  title: material.title,
  description: material.description ?? '',
  level: material.level,
  published: material.visibility === 'platform' && material.status === 'published',
})

/**
 * The top of a lesson, the way a document has a top: a title, a line under it, and one
 * quiet row of properties. Edited where it is shown — there is no form and no save button,
 * each field goes when you leave it.
 *
 * Three rows, not five. Title and description are one block; level, publication and the
 * last-saved date share a line. What used to sit on its own line — "written by: you",
 * "0 steps · 0 blocks" — is either something the author already knows or something the
 * editor below is about to show properly.
 */
export function MaterialHeader({
  material,
  isAdmin,
  locale,
  t,
}: {
  material: MaterialDetail
  /** Only an administrator can move a lesson into the platform's own library. */
  isAdmin: boolean
  locale: string
  t: Messages
}) {
  const [title, setTitle] = useState(material.title)
  const [description, setDescription] = useState(material.description ?? '')
  const [level, setLevel] = useState(material.level)
  const [published, setPublished] = useState(
    material.visibility === 'platform' && material.status === 'published',
  )
  const [, startTransition] = useTransition()
  // The text field the cursor is in, and what it held when the cursor arrived.
  const [editing, setEditing] = useState<'title' | 'description' | null>(null)
  const atFocus = useRef('')
  const escaped = useRef(false)

  // The page renders again around this header — after a save here, after an AI draft is
  // applied below, after a rename in another tab is picked up by a refresh — and hands it
  // newer saved values. Each field follows them, except the one being typed in: that one
  // catches up when the cursor leaves it, unless the author has saved over it by then.
  const saved = savedFields(material)
  const [adopted, setAdopted] = useState(saved)
  const takeTitle = saved.title !== adopted.title && editing !== 'title'
  const takeDescription = saved.description !== adopted.description && editing !== 'description'
  const takeLevel = saved.level !== adopted.level
  const takePublished = saved.published !== adopted.published

  if (takeTitle || takeDescription || takeLevel || takePublished) {
    setAdopted({
      title: takeTitle ? saved.title : adopted.title,
      description: takeDescription ? saved.description : adopted.description,
      level: saved.level,
      published: saved.published,
    })
    if (takeTitle) setTitle(saved.title)
    if (takeDescription) setDescription(saved.description)
    if (takeLevel) setLevel(saved.level)
    if (takePublished) setPublished(saved.published)
  }

  const save = (patch: UpdateMaterialBody, revert: () => void) =>
    startTransition(async () => {
      if (patch.status === 'published') {
        try {
          await flushPendingSaves()
        } catch {
          toast.error(t.editorRecovery.blocked)
          revert()
          return
        }
      }
      const { error } = await updateMaterial(material.id, patch)

      if (error) {
        toast.error(
          error === 'live_locked' ? t.library.toast.liveLocked : t.library.edit.saveFailed,
        )
        // Put back what is actually stored, so the screen never shows a value the
        // database does not have.
        revert()
      }
    })

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3">
      <div className="flex flex-col gap-1">
        {/* An input that reads exactly like the heading it replaces until the cursor is
            in it. An edit button beside a heading is a second thing to find. It is still
            the page's heading, so it sits in one: a screen reader moving by headings
            lands on the lesson's name here as it does on every other page. */}
        <h1 className="flex flex-col">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onFocus={() => {
              setEditing('title')
              atFocus.current = title.trim()
            }}
            onBlur={() => {
              setEditing(null)
              const next = title.trim()

              // Escape, or a field emptied: an empty title is not a title, so blurring one
              // puts the name back rather than leaving a nameless lesson in the library.
              if (escaped.current || !next) {
                escaped.current = false
                return setTitle(material.title)
              }
              // Saved only when it was changed here. Going in and out of the field is not
              // an edit, and must not write this copy over a newer one the page brought.
              if (next === atFocus.current) return

              setAdopted((current) => ({ ...current, title: material.title }))
              save({ title: next }, () => setTitle(material.title))
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur()
              if (event.key === 'Escape') {
                escaped.current = true
                event.currentTarget.blur()
              }
            }}
            placeholder={t.library.edit.titlePlaceholder}
            aria-label={t.library.edit.titlePlaceholder}
            maxLength={200}
            // The same size as every other page's heading, in the same place.
            className="hover:bg-muted/50 focus:bg-muted/50 focus:ring-ring/40 -mx-2 rounded-lg px-2 py-0.5 text-2xl font-semibold tracking-tight outline-none transition-colors focus:ring-2"
          />
        </h1>

        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          onFocus={() => {
            setEditing('description')
            atFocus.current = description.trim()
          }}
          onBlur={() => {
            setEditing(null)
            const next = description.trim()
            if (next === atFocus.current) return

            setAdopted((current) => ({ ...current, description: material.description ?? '' }))
            save({ description: next || null }, () => setDescription(material.description ?? ''))
          }}
          placeholder={t.library.edit.descriptionPlaceholder}
          aria-label={t.library.edit.descriptionPlaceholder}
          maxLength={1000}
          rows={1}
          className="text-muted-foreground hover:bg-muted/50 focus:bg-muted/50 focus:ring-ring/40 field-sizing-content -mx-2 max-w-2xl resize-none rounded-lg px-2 py-0.5 text-sm outline-none transition-colors focus:ring-2"
        />
      </div>

      {/* Properties, the way a document has properties: one line, nothing boxed. */}
      <div className="text-muted-foreground flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <Select
          value={level}
          onValueChange={(next) => {
            const previous = level
            setLevel(next as typeof level)
            save({ level: next as typeof level }, () => setLevel(previous))
          }}
        >
          <SelectTrigger
            aria-label={t.library.edit.level}
            className="bg-muted text-foreground/80 hover:bg-muted/70 h-6 w-auto gap-1 rounded-full border-transparent px-2.5 font-mono text-[11px] font-medium shadow-none"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LEVELS.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {isAdmin ? (
          <label className="flex cursor-pointer items-center gap-2">
            <Switch
              checked={published}
              onCheckedChange={(next) => {
                setPublished(next)
                // One switch, two columns. "In the platform library" is the only state a
                // person thinks in; visibility and status are how the database spells it.
                save(
                  next
                    ? { visibility: 'platform', status: 'published' }
                    : { visibility: 'private', status: 'draft' },
                  () => setPublished(!next),
                )
              }}
            />
            <span className="text-foreground text-sm">{t.library.edit.published}</span>
          </label>
        ) : null}

        {/* No duration here: the editor below shows it live, under the steps, and a second
            copy that only updates on reload would disagree with it while you type. */}
        <span className="text-xs">
          {t.library.detail.updated} {formatDate(material.updatedAt, locale)}
        </span>
      </div>
    </div>
  )
}

/** The same top of the page for somebody who cannot change it. */
export function MaterialHeaderStatic({
  material,
  locale,
  t,
}: {
  material: MaterialDetail
  locale: string
  t: Messages
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{material.title}</h1>

        {material.description ? (
          <p className="text-muted-foreground max-w-2xl text-sm">{material.description}</p>
        ) : null}
      </div>

      <div className="text-muted-foreground flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
        <LevelChip level={material.level} />

        <span>
          {t.library.detail.author}:{' '}
          {material.owner
            ? (material.owner.fullName ?? material.owner.email)
            : t.library.detail.platformAuthor}
        </span>

        {material.durationMinutes ? (
          <span className="tabular-nums">
            ≈ {material.durationMinutes} {t.library.card.minutes}
          </span>
        ) : null}

        <span>
          {t.library.detail.updated} {formatDate(material.updatedAt, locale)}
        </span>

        {material.tags.map((tag) => (
          // A tag is a way back into the library, filtered.
          <Link
            key={tag}
            href={`/library?tag=${encodeURIComponent(tag)}&scope=platform`}
            className="bg-muted hover:text-foreground rounded-full px-2 py-0.5 transition-colors"
          >
            {tag}
          </Link>
        ))}

        {material.sourceMaterialId ? <span>{t.library.detail.copiedFrom}</span> : null}
      </div>
    </div>
  )
}
