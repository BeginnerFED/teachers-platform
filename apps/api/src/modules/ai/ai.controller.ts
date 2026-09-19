import { generateLessonDraftBody } from '@tp/shared'
import { getAuth } from '../../http/context'
import { factory } from '../../http/factory'
import { validate } from '../../http/validate'
import { requireAuth } from '../../middleware/auth'
import { rateLimit } from '../../middleware/rate-limit'
import { requireRole } from '../../middleware/require-role'
import { cloudflareAi } from './ai.provider'
import { aiQuotaService } from './ai-quota.service'
import { aiService } from './ai.service'

const lessonDraftLimit = rateLimit({
  perSecond: 1 / 15,
  burst: 2,
  identify: (c) => getAuth(c).userId,
})

export const getAiUsage = factory.createHandlers(
  requireAuth,
  requireRole('admin', 'teacher'),
  async (c) => {
    // Do not show apparently usable allowances for a feature that cannot make a request.
    cloudflareAi.assertConfigured?.()
    const data = await aiQuotaService.getStatus(getAuth(c).userId)
    c.header('Cache-Control', 'private, no-store')

    return c.json({ data })
  },
)

export const generateLessonDraft = factory.createHandlers(
  requireAuth,
  lessonDraftLimit,
  requireRole('admin', 'teacher'),
  validate('json', generateLessonDraftBody),
  async (c) => {
    const data = await aiService.generateLessonDraft(c.req.valid('json'), getAuth(c).userId)
    c.header('Cache-Control', 'private, no-store')

    return c.json({ data })
  },
)
