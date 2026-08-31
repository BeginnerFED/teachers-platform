import { getMessages } from '@/messages/server'
import { LoginForm } from './login-form'

export default async function LoginPage() {
  const t = await getMessages()

  return <LoginForm t={t} />
}
