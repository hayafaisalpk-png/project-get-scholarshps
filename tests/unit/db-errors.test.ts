import { describe, expect, it } from 'vitest'

import { DatabaseError, dbCall, toDatabaseError } from '@/lib/db/errors'

describe('toDatabaseError', () => {
  it('maps an RLS denial to unauthorized', () => {
    const err = toDatabaseError({
      code: '42501',
      message: 'new row violates row-level security policy',
    })
    expect(err.kind).toBe('unauthorized')
    expect(err.retryable).toBe(false)
  })

  it('maps a unique violation to conflict', () => {
    expect(toDatabaseError({ code: '23505' }).kind).toBe('conflict')
  })

  it('maps check violations to constraint', () => {
    expect(toDatabaseError({ code: '23514' }).kind).toBe('constraint')
  })

  it('maps foreign key violations to constraint', () => {
    expect(toDatabaseError({ code: '23503' }).kind).toBe('constraint')
  })

  it('maps an empty single() result to not_found', () => {
    expect(toDatabaseError({ code: 'PGRST116' }).kind).toBe('not_found')
  })

  it('maps an invalid uuid to invalid_input', () => {
    expect(toDatabaseError({ code: '22P02' }).kind).toBe('invalid_input')
  })

  it('maps query cancellation to timeout and marks it retryable', () => {
    const err = toDatabaseError({ code: '57014' })
    expect(err.kind).toBe('timeout')
    expect(err.retryable).toBe(true)
  })

  it('maps serialization failures to a retryable unavailable error', () => {
    const err = toDatabaseError({ code: '40001' })
    expect(err.kind).toBe('unavailable')
    expect(err.retryable).toBe(true)
  })

  it('treats a missing schema cache entry as unavailable, not not_found', () => {
    // PGRST205 means the table is absent from PostgREST's cache, which is an
    // operational problem, not a missing record.
    expect(toDatabaseError({ code: 'PGRST205' }).kind).toBe('unavailable')
  })

  it('falls back to the HTTP status when the code is unhelpful', () => {
    expect(toDatabaseError({ code: 'WEIRD', message: 'x' }, 403).kind).toBe(
      'unauthorized',
    )
    expect(toDatabaseError({ code: 'WEIRD', message: 'x' }, 404).kind).toBe(
      'not_found',
    )
    expect(toDatabaseError({ code: 'WEIRD', message: 'x' }, 503).kind).toBe(
      'unavailable',
    )
  })

  it('classifies an unrecognised error as unknown and not retryable', () => {
    const err = toDatabaseError({ code: 'ZZZ', message: 'boom' })
    expect(err.kind).toBe('unknown')
    expect(err.retryable).toBe(false)
  })

  it('tolerates a null or empty error', () => {
    expect(toDatabaseError(null).kind).toBe('unknown')
    expect(toDatabaseError(undefined).kind).toBe('unknown')
    expect(toDatabaseError({}).kind).toBe('unknown')
  })
})

describe('DatabaseError.userMessage', () => {
  const cases: [Parameters<typeof toDatabaseError>[0], string][] = [
    [{ code: '42501' }, 'You do not have permission to do that.'],
    [{ code: 'PGRST116' }, 'That item could not be found.'],
    [{ code: '22P02' }, 'Some of the information provided is not valid.'],
    [{ code: '23505' }, 'That value is already in use.'],
    [{ code: '57014' }, 'The request took too long. Please try again.'],
    [{ code: 'ZZZ' }, 'Something went wrong. Please try again.'],
  ]

  for (const [input, expected] of cases) {
    it(`never leaks internals for ${input?.code}`, () => {
      const err = toDatabaseError(input)
      expect(err.userMessage).toBe(expected)
      // The raw message may contain schema details; the user message must not.
      expect(err.userMessage).not.toContain('policy')
      expect(err.userMessage).not.toContain('row-level')
    })
  }

  it('preserves the underlying error as a cause', () => {
    const cause = new Error('underlying')
    const err = new DatabaseError('unknown', 'x', { cause })
    expect(err.cause).toBe(cause)
  })
})

describe('dbCall', () => {
  it('returns data on success', async () => {
    const result = await dbCall(async () => ({ data: [1, 2, 3], error: null }))
    expect(result).toEqual({ ok: true, data: [1, 2, 3] })
  })

  it('maps a returned error without throwing', async () => {
    const result = await dbCall(async () => ({
      data: null,
      error: { code: '42501', message: 'denied' },
    }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.kind).toBe('unauthorized')
  })

  it('converts a thrown error into a retryable unavailable result', async () => {
    const result = await dbCall(async () => {
      throw new Error('fetch failed')
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.kind).toBe('unavailable')
      expect(result.error.retryable).toBe(true)
    }
  })
})
