import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { createCloudflareAiProvider, ProviderRequestFailedError } from './ai.provider'

const outputSchema = z.object({ answer: z.string() })

function ok(result: unknown) {
  return new Response(JSON.stringify({ success: true, result }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

describe('Cloudflare AI provider', () => {
  it('uses Gemma without unsupported JSON mode and validates fenced JSON', async () => {
    const onUsage = vi.fn()
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        ok({ response: '```json\n{"answer":"ok"}\n```', usage: { neurons: 12.25 } }),
      )
    const provider = createCloudflareAiProvider({
      accountId: 'account',
      apiToken: 'secret',
      model: '@cf/google/gemma-4-26b-a4b-it',
      fetcher,
    })

    await expect(
      provider.generateStructured({
        system: 'System',
        user: 'User',
        schema: outputSchema,
        onUsage,
      }),
    ).resolves.toEqual({
      value: { answer: 'ok' },
      model: '@cf/google/gemma-4-26b-a4b-it',
      usageNeurons: 12.25,
    })
    expect(onUsage).toHaveBeenCalledOnce()
    expect(onUsage).toHaveBeenCalledWith(12.25)

    const body = JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body)) as Record<string, unknown>

    expect(body.response_format).toBeUndefined()
    expect(body.chat_template_kwargs).toEqual({ enable_thinking: false })
    expect(JSON.stringify(body.messages)).toContain('Return only JSON matching this schema')
  })

  it('does not hide a second billable request behind malformed output', async () => {
    const onUsage = vi.fn()
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(ok({ response: 'not json', usage: { neurons: 8.75 } }))
    const provider = createCloudflareAiProvider({
      accountId: 'account',
      apiToken: 'secret',
      model: '@cf/google/gemma-4-26b-a4b-it',
      fetcher,
    })

    await expect(
      provider.generateStructured({
        system: 'System',
        user: 'User',
        schema: outputSchema,
        onUsage,
      }),
    ).rejects.toMatchObject({ code: 'upstream_unavailable' })
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(onUsage).toHaveBeenCalledOnce()
    expect(onUsage).toHaveBeenCalledWith(8.75)
  })

  it.each([400, 500, 503])(
    'reports an error status (%i) as a refused request with no usage',
    async (status) => {
      const onAttempt = vi.fn()
      const onUsage = vi.fn()
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          new Response(JSON.stringify({ success: false, errors: [{ code: 3040 }] }), { status }),
        )
      const provider = createCloudflareAiProvider({
        accountId: 'account',
        apiToken: 'secret',
        model: '@cf/google/gemma-4-26b-a4b-it',
        fetcher,
      })

      const failure = await provider
        .generateStructured({
          system: 'System',
          user: 'User',
          schema: outputSchema,
          onAttempt,
          onUsage,
        })
        .catch((error: unknown) => error)

      expect(failure).toBeInstanceOf(ProviderRequestFailedError)
      expect(failure).toMatchObject({ code: 'upstream_unavailable', providerStatus: status })
      expect(onAttempt).toHaveBeenCalledOnce()
      expect(onUsage).not.toHaveBeenCalled()
    },
  )

  // The request may have run before the connection gave out, so this is not a refusal.
  it('does not report a request that never got an answer as refused', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new DOMException('The operation was aborted', 'TimeoutError'))
    const provider = createCloudflareAiProvider({
      accountId: 'account',
      apiToken: 'secret',
      model: '@cf/google/gemma-4-26b-a4b-it',
      fetcher,
    })

    const failure = await provider
      .generateStructured({ system: 'System', user: 'User', schema: outputSchema })
      .catch((error: unknown) => error)

    expect(failure).toMatchObject({ code: 'upstream_unavailable' })
    expect(failure).not.toBeInstanceOf(ProviderRequestFailedError)
  })

  it('rejects missing configuration before sending a request', async () => {
    const fetcher = vi.fn<typeof fetch>()
    const provider = createCloudflareAiProvider({
      accountId: 'account',
      model: '@cf/google/gemma-4-26b-a4b-it',
      fetcher,
    })

    expect(() => provider.assertConfigured?.()).toThrow('AI generation is not configured')
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('does not attach student text from invalid model output to a loggable error', async () => {
    const privateAnswer = 'PRIVATE_STUDENT_ANSWER_9e2b'
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(ok({ response: `{"answer": ${privateAnswer}}`, usage: { neurons: 3 } }))
    const provider = createCloudflareAiProvider({
      accountId: 'account',
      apiToken: 'secret',
      model: '@cf/google/gemma-4-26b-a4b-it',
      fetcher,
    })

    const failure = await provider
      .generateStructured({ system: 'System', user: 'User', schema: outputSchema })
      .catch((error: unknown) => error)

    expect(failure).toMatchObject({ code: 'upstream_unavailable' })
    expect(String(failure)).not.toContain(privateAnswer)
    expect(String((failure as Error & { cause?: unknown }).cause)).not.toContain(privateAnswer)
  })

  it('does not attach an unreadable provider body to a loggable error', async () => {
    const privateAnswer = 'PRIVATE_STUDENT_ANSWER_473c'
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(`{"result": ${privateAnswer}`, { status: 200 }))
    const provider = createCloudflareAiProvider({
      accountId: 'account',
      apiToken: 'secret',
      model: '@cf/google/gemma-4-26b-a4b-it',
      fetcher,
    })

    const failure = await provider
      .generateStructured({ system: 'System', user: 'User', schema: outputSchema })
      .catch((error: unknown) => error)

    expect(failure).toMatchObject({ code: 'upstream_unavailable' })
    expect(String((failure as Error & { cause?: unknown }).cause)).not.toContain(privateAnswer)
  })
})
