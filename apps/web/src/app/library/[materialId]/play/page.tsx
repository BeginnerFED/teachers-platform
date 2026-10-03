import { notFound } from 'next/navigation'
import { getPlayableMaterial } from '@/features/library/api'
import { MaterialPlayer } from '@/features/library/components/material-player'
import { requireTeachingAccess } from '@/features/settings/teaching-access'
import { ApiError } from '@/lib/api/errors'
import { requireRole } from '@/lib/auth'
import { getMessages } from '@/messages/server'

/**
 * The lesson as it is actually taught. What arrives here has already had every answer
 * stripped out of it by the API, so nothing on this page — or in the payload behind it —
 * knows which option is the right one.
 */
export default async function PlayMaterialPage({
  params,
}: PageProps<'/library/[materialId]/play'>) {
  // The layout's guard does not hold the page back, so the page checks as well, before it
  // asks the API for anything a student, or a teacher whose access has lapsed, would be
  // refused.
  await requireRole('admin', 'teacher')
  await requireTeachingAccess()
  const [t, { materialId }] = await Promise.all([getMessages(), params])

  // A missing lesson and an address that is no lesson id at all — the API's 422 — are the
  // same dead end to whoever followed the link.
  const material = await getPlayableMaterial(materialId).catch((error) => {
    if (error instanceof ApiError && (error.status === 404 || error.status === 422)) notFound()

    throw error
  })

  return <MaterialPlayer material={material} backHref={`/library/${materialId}`} t={t} />
}
