import { createFactory } from 'hono/factory'
import type { AppEnv } from './context'

/**
 * Handlers are built through this rather than written inline in the route file.
 *
 * `createHandlers` returns a tuple that preserves the middleware chain and, critically,
 * the inferred response type — which is what `hc<AppType>` on the web side reads. Moving
 * a handler into another file any other way widens its return type to `Response`, and
 * the RPC types degrade to `any` with no error anywhere to tell you.
 */
export const factory = createFactory<AppEnv>()
