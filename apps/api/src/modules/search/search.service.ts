import {
  listMaterialsQuery,
  listStudentsQuery,
  listTeachersQuery,
  normalizeSearch,
  SEARCH_LIMIT,
  type SearchQuery,
  type SearchResults,
} from '@tp/shared'
import { materialsService, type Viewer } from '../materials/materials.service'
import { messagingService } from '../messaging/messaging.service'
import { studentsService } from '../students/students.service'
import { teachersService } from '../teachers/teachers.service'

type SearchDeps = {
  materials: Pick<typeof materialsService, 'list'>
  teachers: Pick<typeof teachersService, 'list'>
  students: Pick<typeof studentsService, 'list'>
  messaging: Pick<typeof messagingService, 'recipientsFor'>
}

export function createSearchService({ materials, teachers, students, messaging }: SearchDeps) {
  return {
    async find({ query }: SearchQuery, viewer: Viewer): Promise<SearchResults> {
      const params = { query, perPage: SEARCH_LIMIT }
      // Reuse the library's ownership/publication rules. Students have no library access.
      const materialResults =
        viewer.role === 'student'
          ? Promise.resolve([])
          : materials
              .list(listMaterialsQuery.parse(params), viewer)
              .then(({ items }) =>
                items.map(({ id, title, level, description }) => ({
                  id,
                  title,
                  level,
                  description,
                })),
              )

      async function people(): Promise<SearchResults['people']> {
        if (viewer.role === 'admin') {
          const [teacherPage, studentPage] = await Promise.all([
            teachers.list(listTeachersQuery.parse(params)),
            students.list(listStudentsQuery.parse(params)),
          ])
          return [
            ...teacherPage.items.map(({ id, fullName, email }) => ({
              id,
              fullName,
              email,
              role: 'teacher' as const,
            })),
            ...studentPage.items.map(({ id, fullName, email }) => ({
              id,
              fullName,
              email,
              role: 'student' as const,
            })),
          ]
        }

        // Never query the admin directory for teachers or students. Only active linked
        // contacts and admins, as authorized by the existing messaging service.
        const needle = normalizeSearch(query)
        return (await messaging.recipientsFor(viewer.id))
          .filter((person) =>
            normalizeSearch(`${person.fullName ?? ''} ${person.email}`).includes(needle),
          )
          .sort((a, b) => (a.fullName ?? a.email).localeCompare(b.fullName ?? b.email))
          .slice(0, SEARCH_LIMIT)
          .map(({ id, fullName, email, role }) => ({ id, fullName, email, role }))
      }

      const [foundMaterials, foundPeople] = await Promise.all([materialResults, people()])
      return { materials: foundMaterials, people: foundPeople }
    },
  }
}

export const searchService = createSearchService({
  materials: materialsService,
  teachers: teachersService,
  students: studentsService,
  messaging: messagingService,
})
