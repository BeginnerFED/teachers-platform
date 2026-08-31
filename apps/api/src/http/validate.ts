import { zValidator } from '@hono/zod-validator'
import type { ValidationTargets } from 'hono'
import { z, type ZodType } from 'zod'
import { ValidationError } from './errors'

/**
 * zValidator, wrapped once so a failure becomes the same error envelope as everything
 * else instead of Hono's default plain-text response. The thrown error carries the
 * per-field tree, which is what a form needs to highlight the right input.
 */
export function validate<T extends ZodType, Target extends keyof ValidationTargets>(
  target: Target,
  schema: T,
) {
  return zValidator(target, schema, (result) => {
    if (!result.success) {
      throw new ValidationError('Invalid request', z.treeifyError(result.error))
    }
  })
}
