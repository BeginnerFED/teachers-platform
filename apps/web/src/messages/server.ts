import { uk, type Messages } from './index'

/**
 * Returns the strings to render.
 *
 * In production this hands back Ukrainian immediately: no cookie is read, so pages stay
 * statically renderable and no code path can reach the Turkish reading aid.
 * `process.env.NODE_ENV` is substituted at build time, so the whole branch below — the
 * dynamic import included — is dropped from the production bundle.
 */
export async function getMessages(): Promise<Messages> {
  if (process.env.NODE_ENV !== 'development') return uk

  const { readDevMessages } = await import('./dev')
  return readDevMessages()
}
