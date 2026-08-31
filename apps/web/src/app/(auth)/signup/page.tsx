import { getMessages } from '@/messages/server'
import { SignUpForm } from './signup-form'

export default async function SignUpPage() {
  const t = await getMessages()

  return <SignUpForm t={t} />
}
