/**
 * Redirect resolution.
 *
 * Pure and framework-free: no database, no `next/server`, no request object. That
 * is deliberate, because the interesting behaviour here is *failure* behaviour —
 * chains, loops and malformed rules — and that is exactly what is hard to
 * exercise if it is welded to the HTTP layer.
 *
 * WHY THIS IS SMALL AND DUMB ON PURPOSE
 *
 * A redirect table is a lookup keyed by an exact path. There are no wildcards,
 * no regexes and no substitution parameters, because `redirects.from_path` is the
 * primary key and the database CHECK requires it to start with `/`. Every
 * request either matches a key exactly or does not match at all.
 *
 * That matters for safety as well as simplicity: a rule engine that can match
 * patterns is a rule engine that can be made to match `^/` or `/admin` by a
 * compromised editor account, and the blast radius of a redirect is the entire
 * site's entry points.
 */

/** Status codes the database CHECK permits. */
export const REDIRECT_STATUS_CODES = [301, 302, 307, 308] as const

export type RedirectStatusCode = (typeof REDIRECT_STATUS_CODES)[number]

/** One active rule, as read from the database. */
export type RedirectRule = {
  /** Site-relative source path. The primary key, so always unique. */
  from: string
  /** Either a site-relative path or an absolute `https://` URL. */
  to: string
  statusCode: RedirectStatusCode
}

/** The resolved outcome, or `null` when no rule applies. */
export type ResolvedRedirect = {
  /** Final destination, including the preserved query string. */
  to: string
  statusCode: RedirectStatusCode
  /** How many rules were followed. `1` means a single hop. */
  hops: number
}

/**
 * Maximum hops followed through a chain.
 *
 * A chain longer than this is treated as a mistake in the CMS rather than
 * something to serve. Crawlers follow redirect chains up to a limit of their own,
 * so an unbounded chain is worthless to everyone and expensive to us.
 */
export const MAX_REDIRECT_HOPS = 5

/**
 * Follow a redirect chain to its destination.
 *
 * Returns `null` when `pathname` matches no rule, which is the overwhelmingly
 * common case and must cost one map lookup and nothing else.
 *
 * **Chains are followed.** An editor who points `/a` at `/b` and later repoints
 * `/b` at `/c` has created a chain; resolving it to `/c` is the behaviour they
 * intended.
 *
 * **Loops return `null`, deliberately.** A loop is refused rather than partly
 * followed. Redirecting to the last non-repeating hop looks like it works — the
 * response has a status code and a Location — but it hands the browser a loop
 * that continues across requests: `/b -> /c -> /b` would spin the client, not
 * this function. Serving the original path instead means the misconfiguration
 * surfaces as an ordinary 404 that an editor can see, rather than as a hang.
 *
 * `detectRedirectLoop` refuses to *create* this state; this function is the
 * backstop for rules that predate it or were written directly to the database.
 */
export function resolveRedirect(
  rules: ReadonlyMap<string, RedirectRule>,
  pathname: string,
  search = '',
): ResolvedRedirect | null {
  const first = rules.get(pathname)
  if (!first) return null

  const visited = new Set<string>([pathname])
  let current = first
  let hops = 1

  while (hops < MAX_REDIRECT_HOPS) {
    const nextPath = toInternalPath(current.to)
    if (nextPath === null) break // External destination: the chain ends here.

    const next = rules.get(nextPath)
    if (!next) break // A real page, or a 404. Either way, this is the end.

    // Any revisit means the chain re-enters itself. Refuse the whole redirect.
    if (visited.has(nextPath)) return null

    visited.add(nextPath)
    current = next
    hops++
  }

  return {
    to: withSearch(current.to, search),
    statusCode: current.statusCode,
    hops,
  }
}

/**
 * Would adding or changing `from -> to` create a loop?
 *
 * Checked at write time, so an editor is told "this would loop" instead of
 * discovering it as a 404 for a URL they thought was redirected. It walks the
 * EXISTING rules forward from `to`: if the walk ever arrives back at `from`, or
 * revisits any path at all, the new rule closes a cycle.
 *
 * `candidate` is the rule being written, so it can also be evaluated against
 * itself — which is how a rule pointing at a path that eventually returns to it
 * is caught on the very first save.
 */
export function detectRedirectLoop(
  rules: ReadonlyMap<string, RedirectRule>,
  from: string,
  to: string,
  candidate?: RedirectRule,
): boolean {
  // Checked before anything else: a rule pointing at itself is the degenerate
  // loop, and it must be caught even when no other rule exists to walk.
  if (to === from) return true

  if (toInternalPath(to) === null) return false // Leaves the site; nothing to walk.

  const lookup = (path: string): RedirectRule | undefined =>
    path === from && candidate ? candidate : rules.get(path)

  const visited = new Set<string>()
  let current: RedirectRule | undefined = lookup(to)

  for (let hop = 0; hop < MAX_REDIRECT_HOPS; hop++) {
    if (!current) return false

    const nextPath = toInternalPath(current.to)
    if (nextPath === null) return false // External: the chain leaves the site.

    if (nextPath === from) return true // Straight back to the rule being written.
    if (visited.has(nextPath)) return true // A pre-existing cycle.
    visited.add(nextPath)

    current = lookup(nextPath)
  }

  return false
}

/**
 * The internal path a destination points at, or `null` when it is external.
 *
 * An absolute `https://` URL is external. Anything else must be a site-relative
 * path starting with `/`; the database enforces that, and a rule that somehow
 * violates it is treated as external rather than trusted as a path.
 */
export function toInternalPath(to: string): string | null {
  if (!to.startsWith('/')) return null
  // A protocol-relative URL (`//evil.test`) starts with `/` but leaves the site.
  // The CHECK requires `^/` so `//…` is technically allowed through; refusing it
  // here is what stops a redirect from being turned into an open redirect.
  if (to.startsWith('//')) return null
  return to
}

/**
 * Append the original query string to the destination.
 *
 * A visitor following `/scholarship?tag=x` to its new location should arrive at
 * `/scholarships/new?tag=x`. Dropping the query silently changes what the page
 * shows them, and on a filtered listing it changes which results they see.
 *
 * A destination that already carries its own query is left alone: the editor's
 * query is more specific than the visitor's, and concatenating two would produce
 * something neither of them asked for.
 */
function withSearch(to: string, search: string): string {
  if (!search || search === '?' || to.includes('?')) return to
  return `${to}${search.startsWith('?') ? search : `?${search}`}`
}

/**
 * Sanity-check a rule before it is stored.
 *
 * Mirrors the database CHECK constraints so an editor gets a field-level message
 * instead of a constraint-violation string, and adds the checks the database
 * cannot express: no self-redirect, and no redirect of the site root (which
 * would make every unmatched URL on the site a redirect).
 */
export function validateRedirectRule({
  from,
  to,
}: {
  from: string
  to: string
}): { ok: true } | { ok: false; message: string } {
  if (!from.startsWith('/')) {
    return { ok: false, message: 'The old path must start with a slash.' }
  }
  if (from.startsWith('//')) {
    return { ok: false, message: 'The old path must start with a single slash.' }
  }
  if (from === '/') {
    return { ok: false, message: 'The site root cannot be redirected.' }
  }
  if (!to.startsWith('/') && !to.startsWith('https://')) {
    return {
      ok: false,
      message: 'The new path must start with a slash, or be a full https:// address.',
    }
  }
  if (to.startsWith('//')) {
    return { ok: false, message: 'The new path cannot start with two slashes.' }
  }
  if (to === from) {
    return { ok: false, message: 'A redirect cannot point at itself.' }
  }
  if (/\s/.test(from) || /\s/.test(to)) {
    return { ok: false, message: 'Paths cannot contain spaces.' }
  }

  return { ok: true }
}