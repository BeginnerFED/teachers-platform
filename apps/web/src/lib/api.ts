import { hc } from 'hono/client'
import type { AppType } from '@tp/api/app'

/**
 * Typed client for the Hono API. Route paths and response shapes come from the
 * server's own types, so a renamed or removed endpoint breaks the build here.
 */
export const api = hc<AppType>(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001')
