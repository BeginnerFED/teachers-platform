import 'server-only'
import type { ListTeachersQuery, PageMeta, TeacherListItem } from '@tp/shared'
import { unwrapPage } from '@/lib/api/errors'
import { getApi } from '@/lib/api/server'

/**
 * The only place the web app asks the API about teachers. Components take what this
 * returns as props; none of them fetch for themselves, so a page makes one request
 * rather than one per component that happens to need the same rows.
 */
export async function listTeachers(
  query: ListTeachersQuery,
): Promise<{ data: TeacherListItem[]; meta: PageMeta }> {
  const api = await getApi()

  const response = await api.v1.admin.teachers.$get({
    query: {
      page: String(query.page),
      perPage: String(query.perPage),
      ...(query.status ? { status: query.status } : {}),
      ...(query.access ? { access: query.access } : {}),
      ...(query.query ? { query: query.query } : {}),
    },
  })

  return unwrapPage(response)
}
