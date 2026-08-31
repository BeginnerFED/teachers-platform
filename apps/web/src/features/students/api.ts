import 'server-only'
import type { ListStudentsQuery, PageMeta, StudentListItem } from '@tp/shared'
import { unwrapPage } from '@/lib/api/errors'
import { getApi } from '@/lib/api/server'

/**
 * The only place the web app asks the API about students. Components take what this
 * returns as props; none of them fetch for themselves, so a page makes one request rather
 * than one per component that happens to need the same rows.
 */
export async function listStudents(
  query: ListStudentsQuery,
): Promise<{ data: StudentListItem[]; meta: PageMeta }> {
  const api = await getApi()

  const response = await api.v1.admin.students.$get({
    query: {
      page: String(query.page),
      perPage: String(query.perPage),
      ...(query.link ? { link: query.link } : {}),
      ...(query.query ? { query: query.query } : {}),
    },
  })

  return unwrapPage(response)
}
