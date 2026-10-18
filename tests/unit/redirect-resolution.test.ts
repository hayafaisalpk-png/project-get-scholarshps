import { describe, expect, it } from 'vitest'

import {
  detectRedirectLoop,
  MAX_REDIRECT_HOPS,
  type RedirectRule,
  type RedirectStatusCode,
  REDIRECT_STATUS_CODES,
  resolveRedirect,
  toInternalPath,
  validateRedirectRule,
} from '@/features/redirects/resolution'

/**
 * Redirect resolution.
 *
 * This is the part of the feature that runs on every request, and the part that
 * is hardest to verify by clicking: chains, loops, query preservation and
 * malformed rules. The database cannot express any of it — the CHECK constraints
 * forbid a rule pointing at itself but say nothing about `/a -> /b -> /a`, which
 * is exactly the case that would hang a crawler if the resolver followed it
 * blindly.
 */

function rules(...entries: [string, string, RedirectStatusCode?][]): Map<string, RedirectRule> {
  return new Map(
    entries.map(([from, to, statusCode = 301]) => [
      from,
      { from, to, statusCode: statusCode ?? 301 } as RedirectRule,
    ]),
  )
}

describe('redirect status codes', () => {
  it('is exactly the set the database CHECK permits', () => {
    // Mirrors `check (status_code in (301, 302, 307, 308))`.
    expect([...REDIRECT_STATUS_CODES]).toEqual([301, 302, 307, 308])
  })
})

describe('resolveRedirect', () => {
  it('returns null when nothing matches — the common case', () => {
    expect(resolveRedirect(rules(['/old', '/new']), '/current')).toBeNull()
  })

  it('resolves a single hop with its status code', () => {
    const result = resolveRedirect(rules(['/old', '/new']), '/old')
    expect(result).toEqual({ to: '/new', statusCode: 301, hops: 1 })
  })

  it('uses the status code the rule declares', () => {
    expect(resolveRedirect(rules(['/old', '/new', 302]), '/old')?.statusCode).toBe(302)
  })

  it('matches paths EXACTLY, never by prefix', () => {
    // A prefix match would let a rule for `/scholarships` capture every
    // scholarship URL on the site.
    const map = rules(['/scholarships', '/search'])
    expect(resolveRedirect(map, '/scholarships/sample-award')).toBeNull()
    expect(resolveRedirect(map, '/scholarships')).not.toBeNull()
  })

  it('follows a chain to its final destination', () => {
    // What an editor gets when they point /a at /b and later repoint /b at /c.
    const result = resolveRedirect(
      rules(['/a', '/b'], ['/b', '/c']),
      '/a',
    )
    expect(result).toEqual({ to: '/c', statusCode: 301, hops: 2 })
  })

  it('refuses a two-hop loop rather than obeying it', () => {
    // Refused entirely, not partially followed: redirecting to the last
    // non-repeating hop would hand the browser a loop that continues across
    // requests. Serving the original path surfaces the mistake as a 404.
    expect(resolveRedirect(rules(['/a', '/b'], ['/b', '/a']), '/a')).toBeNull()
  })

  it('refuses a loop discovered mid-walk', () => {
    const map = rules(['/a', '/b'], ['/b', '/c'], ['/c', '/b'], ['/unrelated', '/landing'])

    // Every entry point into the cycle is refused, not just the first one seen.
    expect(resolveRedirect(map, '/a')).toBeNull()
    expect(resolveRedirect(map, '/b')).toBeNull()
    expect(resolveRedirect(map, '/c')).toBeNull()

    // A rule outside the cycle is unaffected.
    expect(resolveRedirect(map, '/unrelated')?.to).toBe('/landing')
  })

  it('stops at the hop limit rather than walking forever', () => {
    const many: [string, string][] = Array.from({ length: 20 }, (_, i) => [
      `/p${i}`,
      `/p${i + 1}`,
    ])
    const result = resolveRedirect(rules(...many), '/p0')

    expect(result?.hops).toBe(MAX_REDIRECT_HOPS)
    expect(result?.to).toBe(`/p${MAX_REDIRECT_HOPS}`)
  })

  it('ends a chain at an external destination', () => {
    const result = resolveRedirect(
      rules(['/old', 'https://example.org/new'], ['https://x', '/nope']),
      '/old',
    )
    expect(result?.to).toBe('https://example.org/new')
  })

  it('preserves the query string so a filtered view survives the move', () => {
    const result = resolveRedirect(rules(['/old', '/new']), '/old', '?level=graduate')
    expect(result?.to).toBe('/new?level=graduate')
  })

  it('leaves a destination that carries its own query alone', () => {
    // Concatenating would produce something neither the editor nor the visitor
    // asked for.
    const result = resolveRedirect(
      rules(['/old', '/new?ref=campaign']),
      '/old',
      '?level=graduate',
    )
    expect(result?.to).toBe('/new?ref=campaign')
  })

  it('ignores an empty or bare search string', () => {
    expect(resolveRedirect(rules(['/old', '/new']), '/old', '?')?.to).toBe('/new')
    expect(resolveRedirect(rules(['/old', '/new']), '/old', '')?.to).toBe('/new')
  })
})

describe('detectRedirectLoop', () => {
  it('finds a loop the new rule would close', () => {
    // /a -> /b exists, /b -> /c exists, and /c -> /a would close the circle.
    const map = rules(['/a', '/b'], ['/b', '/c'])
    expect(detectRedirectLoop(map, '/c', '/a')).toBe(true)
  })

  it('finds a direct self-loop', () => {
    expect(detectRedirectLoop(rules(), '/a', '/a')).toBe(true)
  })

  it('sees the candidate rule when it is already in the map being tested', () => {
    // Editing an existing rule: the stored copy still says /a, the new one does not.
    const map = rules(['/a', '/b'], ['/b', '/a'])
    expect(detectRedirectLoop(map, '/a', '/b')).toBe(true)
  })

  it('passes an ordinary chain', () => {
    expect(detectRedirectLoop(rules(['/b', '/c']), '/a', '/b')).toBe(false)
  })

  it('passes a rule that leaves the site', () => {
    expect(detectRedirectLoop(rules(['/b', '/a']), '/a', 'https://example.org')).toBe(false)
  })
})

describe('toInternalPath', () => {
  it('treats a site-relative path as internal', () => {
    expect(toInternalPath('/scholarships/award')).toBe('/scholarships/award')
  })

  it('treats an absolute https URL as external', () => {
    expect(toInternalPath('https://example.org/x')).toBeNull()
  })

  /**
   * The open-redirect guard.
   *
   * `//evil.test` satisfies the database CHECK (`^/`) while leaving the site, so
   * a rule pointing at one would turn the redirect table into a phishing vector.
   */
  it('refuses a protocol-relative URL, which starts with a slash but leaves the site', () => {
    expect(toInternalPath('//evil.test/path')).toBeNull()
  })
})

describe('validateRedirectRule', () => {
  it('accepts an ordinary move', () => {
    expect(validateRedirectRule({ from: '/old', to: '/new' })).toEqual({ ok: true })
  })

  it('accepts an external https destination', () => {
    expect(validateRedirectRule({ from: '/old', to: 'https://example.org/new' }).ok).toBe(true)
  })

  it('rejects a destination with a non-https scheme', () => {
    // http:// would silently downgrade the visitor's connection on a redirect.
    expect(validateRedirectRule({ from: '/old', to: 'http://example.org' }).ok).toBe(false)
  })

  it('rejects the site root as a source', () => {
    // A rule on `/` would capture every unmatched URL on the site, including
    // every typo, into a redirect.
    const result = validateRedirectRule({ from: '/', to: '/scholarships' })
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.message).toMatch(/root/i)
  })

  it('rejects a self-referential rule', () => {
    expect(validateRedirectRule({ from: '/old', to: '/old' }).ok).toBe(false)
  })

  it('rejects a source that does not start with a slash', () => {
    expect(validateRedirectRule({ from: 'old', to: '/new' }).ok).toBe(false)
  })

  it('rejects a protocol-relative destination', () => {
    expect(validateRedirectRule({ from: '/old', to: '//evil.test' }).ok).toBe(false)
  })

  it('rejects a relative destination, which would resolve against the current path', () => {
    expect(validateRedirectRule({ from: '/old', to: 'new' }).ok).toBe(false)
  })

  it('rejects whitespace in either path', () => {
    expect(validateRedirectRule({ from: '/old path', to: '/new' }).ok).toBe(false)
    expect(validateRedirectRule({ from: '/old', to: '/new path' }).ok).toBe(false)
  })
})