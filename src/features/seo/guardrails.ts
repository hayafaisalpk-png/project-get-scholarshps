/**
 * SEO index guardrails.
 *
 * Pure functions encoding the rules from `docs/SEO_GUIDELINES.md` §11. They live
 * apart from the Server Action because they answer a QUESTION — "may this record
 * be indexable?" — whose answer an editor needs explained in words, not just a
 * validation error. A boolean rejection tells the editor nothing about why their
 * record cannot rank.
 *
 * The rules:
 *
 *   1. Private, draft or excluded content cannot be forced indexable.
 *   2. Sitemap inclusion defaults to on only for `published` records.
 *   3. A record cannot be `noindex` and sitemap-included at the same time.
 *
 * Rule 3 is stricter than §11's wording, which allows an explicit override flag
 * that is audited. **No such flag exists in this schema**, and inventing one to
 * satisfy a sentence in a document would be building a feature nobody asked for.
 * What exists instead is a database CHECK on `articles` that forbids the
 * combination outright, so the pairs are written together here and the override
 * path is recorded as not implemented rather than silently assumed.
 */

/** Statuses whose pages actually exist for a visitor. */
const PUBLICLY_REACHABLE_STATUSES = new Set(['published', 'active'])

export type IndexSubject = {
  kind: 'scholarship' | 'article' | 'content_page'
  id: string
  title: string
  status: string
  /** Currently `noindex`? */
  noindex: boolean
}

export type GuardrailVerdict =
  | { ok: true; patch: { noindex: boolean; allow_sitemap: boolean | null } }
  | { ok: false; message: string }

/**
 * Decide the index patch for a record, or refuse the change.
 *
 * The patch always contains `allow_sitemap` for articles and `null` for the
 * other kinds, because only `articles` has that column — `scholarships` and
 * `content_pages` derive sitemap inclusion from `noindex` alone. Writing the
 * column where it does not exist would be a runtime error, not a no-op.
 */
export function resolveIndexChange(
  subject: IndexSubject,
  indexable: boolean,
): GuardrailVerdict {
  const hasSitemapColumn = subject.kind === 'article'

  if (indexable) {
    // RULE 1. A record a visitor cannot reach must not be advertised to a
    // crawler. Forcing a draft indexable is how an embargoed or unreviewed
    // record ends up in a search result.
    if (!PUBLICLY_REACHABLE_STATUSES.has(subject.status)) {
      return {
        ok: false,
        message: `This record is ${humanStatus(subject.status)}, so it is not on the site yet. Publish it first, then allow indexing.`,
      }
    }

    return {
      ok: true,
      patch: { noindex: false, allow_sitemap: hasSitemapColumn ? true : null },
    }
  }

  // RULE 3. Going noindex and leaving sitemap inclusion on would be a sitemap
  // advertising a page that asks not to be indexed — the exact contradiction
  // `src/lib/seo.ts` is built to avoid. Both columns move together.
  return {
    ok: true,
    patch: { noindex: true, allow_sitemap: hasSitemapColumn ? false : null },
  }
}

function humanStatus(status: string): string {
  switch (status) {
    case 'draft':
      return 'still a draft'
    case 'in_review':
      return 'in review'
    case 'scheduled':
      return 'scheduled for a future date'
    case 'archived':
      return 'archived'
    case 'inactive':
      return 'inactive'
    default:
      return `in the "${status}" state`
  }
}

/**
 * What an editor is most likely to have got wrong, derived from live data.
 *
 * This is an audit, not an enforcement mechanism — it exists so problems are
 * visible on one screen instead of discovered by a crawler. It never blocks a
 * save; `resolveIndexChange` does that.
 */
export type SeoIssue = {
  key: string
  severity: 'warning' | 'info'
  message: string
}

/**
 * Issues for one record, from the fields the pages actually use.
 *
 * Kept deliberately narrow: only genuine contradictions and genuine gaps, not a
 * wish list of "could be better" SEO advice. A screen that lists twenty
 * nitpicks for every record is a screen nobody reads.
 */
export function findSeoIssues(record: {
  kind: 'scholarship' | 'article' | 'content_page'
  id: string
  title: string
  status: string
  noindex: boolean
  allowSitemap?: boolean | null
  seoTitle?: string | null
  seoDescription?: string | null
  canonicalUrl?: string | null
}): SeoIssue[] {
  const issues: SeoIssue[] = []

  // RULE 3, observed rather than proposed: a record already in this state is a
  // real contradiction, whichever route wrote it.
  if (record.noindex && record.allowSitemap === true) {
    issues.push({
      key: `${record.kind}:${record.id}:sitemap-conflict`,
      severity: 'warning',
      message: 'Marked no-index but still listed in the sitemap.',
    })
  }

  if (
    !record.noindex &&
    PUBLICLY_REACHABLE_STATUSES.has(record.status) &&
    !record.seoTitle
  ) {
    issues.push({
      key: `${record.kind}:${record.id}:missing-title`,
      severity: 'info',
      message: 'No SEO title set — the page title will be used.',
    })
  }

  if (
    !record.noindex &&
    PUBLICLY_REACHABLE_STATUSES.has(record.status) &&
    !record.seoDescription
  ) {
    issues.push({
      key: `${record.kind}:${record.id}:missing-description`,
      severity: 'info',
      message: 'No meta description set.',
    })
  }

  if (record.canonicalUrl && !record.canonicalUrl.startsWith('https://')) {
    issues.push({
      key: `${record.kind}:${record.id}:insecure-canonical`,
      severity: 'warning',
      message: 'Canonical URL is not https.',
    })
  }

  return issues
}