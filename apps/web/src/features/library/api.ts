import 'server-only'
import type {
  ListMaterialsQuery,
  MaterialDetail,
  MaterialListItem,
  PageMeta,
  StudentMaterial,
} from '@tp/shared'
import { unwrap, unwrapPage } from '@/lib/api/errors'
import { getApi } from '@/lib/api/server'

/**
 * The only place the web app asks the API about materials. Components take what these
 * return as props and never fetch for themselves, so a page makes one request rather than
 * one per component that happens to want the same rows.
 */
export async function listMaterials(
  query: ListMaterialsQuery,
): Promise<{ data: MaterialListItem[]; meta: PageMeta }> {
  const api = await getApi()

  const response = await api.v1.materials.$get({
    query: {
      page: String(query.page),
      perPage: String(query.perPage),
      scope: query.scope,
      // Sent as the strings the schema expects rather than as booleans: "false" has to
      // reach the API intact, since it is the difference between the library and the bin.
      deleted: query.deleted ? 'true' : 'false',
      ...(query.level ? { level: query.level } : {}),
      ...(query.tag ? { tag: query.tag } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.query ? { query: query.query } : {}),
    },
  })

  return unwrapPage(response)
}

export async function getMaterial(materialId: string): Promise<MaterialDetail> {
  const api = await getApi()

  return unwrap(await api.v1.materials[':materialId'].$get({ param: { materialId } }))
}

/** The lesson as a student sees it: no answer key anywhere in the payload. */
export async function getPlayableMaterial(materialId: string): Promise<StudentMaterial> {
  const api = await getApi()

  return unwrap(await api.v1.materials[':materialId'].play.$get({ param: { materialId } }))
}
