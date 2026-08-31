import { getMessages } from '@/messages/server'

export default async function TeacherDashboardPage() {
  const t = await getMessages()

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{t.teacher.title}</h1>
        <p className="text-muted-foreground text-sm">{t.teacher.description}</p>
      </div>

      <div className="bg-muted/50 h-24 w-full max-w-3xl rounded-xl" />
      <div className="bg-muted/50 h-64 w-full max-w-3xl rounded-xl" />
    </>
  )
}
