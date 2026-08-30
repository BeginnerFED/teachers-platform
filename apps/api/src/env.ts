import { z } from 'zod'

/**
 * Environment is validated once at boot. A missing or malformed variable should
 * crash the process here, not surface as a confusing error deep in a request.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  WEB_ORIGIN: z.string().url().default('http://localhost:3000'),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('Invalid environment variables:')
  console.error(z.prettifyError(parsed.error))
  process.exit(1)
}

export const env = parsed.data
