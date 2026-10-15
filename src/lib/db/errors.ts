/**
 * Database error handling.
 *
 * Goal: turn a low-level PostgREST / Postgres error into something the
 * application can act on, WITHOUT leaking schema details, SQL text, column
 * names or stack traces to the browser.
 *
 * This module is pure and framework-free so it can be unit tested directly.
 */

/** Categories the application acts on. */
export type DbErrorKind =
  | 'unauthorized' // RLS denied the operation
  | 'not_found'
  | 'invalid_input' // bad UUID, malformed filter, type mismatch
  | 'conflict' // unique constraint
  | 'constraint' // CHECK / FK violation
  | 'timeout'
  | 'unavailable'
  | 'unknown'

export class DatabaseError extends Error {
  readonly kind: DbErrorKind
  /** Postgres code, for server-side logging. Never sent to the client. */
  readonly code: string | undefined
  /** True when retrying the same request could plausibly succeed. */
  readonly retryable: boolean

  constructor(
    kind: DbErrorKind,
    message: string,
    options: { code?: string; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause })
    this.name = 'DatabaseError'
    this.kind = kind
    this.code = options.code
    this.retryable = kind === 'timeout' || kind === 'unavailable'
  }

  /**
   * Message that is safe to render to an end user. Never includes SQL, column
   * names or constraint internals.
   */
  get userMessage(): string {
    switch (this.kind) {
      case 'unauthorized':
        return 'You do not have permission to do that.'
      case 'not_found':
        return 'That item could not be found.'
      case 'invalid_input':
        return 'Some of the information provided is not valid.'
      case 'conflict':
        return 'That value is already in use.'
      case 'constraint':
        return 'That change would not be allowed by the data rules.'
      case 'timeout':
        return 'The request took too long. Please try again.'
      case 'unavailable':
        return 'The service is temporarily unavailable. Please try again shortly.'
      case 'unknown':
      default:
        return 'Something went wrong. Please try again.'
    }
  }
}

/**
 * Map a Supabase/PostgREST error into a DatabaseError.
 *
 * `error` is the object returned in a PostgREST response body. Supabase also
 * includes HTTP status codes as strings such as 'PGRST116'.
 */
export function toDatabaseError(
  error: { code?: string | null; message?: string | null; details?: string | null } | null | undefined,
  httpStatus?: number,
): DatabaseError {
  if (!error) return new DatabaseError('unknown', 'Unknown database error.')

  const code = error.code ?? undefined
  const message = error.message ?? 'Unknown database error.'

  // --- Postgres SQLSTATE codes -------------------------------------------
  switch (code) {
    case '42501':
      // Row Level Security denied the statement.
      return new DatabaseError('unauthorized', message, { code })

    case '23505':
      // unique_violation
      return new DatabaseError('conflict', message, { code })

    case '23503':
      // foreign_key_violation — a referenced record is missing or still referenced
      return new DatabaseError('constraint', message, { code })

    case '23514':
      // check_violation — e.g. publishing without a required field
      return new DatabaseError('constraint', message, { code })

    case '22P02':
    case '22007':
    case '22001':
      // invalid_text_representation, invalid_datetime_format, string_data_right_truncation
      return new DatabaseError('invalid_input', message, { code })

    case '57014':
      // query_canceled
      return new DatabaseError('timeout', message, { code })

    case '40001':
    case '40P01':
      // serialization_failure, deadlock_detected
      return new DatabaseError('unavailable', message, { code })

    case 'PGRST116':
      // .single() / .maybeSingle() found no row
      return new DatabaseError('not_found', message, { code })

    case 'PGRST205':
      // table not found in the schema cache
      return new DatabaseError('unavailable', message, { code })
  }

  // --- PostgREST codes that are not SQLSTATE ------------------------------
  if (code?.startsWith('PGRST')) {
    if (code === 'PGRST102' || code === 'PGRST200') {
      // bulk insert key mismatch, or a constraint error surfaced by PostgREST
      return new DatabaseError('constraint', message, { code })
    }
    if (httpStatus === 401 || httpStatus === 403) {
      return new DatabaseError('unauthorized', message, { code })
    }
  }

  // --- Fall back on HTTP status ------------------------------------------
  switch (httpStatus) {
    case 400:
      return new DatabaseError('invalid_input', message, { code })
    case 401:
    case 403:
      return new DatabaseError('unauthorized', message, { code })
    case 404:
      return new DatabaseError('not_found', message, { code })
    case 409:
      return new DatabaseError('conflict', message, { code })
    case 408:
    case 504:
      return new DatabaseError('timeout', message, { code })
    case 503:
      return new DatabaseError('unavailable', message, { code })
  }

  return new DatabaseError('unknown', message, { code })
}

/**
 * Convenience wrapper for a Supabase call.
 *
 * Returns a discriminated result instead of throwing, so callers are forced to
 * decide how a failure surfaces.
 */
export type DbResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: DatabaseError }

export async function dbCall<T>(
  operation: () => Promise<{ data: T; error: { code?: string | null; message?: string | null; details?: string | null } | null }>,
): Promise<DbResult<T>> {
  try {
    const { data, error } = await operation()

    if (error) return { ok: false, error: toDatabaseError(error) }

    return { ok: true, data }
  } catch (cause) {
    // Network failure, DNS, or an unexpected throw from the client.
    return {
      ok: false,
      error: new DatabaseError('unavailable', 'Database request failed.', {
        cause,
      }),
    }
  }
}
