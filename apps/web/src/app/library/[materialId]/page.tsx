import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PlayIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { listRecipients } from '@/features/homework/api'
import { AssignButton } from '@/features/homework/components/assign-button'
import { getMaterial } from '@/features/library/api'
import { MaterialActions } from '@/features/library/components/material-actions'
import { MaterialHeader, MaterialHeaderStatic } from '@/features/library/components/material-header'
import { PreviewButton } from '@/features/library/components/preview-button'
import { LessonEditor } from '@/features/library/editor/lesson-editor'
import { ApiError } from '@/lib/api/errors'
import { requireViewer } from '@/lib/auth'
import { getMessages } from '@/messages/server'

/**
 * The same skeleton as every other page: the heading first, at the top of the content
 * area, with the page's actions on its right — nothing above it, no width of its own.
 * Consistency across pages is the design here; a lesson that opened in a centred column
 * with a back-link row over its title put its heading somewhere no other heading is.
 * The way back is the breadcrumb in the bar above, which is what it is for.
 */
export default async function MaterialPage({ params }: PageProps<'/library/[materialId]'>) {
  const [viewer, t, { materialId }] = await Promise.all([requireViewer(), getMessages(), params])

  // The API answers "you may not see this" and "there is no such thing" the same way, on
  // purpose, and so does this page.
  // The lesson and the people it could be given to, in one round trip each, together.
  const [material, recipients] = await Promise.all([
    getMaterial(materialId).catch((error) => {
      if (error instanceof ApiError && error.status === 404) notFound()

      throw error
    }),
    listRecipients(),
  ])

  return (
    // The same `flex flex-col gap-6` the shell puts between page children, so the heading
    // sits exactly where every other page's does. The wrapper exists for one reason: the
    // "···" menu marks its button `data-pending` while a delete is out, and `:has()` lets
    // the whole page fade on that mark until the redirect to the library lands.
    <div className="flex flex-col gap-6 transition-opacity has-[[data-pending]]:pointer-events-none has-[[data-pending]]:opacity-50">
      <div className="flex flex-wrap items-start justify-between gap-3">
        {material.canEdit ? (
          <MaterialHeader
            material={material}
            isAdmin={viewer.role === 'admin'}
            locale={viewer.locale}
            t={t}
          />
        ) : (
          <MaterialHeaderStatic material={material} locale={viewer.locale} t={t} />
        )}

        <div className="flex shrink-0 items-center gap-2">
          {/* Homework is how a lesson reaches a student. Not offered from the bin. */}
          {material.deletedAt === null ? (
            <AssignButton materialId={material.id} recipients={recipients} t={t} />
          ) : null}

          {/* Outlined, not filled. On the author's page the work is the editing; a preview
              is a look over your shoulder, and a filled button pulled the eye to it. For
              the owner it also waits for the last edit to be saved before it goes. */}
          {material.canEdit ? (
            <PreviewButton materialId={material.id} label={t.library.actions.preview} t={t} />
          ) : (
            <Button asChild variant="outline" size="sm" className="corner-brackets">
              <Link href={`/library/${material.id}/play`}>
                <PlayIcon />
                {t.library.actions.preview}
              </Link>
            </Button>
          )}

          <MaterialActions material={material} t={t} />
        </div>
      </div>

      {/* The owner gets the canvas. Everyone else gets the table of contents. */}
      {material.canEdit ? (
        <LessonEditor material={material} t={t} />
      ) : (
        <section className="rounded-md border">
          <h2 className="border-b p-3 text-sm font-medium">{t.library.detail.steps}</h2>

          {material.steps.length === 0 ? (
            <p className="text-muted-foreground p-8 text-center text-sm">
              {t.library.detail.noSteps}
            </p>
          ) : (
            <ol className="divide-y">
              {material.steps.map((step, index) => (
                <li key={step.id} className="flex items-center gap-3 p-3">
                  <span className="text-muted-foreground w-6 shrink-0 text-sm tabular-nums">
                    {index + 1}
                  </span>

                  <span className="flex-1 text-sm">
                    {step.title ?? (
                      <span className="text-muted-foreground italic">
                        {t.library.detail.untitledStep}
                      </span>
                    )}
                  </span>

                  <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                    {step.blocks.length} {t.library.detail.blocks}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
    </div>
  )
}
