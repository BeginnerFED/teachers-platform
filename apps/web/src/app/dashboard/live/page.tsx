import { listMaterialsQuery } from '@tp/shared'
import { listMaterials } from '@/features/library/api'
import { listRecipients } from '@/features/homework/api'
import { myLiveSession } from '@/features/live/api'
import { LiveLaunchProvider } from '@/features/live/components/live-launcher'
import { LiveDesk } from '@/features/live/components/live-desk'
import { requireRole } from '@/lib/auth'
import { getMessages } from '@/messages/server'
import { requireTeachingAccess } from '@/features/settings/teaching-access'

export default async function TeacherLivePage({ searchParams }: PageProps<'/dashboard/live'>) {
  await requireTeachingAccess()
  const [viewer, t, raw] = await Promise.all([requireRole('teacher'), getMessages(), searchParams])
  const [active, students, materials] = await Promise.allSettled([
    myLiveSession(),
    listRecipients(),
    listMaterials(listMaterialsQuery.parse({ perPage: 8 })),
  ])
  return (
    <LiveLaunchProvider
      session={active.status === 'fulfilled' ? active.value : null}
      failed={active.status === 'rejected'}
      t={t}
    >
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t.live.title}</h1>
        <p className="text-muted-foreground mt-1.5 text-sm">{t.liveDesk.description}</p>
      </div>
      <LiveDesk
        key={typeof raw.student === 'string' ? raw.student : 'new'}
        students={students.status === 'fulfilled' ? students.value : null}
        materials={materials.status === 'fulfilled' ? materials.value : null}
        selectedStudent={typeof raw.student === 'string' ? raw.student : undefined}
        locale={viewer.locale}
        t={t}
      />
    </LiveLaunchProvider>
  )
}
