import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import {
  type RedirectRule,
  type RedirectStatusCode,
  REDIRECT_STATUS_CODES,
} from './resolution'

/**
 * Redirect rule store for request-time enforcement.
 *
 * WHY A CACHE, AND WHY IT IS ALLOWED TO BE STALE
 *
 * A redirect lookup happens on every request that reaches the proxy. Querying
 * the database each time would make a redirect table a latency tax on the entire
 * site in exchange for a feature used by a handful of migrated URLs. So the map
 * is held in module scope and refreshed on a TTL.
 *
 * `invalidateRedirectCache()` below is called by every admin action, and it is
 * important to be precise about what it achieves: **it cannot reach the proxy.**
 *
 * The proxy runs in its own module registry, separate from the one that runs
 * Server Actions. Calling `invalidateRedirectCache()` from an action clears the
 * cache in the RSC process; the copy the proxy reads is a different variable in
 * a different isolate and is untouched. This was measured, not assumed: a rule
 * created through the CMS did not begin redirecting until the TTL expired, even
 * though the action had just invalidated "the" cache.
 *
 * So the TTL is the ONLY bound, in both directions:
 *
 *   - a NEW redirect starts working after at most `REDIRECT_TTL_MS`;
 *   - a DELETED or PAUSED redirect keeps firing for at most the same window.
 *
 * 15 seconds is the value. It is short enough that "save, then check the old
 * URL" behaves the way an editor expects, and long enough that the cost is one
 * query per 15 seconds for the whole site rather than one per request.
 * In-flight requests are de-duplicated below, so a cold start or an expiry
 * during a traffic spike costs one query, not one per concurrent request.
 *
 * Removing this bound properly would need a shared cache (Redis), which is not
 * configured and would need approval to add — see `AGENTS.md` §2.10. The
 * alternative, re-reading the table on every request, is worse.
 *
 * WHY THE SERVICE-ROLE CLIENT
 *
 * `redirects` SELECT is granted only to a role holding `seo.manage` or
 * `settings.manage` (migrations 010 and 029), and the proxy has no session
 * cookie to authorise with — it runs before authentication, by design, because
 * a redirect should not depend on who is asking. Two options follow:
 *
 *   1. widen the table to `anon`, which publishes the entire redirect map to
 *      anyone willing to query it and makes it a place to store spam links;
 *   2. read it with the service-role key, on the server, from a file that is
 *      marked `server-only`.
 *
 * (2) is chosen. The data is not secret — it is a list of public URLs — but it
 * does not belong on the public Data API. This module is server-only and the key
 * is never exposed to the browser.
 *
 * FAILURE BEHAVIOUR
 *
 * If the database is unreachable, the LAST KNOWN GOOD map is returned. If there
 * has never been one, an empty map is returned. The alternative — failing the
 * request — would turn a redirect table outage into a total site outage, which
 * is the wrong trade for an optimisation feature.
 */

const REDIRECT_TTL_MS = 15_000

type CacheEntry = {
  map: Map<string, RedirectRule>
  fetchedAt: number
}

let cache: CacheEntry | null = null
let inFlight: Promise<Map<string, RedirectRule>> | null = null

function isStatusCode(value: number): value is RedirectStatusCode {
  return (REDIRECT_STATUS_CODES as readonly number[]).includes(value)
}

/**
 * The active redirect rules, keyed by source path.
 *
 * Safe to call on every request: after the first fetch within the TTL this is a
 * property read, and concurrent callers share one in-flight request rather than
 * stampeding the database on a cold start.
 */
export async function getRedirectRules(): Promise<Map<string, RedirectRule>> {
  const now = Date.now()

  if (cache && now - cache.fetchedAt < REDIRECT_TTL_MS) {
    return cache.map
  }

  if (inFlight) return inFlight

  inFlight = loadRules()
    .then((map) => {
      cache = { map, fetchedAt: Date.now() }
      return map
    })
    .finally(() => {
      inFlight = null
    })

  return inFlight
}

/**
 * Drop the cached map in THIS process.
 *
 * Called by the admin actions after a write. It keeps the Server Action process
 * from serving its own stale copy — notably when the CMS re-reads the list right
 * after a save — but it does NOT reach the proxy, which has a separate module
 * registry. See the note at the top of this file: the TTL is the real bound for
 * request-time enforcement.
 */
export function invalidateRedirectCache(): void {
  cache = null
}

async function loadRules(): Promise<Map<string, RedirectRule>> {
  try {
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('redirects')
      .select('from_path, to_path, status_code')
      .eq('is_active', true)

    if (error) throw new Error(error.message)

    const map = new Map<string, RedirectRule>()

    for (const row of data ?? []) {
      const from = row.from_path
      const to = row.to_path
      const statusCode = row.status_code

      if (typeof from !== 'string' || typeof to !== 'string') continue
      if (!isStatusCode(statusCode)) {
        // A status outside the permitted set would produce a response Next.js
        // cannot send. Skipping the rule is safer than serving it.
        console.error(
          `[redirects] ignoring rule ${from} with unsupported status ${statusCode}`,
        )
        continue
      }

      map.set(from, { from, to, statusCode })
    }

    return map
  } catch (error) {
    console.error('[redirects] load failed, serving without redirects:', error)

    // Serve the last known good rules rather than failing the request.
    return cache?.map ?? new Map()
  }
}