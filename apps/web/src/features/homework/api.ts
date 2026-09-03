import 'server-only'
import type {
  AssignmentDetail,
  AssignmentListItem,
  ListAssignmentsQuery,
  MaterialOwner,
  PageMeta,
} from '@tp/shared'
import { unwrap, unwrapPage } from '@/lib/api/errors'
import { getApi } from '@/lib/api/server'

/**
 * The only place the web app asks the API about homework. The API decides whose homework
 * "mine" means — the teacher who set it or the student who has it — from the token, so the
 * same call serves both sides.
 */
export async function listAssignments(
  query: ListAssignmentsQuery,
): Promise<{ data: AssignmentListItem[]; meta: PageMeta }> {
  const api = await getApi()

  const response = await api.v1.assignments.$get({
    query: {
      page: String(query.page),
      perPage: String(query.perPage),
      ...(query.status ? { status: query.status } : {}),
      ...(query.studentId ? { studentId: query.studentId } : {}),
      ...(query.materialId ? { materialId: query.materialId } : {}),
    },
  })

  return unwrapPage(response)
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
