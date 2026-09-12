import {
  listMaterialsQuery,
  listStudentsQuery,
  listTeachersQuery,
  type AdminDashboard,
} from '@tp/shared'
import { materialsService, type Viewer } from '../materials/materials.service'
import { studentsService } from '../students/students.service'
import { teachersService } from '../teachers/teachers.service'

const PREVIEW_SIZE = 5

export const dashboardService = {
  async overview(viewer: Viewer): Promise<AdminDashboard> {
    const now = new Date()
    const [teachers, available, expiring, expired, students, unlinked, materials] =
      await Promise.all([
        teachersService.list(listTeachersQuery.parse({ perPage: PREVIEW_SIZE }), now),
        teachersService.list(listTeachersQuery.parse({ perPage: 1, access: 'available' }), now),
        teachersService.list(
          listTeachersQuery.parse({ perPage: PREVIEW_SIZE, access: 'expiring' }),
          now,
        ),
        teachersService.list(
          listTeachersQuery.parse({ perPage: PREVIEW_SIZE, access: 'expired' }),
          now,
        ),
        studentsService.list(listStudentsQuery.parse({ perPage: 1 })),
        studentsService.list(listStudentsQuery.parse({ perPage: PREVIEW_SIZE, link: 'unlinked' })),
        materialsService.list(
          listMaterialsQuery.parse({ perPage: 1, scope: 'platform', status: 'published' }),
          viewer,
        ),
      ])

    return {
      asOf: now.toISOString(),
      // Exact database counts. The preview's limit never becomes a platform total.
      counts: {
        teachers: teachers.meta.total,
        students: students.meta.total,
        availableTeachers: available.meta.total,
        publishedMaterials: materials.meta.total,
      },
      expiring: { total: expiring.meta.total, items: expiring.items },
      expired: { total: expired.meta.total, items: expired.items },
      unlinked: { total: unlinked.meta.total, items: unlinked.items },
      recentTeachers: teachers.items,
    }
  },
}
