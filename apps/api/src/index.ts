import { serve } from '@hono/node-server'
import { app } from './app'
import { env } from './env'
import { warmJwks } from './lib/jwt'
import { logger } from './lib/logger'

async function start() {
  // Fetch the signing keys before serving. Paying it here keeps it off the first request,
  // and turns "asymmetric keys are switched off" into a refusal to boot rather than a
  // 500 the first time somebody signs in.
  const keys = await warmJwks()
  logger.info({ keys }, 'Supabase signing keys loaded')

  serve({ fetch: app.fetch, port: env.PORT }, (info) => {
    logger.info({ port: info.port, nodeEnv: env.NODE_ENV }, 'API listening')
  })
}

start().catch((error: unknown) => {
  logger.fatal({ err: error }, 'API failed to start')
  process.exit(1)
})
