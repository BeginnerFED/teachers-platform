import { notFound } from 'next/navigation'
import { getPlayableMaterial } from '@/features/library/api'
import { MaterialPlayer } from '@/features/library/components/material-player'
import { ApiError } from '@/lib/api/errors'
import { getMessages } from '@/messages/server'

/**
 * The lesson as it is actually taught. What arrives here has already had every answer
 * stripped out of it by the API, so nothing on this page — or in the payload behind it —
 * knows which option is the right one.
 */
export default async function PlayMaterialPage({
  params,
}: PageProps<'/library/[materialId]/play'>) {
  const [t, { materialId }] = await Promise.all([getMessages(), params])

  const material = await getPlayableMaterial(materialId).catch((error) => {
    if (error instanceof ApiError && error.status === 404) notFound()

    throw error
  })

  return <MaterialPlayer material={material} backHref={`/library/${materialId}`} t={t} />
}
