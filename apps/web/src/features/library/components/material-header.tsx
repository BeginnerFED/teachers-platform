'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { LEVELS, type MaterialDetail, type UpdateMaterialBody } from '@tp/shared'
import { Badge } from '@/components/ui/badge'
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

  const save = (patch: UpdateMaterialBody, revert: () => void) =>
    startTransition(async () => {
      const { error } = await updateMaterial(material.id, patch)

      if (error) {
        toast.error(t.library.edit.saveFailed)
        // Put back what is actually stored, so the screen never shows a value the
        // database does not have.
        revert()
      }
    })

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3">
      <div className="flex flex-col gap-1">
        {/* An input that reads exactly like the heading it replaces until the cursor is
            in it. An edit button beside a heading is a second thing to find. */}
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onBlur={() => {
            const next = title.trim()

            // An empty title is not a title. Blurring an emptied field restores the old
            // one rather than saving nothing and leaving a nameless lesson in the library.
            if (!next) return setTitle(material.title)
            if (next === material.title) return

            save({ title: next }, () => setTitle(material.title))
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
            if (event.key === 'Escape') {
              setTitle(material.title)
              event.currentTarget.blur()
            }
          }}
          placeholder={t.library.edit.titlePlaceholder}
          aria-label={t.library.edit.titlePlaceholder}
          maxLength={200}
          // The same size as every other page's heading, in the same place.
          className="hover:bg-muted/50 focus:bg-muted/50 focus:ring-ring/40 -mx-2 rounded-md px-2 py-0.5 text-2xl font-semibold outline-none transition-colors focus:ring-2"
        />

        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          onBlur={() => {
            const next = description.trim()
            if (next === (material.description ?? '')) return

            save({ description: next || null }, () => setDescription(material.description ?? ''))
          }}
          placeholder={t.library.edit.descriptionPlaceholder}
          aria-label={t.library.edit.descriptionPlaceholder}
          maxLength={1000}
          rows={1}
          className="text-muted-foreground hover:bg-muted/50 focus:bg-muted/50 focus:ring-ring/40 field-sizing-content -mx-2 max-w-2xl resize-none rounded-md px-2 py-0.5 text-sm outline-none transition-colors focus:ring-2"
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
            className="hover:bg-muted h-7 w-auto gap-1.5 border-transparent bg-transparent px-2 font-mono text-xs shadow-none"
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
        <h1 className="text-2xl font-semibold">{material.title}</h1>

        {material.description ? (
          <p className="text-muted-foreground max-w-2xl text-sm">{material.description}</p>
        ) : null}
      </div>

      <div className="text-muted-foreground flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
        <Badge variant="outline" className="px-1.5 py-0 font-mono text-[10px] font-normal">
          {material.level}
        </Badge>

        <span>
          {t.library.detail.author}:{' '}
          {material.owner
            ? (material.owner.fullName ?? material.owner.email)
            : t.library.detail.platformAuthor}
        </span>

        <span>
          {t.library.detail.updated} {formatDate(material.updatedAt, locale)}
        </span>

        {material.tags.map((tag) => (
          // A tag is a way back into the library, filtered.
          <Link
            key={tag}
            href={`/library?tag=${encodeURIComponent(tag)}&scope=platform`}
            className="bg-muted hover:text-foreground rounded px-1.5 py-0.5 transition-colors"
          >
            {tag}
          </Link>
        ))}

        {material.sourceMaterialId ? <span>{t.library.detail.copiedFrom}</span> : null}
      </div>
    </div>
  )
}
