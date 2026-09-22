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

/**
 * A complete option list for the administrator's cross-teacher filters.
 *
 * The public list endpoint deliberately caps one page at 100 records. Reading every page
 * here avoids making teachers past that first page impossible to select while keeping the
 * ordinary directory itself paginated.
 */
export async function listAllTeachers(): Promise<TeacherListItem[]> {
  const first = await listTeachers({ page: 1, perPage: 100 })
  const pages = Math.ceil(first.meta.total / first.meta.perPage)

  if (pages <= 1) return first.data

  const all = [...first.data]

  // Four requests at a time keeps a large directory from creating an unbounded burst
  // against the API, while avoiding one long serial chain for an ordinary installation.
  for (let from = 2; from <= pages; from += 4) {
    const batch = await Promise.all(
      Array.from({ length: Math.min(4, pages - from + 1) }, (_, index) =>
        listTeachers({ page: from + index, perPage: first.meta.perPage }).then(({ data }) => data),
      ),
    )

    all.push(...batch.flat())
  }

  return all
}
