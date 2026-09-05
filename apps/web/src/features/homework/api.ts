import 'server-only'
import type {
  AssignmentDetail,
  AssignmentListItem,
  AssignmentsSummary,
  AssignmentsSummaryQuery,
  ListAssignmentsQuery,
  MaterialOwner,
  PageMeta,
} from '@tp/shared'
import { unwrap, unwrapPage } from '@/lib/api/errors'
import { getApi } from '@/lib/api/server'

/** The filters the list and its counts share, as the strings a query string carries. */
function filters(query: AssignmentsSummaryQuery) {
  return {
    ...(query.studentId ? { studentId: query.studentId } : {}),
    ...(query.materialId ? { materialId: query.materialId } : {}),
    ...(query.teacherId ? { teacherId: query.teacherId } : {}),
    ...(query.query ? { query: query.query } : {}),
  }
}

/**
 * The only place the web app asks the API about homework. The API decides whose homework
 * "mine" means — the teacher who set it, the student who has it, or everyone's for the
 * administrator — from the token, so the same call serves every side.
 */
export async function listAssignments(
  query: ListAssignmentsQuery,
): Promise<{ data: AssignmentListItem[]; meta: PageMeta }> {
  const api = await getApi()

  const response = await api.v1.assignments.$get({
    query: {
      ...filters(query),
      page: String(query.page),
      perPage: String(query.perPage),
      ...(query.status ? { status: query.status } : {}),
      ...(query.overdue ? { overdue: 'true' } : {}),
    },
  })

  return unwrapPage(response)
}

/** How much homework is where, under the same filters the list is showing. */
export async function summariseAssignments(
  query: AssignmentsSummaryQuery,
): Promise<AssignmentsSummary> {
  const api = await getApi()

  return unwrap(await api.v1.assignments.summary.$get({ query: filters(query) }))
}

export async function getAssignment(assignmentId: string): Promise<AssignmentDetail> {
  const api = await getApi()

  return unwrap(await api.v1.assignments[':assignmentId'].$get({ param: { assignmentId } }))
}

/** The students this teacher may set homework for. */
export async function listRecipients(): Promise<MaterialOwner[]> {
  const api = await getApi()

  return unwrap(await api.v1.assignments.recipients.$get())
}
