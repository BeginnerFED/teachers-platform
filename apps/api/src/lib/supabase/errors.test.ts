import { AuthApiError, PostgrestError } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { ValidationError } from '../../http/errors'
import { throwFromAuth, throwFromPostgrest } from './errors'

function caught(run: () => never): unknown {
  try {
    run()
  } catch (error) {
    return error
  }
}

describe('auth failures', () => {
  // What GoTrue answers for a well-formed address it still refuses to take.
  it('answers a refused address as a request to correct, and keeps what the server said', () => {
    const refusal = new AuthApiError(
      'Email address "x@example.test" is invalid',
      400,
      'email_address_invalid',
    )

    const failure = caught(() => throwFromAuth(refusal, 'create account'))

    expect(failure).toBeInstanceOf(ValidationError)
    expect(failure).toMatchObject({
      code: 'validation_failed',
      status: 422,
      message: 'create account: the email address was not accepted',
      cause: refusal,
    })
  })

  // GoTrue's catch-all, here for an address the shared schema let through (a domain label
  // over 63 characters) and for a password, which no person typed.
  it.each([
    ['create account', 'Unable to validate email address: invalid format'],
    ['reset password', 'Password cannot be longer than 72 characters'],
  ])('does not blame the email address for every refused value (%s)', (operation, said) => {
    const refusal = new AuthApiError(said, 400, 'validation_failed')

    const failure = caught(() => throwFromAuth(refusal, operation))

    expect(failure).toBeInstanceOf(ValidationError)
    expect(failure).toMatchObject({
      code: 'validation_failed',
      status: 422,
      message: `${operation}: a value was not accepted`,
      cause: refusal,
    })
  })

  it('still answers a registered address as a conflict', () => {
    const failure = caught(() =>
      throwFromAuth(new AuthApiError('Already registered', 422, 'email_exists'), 'create account'),
    )

    expect(failure).toMatchObject({ code: 'conflict', status: 409 })
  })

  it('keeps anything unrecognised as ours', () => {
    const failure = caught(() =>
      throwFromAuth(
        new AuthApiError('Database error', 500, 'unexpected_failure'),
        'create account',
      ),
    )

    expect(failure).toMatchObject({ code: 'internal', status: 500 })
  })
})

describe('database failures', () => {
  it('keeps the Postgres error of a refused value for the log', () => {
    const refusal = new PostgrestError({
      code: '22001',
      message: 'value too long for type character varying(200)',
      details: '',
      hint: '',
    })

    const failure = caught(() => throwFromPostgrest(refusal, 'save lesson'))

    expect(failure).toMatchObject({ code: 'validation_failed', status: 422, cause: refusal })
  })

  it('refuses text Postgres cannot store as the caller’s input, not as our failure', () => {
    // A NUL character pasted into an answer: a retry would fail the same way for ever.
    const refusal = new PostgrestError({
      code: '22P05',
      message: 'unsupported Unicode escape sequence',
      details: '\\u0000 cannot be converted to text.',
      hint: '',
    })

    const failure = caught(() => throwFromPostgrest(refusal, 'save open assignment'))

    expect(failure).toMatchObject({ code: 'validation_failed', status: 422, cause: refusal })
  })
})
