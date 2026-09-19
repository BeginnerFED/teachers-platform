import { z, type ZodType } from 'zod'
import { env } from '../../env'
import { TooManyRequestsError, UpstreamUnavailableError } from '../../http/errors'

export type StructuredGenerationRequest<T> = {
  system: string
  user: string
  schema: ZodType<T>
  temperature?: number
  maxTokens?: number
  /** Called immediately before control is handed to the remote fetch implementation. */
  onAttempt?: () => void
  /** Called as soon as the provider exposes billable usage, before output validation. */
  onUsage?: (neurons: number) => void
}

export type StructuredGeneration<T> = {
  value: T
  model: string
  /** Exact billable usage returned by Workers AI when the model exposes it. */
  usageNeurons?: number
}

/** The domain service depends on this contract, not on Cloudflare's response shape. */
export interface AiProvider {
  /** A non-secret local configuration check; it never contacts the provider. */
  isConfigured?(): boolean
  /** Reject a missing local configuration before a daily quota call is reserved. */
  assertConfigured?(): void
  generateStructured<T>(request: StructuredGenerationRequest<T>): Promise<StructuredGeneration<T>>
}

type CloudflareAiConfig = {
  accountId?: string
  apiToken?: string
  model?: string
  fetcher?: typeof fetch
  timeoutMs?: number
}

const cloudflareEnvelope = z
  .object({
    success: z.boolean(),
    result: z.unknown().optional(),
  })
  .loose()

const cloudflareUsage = z
  .object({
    neurons: z.number().finite().nonnegative(),
  })
  .loose()

// Cloudflare documents JSON Mode for this finite set. Other chat models still receive
// the same schema in their prompt and go through identical Zod validation below.
const JSON_MODE_MODELS = new Set([
  '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  '@cf/meta/llama-3-8b-instruct',
  '@cf/meta/llama-3.1-8b-instruct',
  '@hf/nousresearch/hermes-2-pro-mistral-7b',
  '@hf/thebloke/deepseek-coder-6.7b-instruct-awq',
  '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b',
])

class MalformedAiOutputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MalformedAiOutputError'
  }
}

function unwrapJsonFence(value: string): string {
  const trimmed = value.trim()
  const match = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed)

  return match?.[1] ?? trimmed
}

function parseStructured<T>(raw: unknown, schema: ZodType<T>): T {
  let candidate = raw

  if (candidate !== null && typeof candidate === 'object') {
    if ('response' in candidate) {
      candidate = (candidate as { response: unknown }).response
    } else if ('choices' in candidate) {
      const first = (candidate as { choices?: unknown[] }).choices?.[0]

      if (first !== null && typeof first === 'object' && first && 'message' in first) {
        const message = (first as { message: unknown }).message

        if (message !== null && typeof message === 'object' && 'content' in message) {
          candidate = (message as { content: unknown }).content
        }
      }
    }
  }

  if (typeof candidate === 'string') {
    try {
      candidate = JSON.parse(unwrapJsonFence(candidate)) as unknown
    } catch {
      // SyntaxError messages can echo a fragment of the generated response. The model
      // can repeat private homework answers, so never attach that cause to server logs.
      throw new MalformedAiOutputError('Workers AI returned malformed JSON')
    }
  }

  const parsed = schema.safeParse(candidate)

  if (!parsed.success) {
    // Zod issues may include model-produced fields. Keep the response private to the
    // provider boundary rather than serializing it into the request error log.
    throw new MalformedAiOutputError('Workers AI returned data outside the requested schema')
  }

  return parsed.data
}

function usageNeurons(raw: unknown): number | undefined {
  if (raw === null || typeof raw !== 'object' || !('usage' in raw)) return undefined

  const parsed = cloudflareUsage.safeParse((raw as { usage: unknown }).usage)
  return parsed.success ? parsed.data.neurons : undefined
}

function modelPath(model: string): string {
  return model.split('/').map(encodeURIComponent).join('/')
}

/** Cloudflare's REST implementation of the provider-independent generation contract. */
export function createCloudflareAiProvider({
  accountId,
  apiToken,
  model,
  fetcher = fetch,
  timeoutMs = 45_000,
}: CloudflareAiConfig): AiProvider {
  const configuration = () => {
    if (!accountId || !apiToken || !model) {
      throw new UpstreamUnavailableError('AI generation is not configured')
    }

    return { accountId, apiToken, model }
  }

  return {
    isConfigured: () => Boolean(accountId && apiToken && model),
    assertConfigured: () => {
      configuration()
    },
    async generateStructured<T>({
      system,
      user,
      schema,
      temperature = 0.25,
      maxTokens = 6_000,
      onAttempt,
      onUsage,
    }: StructuredGenerationRequest<T>): Promise<StructuredGeneration<T>> {
      const { accountId, apiToken, model } = configuration()

      const jsonSchema = z.toJSONSchema(schema, { target: 'draft-7' })
      const schemaInstruction = `Return only JSON matching this schema: ${JSON.stringify(jsonSchema)}`
      const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${modelPath(model)}`
      let response: Response

      // One logical application request makes one billable provider request. If the model
      // returns invalid JSON, the teacher may retry explicitly and that second attempt gets
      // its own durable quota reservation rather than consuming hidden capacity.
      try {
        onAttempt?.()
        response = await fetcher(url, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${apiToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            messages: [
              { role: 'system', content: `${system}\n\n${schemaInstruction}` },
              { role: 'user', content: user },
            ],
            temperature: Math.min(5, Math.max(0, temperature)),
            max_tokens: Math.min(12_000, Math.max(1, Math.trunc(maxTokens))),
            chat_template_kwargs: { enable_thinking: false },
            ...(JSON_MODE_MODELS.has(model)
              ? { response_format: { type: 'json_schema', json_schema: jsonSchema } }
              : {}),
          }),
          signal: AbortSignal.timeout(timeoutMs),
        })
      } catch (cause) {
        throw new UpstreamUnavailableError('AI provider is not reachable', { cause })
      }

      if (response.status === 429) {
        throw new TooManyRequestsError('AI capacity is temporarily exhausted', {
          scope: 'provider',
          reason: 'provider_rate_limit',
        })
      }

      if (!response.ok) {
        throw new UpstreamUnavailableError(`AI provider request failed (${response.status})`)
      }

      let payload: unknown

      try {
        payload = (await response.json()) as unknown
      } catch {
        // A JSON parse error can include a fragment of the provider's raw body.
        throw new UpstreamUnavailableError('AI provider returned an unreadable response')
      }

      const envelope = cloudflareEnvelope.safeParse(payload)

      if (!envelope.success || !envelope.data.success || envelope.data.result === undefined) {
        throw new UpstreamUnavailableError('AI provider rejected the generation request')
      }

      const neurons = usageNeurons(envelope.data.result)

      // Workers AI may bill a response whose generated content is malformed. Observe
      // usage before parsing so quota reconciliation remains exact on that error path.
      if (neurons !== undefined) onUsage?.(neurons)

      try {
        return {
          value: parseStructured(envelope.data.result, schema),
          model,
          ...(neurons !== undefined ? { usageNeurons: neurons } : {}),
        }
      } catch (cause) {
        throw new UpstreamUnavailableError('AI provider could not produce a valid response', {
          cause,
        })
      }
    },
  }
}

export const cloudflareAi = createCloudflareAiProvider({
  accountId: env.CLOUDFLARE_ACCOUNT_ID,
  apiToken: env.CLOUDFLARE_AI_API_TOKEN,
  model: env.CLOUDFLARE_AI_MODEL,
})
