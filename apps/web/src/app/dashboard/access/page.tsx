import { redirect } from 'next/navigation'
import { getTeachingAccess } from '@/features/settings/teaching-access'
import { getMessages } from '@/messages/server'

export default async function AccessPage() {
  if (await getTeachingAccess()) redirect('/dashboard')
  const t = await getMessages()
  return <h1 className="sr-only">{t.teachingAccess.title}</h1>
}
