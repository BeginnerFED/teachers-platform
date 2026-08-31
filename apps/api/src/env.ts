import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  WEB_ORIGIN: z.string().url().default('http://localhost:3000'),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),

  SUPABASE_URL: z.string().url(),
  // Full-access key. Present only on the server; never exposed to the browser.
  SUPABASE_SECRET_KEY: z.string().min(1),
})

export type Env = z.infer<typeof envSchema>

/**
 * Pure, so a test can hand it a fixture instead of mutating the real process. Throws
 * rather than exiting: a misconfigured server should fail loudly at boot, but a test
 * importing this module should not be able to kill the runner.
 */
export function parseEnv(source: Record<string, string | undefined> = process.env): Env {
  const parsed = envSchema.safeParse(source)

  if (!parsed.success) {
    throw new Error(`Invalid environment variables:\n${z.prettifyError(parsed.error)}`)
  }

  return parsed.data
}

export const env = parseEnv()
