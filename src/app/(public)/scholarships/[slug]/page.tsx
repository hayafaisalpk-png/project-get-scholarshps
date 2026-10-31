import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Container, Section } from '@/components/layout/container'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { ButtonExternal, ButtonLink } from '@/components/ui/button'
import { JsonLd } from '@/components/structured-data'
import { ScholarshipCardCompact } from '@/features/scholarships/components/scholarship-card'
import {
  getRelatedScholarships,
  getScholarshipBySlug,
} from '@/features/scholarships/queries'
import {
  formatAwardAmount,
  formatCurrency,
  formatDate,
  formatDeadlineNote,
  getDeadlineState,
} from '@/lib/format'
import { breadcrumbLd, graph, webPageLd } from '@/lib/structured-data'
import { absoluteUrl } from '@/lib/env'
import {
  resolveScholarshipSocialImage,
} from '@/features/scholarships/metadata'

/**
 * Scholarship detail page.
 *
 * Design rules, in priority order:
 *
 *   1. An expired scholarship still renders, in full, with a clear status. Its
 *      facts keep historical value and its page may already be linked from
 *      search engines. Hiding it would break both.
 *   2. Unknown fields say nothing rather than guessing. "Amount not specified"
 *      is honest; a fabricated range is not.
 *   3. Facts sourced from the provider are attributed; our own editorial
 *      summary is labelled as ours.
 */

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params
  const scholarship = await getScholarshipBySlug(slug)

  if (!scholarship) {
    return {
      title: 'Scholarship not found',
      // A 404 page should not be indexed.
      robots: { index: false, follow: true },
    }
  }

  const title = scholarship.seo_title || `${scholarship.title} | Scholarships`
  const description =
    scholarship.seo_description ||
    scholarship.summary ||
    `${scholarship.title} from ${scholarship.sponsor_name}.`

  const socialImageUrl = resolveScholarshipSocialImage(scholarship)

  return {
    title,
    description: description.slice(0, 300),
    alternates: { canonical: `/scholarships/${scholarship.slug}` },
    /*
     * An editor can tick `noindex` on a PUBLISHED scholarship — a duplicate, a
     * record kept only for its historical facts, a partner listing we must not
     * promote. The sitemap already skips those rows, but a sitemap is only one
     * discovery path: any crawler following an inbound link reads the robots
     * meta on the page itself. Without this directive the record was excluded
     * from the sitemap and advertised as indexable at the same time, which is
     * the contradiction `src/lib/seo.ts` warns about.
     */
    robots: scholarship.noindex
      ? { index: false, follow: true }
      : { index: true, follow: true },
    openGraph: {
      type: 'article',
      title,
      description: description.slice(0, 300),
      url: absoluteUrl(`/scholarships/${scholarship.slug}`),
      ...(socialImageUrl ? { images: [{ url: socialImageUrl }] } : {}),
    },
    ...(socialImageUrl
      ? {
          twitter: {
            card: 'summary_large_image',
            title,
            description: description.slice(0, 300),
            images: [{ url: socialImageUrl }],
          },
        }
      : {}),
    other: {
      'article:published_time': scholarship.published_at ?? '',
    },
  }
}

export default async function ScholarshipDetailPage({ params }: Params) {
  const { slug } = await params

  const scholarship = await getScholarshipBySlug(slug)

  // The query filters to published rows, so a draft and a missing record are
  // indistinguishable here. That is deliberate: a visitor must not be able to
  // discover unpublished slugs by probing URLs.
  if (!scholarship) notFound()

  const deadlineState = getDeadlineState(
    scholarship.deadline,
    scholarship.is_rolling,
  )
  const deadlineNote = formatDeadlineNote(
    scholarship.deadline,
    scholarship.is_rolling,
  )
  const isClosed = deadlineState === 'closed'

  const related = await getRelatedScholarships({
    scholarshipId: scholarship.id,
    limit: 3,
  })

  const taxonomyLinks = [
    ...scholarship.education_levels.map((t) => ({
      name: t.name,
      href: `/scholarships/education-level/${t.slug}`,
    })),
    ...scholarship.fields.map((t) => ({
      name: t.name,
      href: `/scholarships/field/${t.slug}`,
    })),
    ...scholarship.categories.map((t) => ({
      name: t.name,
      href: `/scholarships/category/${t.slug}`,
    })),
    ...scholarship.locations.map((t) => ({
      name: t.name,
      href: `/scholarships/location/${t.slug}`,
    })),
    ...scholarship.tags.map((t) => ({
      name: t.name,
      href: `/scholarships?tag=${encodeURIComponent(t.slug)}`,
    })),
  ]

  const detailPath = `/scholarships/${scholarship.slug}`

  /*
   * Page-level structured data. Both builders take `noindex` and decline to emit
   * anything when it is set, so a withdrawn record advertises no rich result
   * while remaining reachable by URL.
   */
  const structuredData = graph(
    webPageLd({
      name: scholarship.seo_title || scholarship.title,
      description: scholarship.seo_description || scholarship.summary,
      path: detailPath,
      datePublished: scholarship.published_at,
      dateModified: scholarship.updated_at,
      noindex: scholarship.noindex,
    }),
    breadcrumbLd([
      { name: 'Home', path: '/' },
      { name: 'Scholarships', path: '/scholarships' },
      { name: scholarship.title, path: detailPath },
    ]),
  )

  return (
    <Section>
      <Container>
        <JsonLd data={structuredData} />

        {/* Breadcrumbs give both orientation and a clear hierarchy to crawlers. */}
        <nav aria-label="Breadcrumb" className="mb-6">
          <ol className="flex flex-wrap items-center gap-2 text-sm text-ink-600">
            <li>
              <Link href="/" className="hover:text-brand-800 hover:underline">
                Home
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link
                href="/scholarships"
                className="hover:text-brand-800 hover:underline"
              >
                Scholarships
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="font-medium text-ink-900">
              {scholarship.title}
            </li>
          </ol>
        </nav>

        <div className="grid gap-10 lg:grid-cols-[1fr_20rem]">
          <article>
            <div className="flex flex-wrap items-center gap-2">
              {isClosed ? (
                <Badge tone="neutral">Applications closed</Badge>
              ) : (
                <Badge tone="success">{deadlineNote}</Badge>
              )}
              {scholarship.is_renewable ? (
                <Badge tone="success">Renewable</Badge>
              ) : null}
              {scholarship.application_fee_cents === 0 ? (
                <Badge tone="info">No application fee</Badge>
              ) : null}
              {scholarship.verification_status === 'verified' ? (
                <Badge tone="success">Verified source</Badge>
              ) : (
                <Badge tone="warning">Source not yet verified</Badge>
              )}
            </div>

            <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
              {scholarship.title}
            </h1>

            <div className="mt-2 flex items-center gap-3">
              {scholarship.institution?.logo_url ? (
                <Image
                  src={scholarship.institution.logo_url}
                  alt={`${scholarship.institution.name} logo`}
                  width={40}
                  height={40}
                  unoptimized
                  className="h-10 w-10 flex-none object-contain"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 flex-none items-center justify-center rounded-sm bg-ink-100 text-lg font-semibold text-ink-600"
                >
                  {(scholarship.institution?.name ?? scholarship.sponsor_name)
                    .charAt(0)
                    .toUpperCase()}
                </span>
              )}
              <p className="text-lg text-ink-600">
                Offered by{' '}
                {scholarship.institution?.name ?? scholarship.sponsor_name}
                {scholarship.institution?.country
                  ? ` · ${scholarship.institution.country}`
                  : null}
              </p>
            </div>

            {isClosed ? (
              <Alert tone="info" className="mt-6" title="Applications have closed">
                <p>
                  The deadline for this scholarship was{' '}
                  {formatDate(scholarship.deadline)}. We keep this page so the
                  information stays available.{' '}
                  <Link
                    href="/scholarships?deadline=open"
                    className="font-semibold underline underline-offset-2"
                  >
                    See scholarships that are still open
                  </Link>
                  .
                </p>
              </Alert>
            ) : null}

            {/*
              The apply call to action lives in the sticky sidebar on desktop,
              as it does in the reference. It is repeated here only for the
              mobile layout, where the sidebar falls below the article body —
              `lg:hidden` / `hidden lg:block` mean it is never rendered twice
              in the same viewport.
            */}
            <div className="mt-8 flex flex-wrap gap-3 lg:hidden">
              {scholarship.application_url ? (
                <ButtonExternal
                  href={scholarship.application_url}
                  size="lg"
                  variant={isClosed ? 'outline' : 'primary'}
                >
                  {isClosed ? 'View the official page' : 'Apply on the official site'}
                  <span className="sr-only-focusable">
                    {' '}
                    for {scholarship.title} (opens in a new tab)
                  </span>
                </ButtonExternal>
              ) : (
                <p className="text-sm text-ink-600">
                  No official application link has been recorded yet.
                </p>
              )}
            </div>

            {scholarship.summary ? (
              <section className="mt-10">
                <h2 className="text-xl font-bold text-ink-900">About this scholarship</h2>
                <p className="mt-3 whitespace-pre-line text-ink-700">
                  {scholarship.summary}
                </p>
              </section>
            ) : null}

            {scholarship.description ? (
              <section className="mt-8">
                <h2 className="text-xl font-bold text-ink-900">Full details</h2>
                <div className="mt-3 whitespace-pre-line text-ink-700">
                  {scholarship.description}
                </div>
              </section>
            ) : null}

            <section className="mt-8">
              <h2 className="text-xl font-bold text-ink-900">Eligibility</h2>
              {scholarship.eligibility_requirements ? (
                <div
                  className="prose-editorial mt-3 text-ink-700"
                  dangerouslySetInnerHTML={{
                    __html: scholarship.eligibility_requirements,
                  }}
                />
              ) : (
                <p className="mt-3 text-ink-600">
                  Eligibility requirements have not been recorded. Check the
                  official page before applying.
                </p>
              )}

              {taxonomyLinks.length > 0 ? (
                <ul className="mt-5 flex flex-wrap gap-2">
                  {taxonomyLinks.map((link) => (
                    <li key={`${link.href}-${link.name}`}>
                      <Link
                        href={link.href}
                        className="inline-flex rounded-full bg-ink-100 px-3 py-1 text-sm font-medium text-ink-700 hover:bg-ink-200"
                      >
                        {link.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>

            {scholarship.required_documents ? (
              <section className="mt-8">
                <h2 className="text-xl font-bold text-ink-900">
                  Documents you may need
                </h2>
                <div
                  className="prose-editorial mt-3 text-ink-700"
                  dangerouslySetInnerHTML={{
                    __html: scholarship.required_documents,
                  }}
                />
              </section>
            ) : null}

            {scholarship.application_instructions ? (
              <section className="mt-8">
                <h2 className="text-xl font-bold text-ink-900">
                  How to apply
                </h2>
                <div
                  className="prose-editorial mt-3 text-ink-700"
                  dangerouslySetInnerHTML={{
                    __html: scholarship.application_instructions,
                  }}
                />
              </section>
            ) : null}

            {scholarship.is_renewable && scholarship.renewal_details ? (
              <section className="mt-8">
                <h2 className="text-xl font-bold text-ink-900">Renewal</h2>
                <div className="mt-3 whitespace-pre-line text-ink-700">
                  {scholarship.renewal_details}
                </div>
              </section>
            ) : null}

          </article>

          {/* --------------------------------------------------------- Sidebar */}
          <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
            {/*
              Reference detail sidebar: the award amount is the hero, a status
              pill sits beside it, and the remaining facts are an eyebrow/value
              grid. Hairline rules rather than shadows separate the rows.
            */}
            <div className="rounded-sm bg-white p-6 shadow-xs ring-1 ring-ink-200">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-3xl font-extrabold tracking-tight text-ink-900">
                  {formatAwardAmount(
                    scholarship.award_amount_min_cents,
                    scholarship.award_amount_max_cents,
                    scholarship.award_amount_text,
                    scholarship.award_currency,
                  )}
                </p>
                <StatusPill isClosed={isClosed} />
              </div>

              {scholarship.number_of_awards ? (
                <p className="mt-2 text-sm text-ink-600">
                  {scholarship.number_of_awards.toLocaleString('en-US')}{' '}
                  {scholarship.number_of_awards === 1 ? 'award' : 'awards'}
                  {scholarship.award_per_year ? ' per year' : ' in total'}
                </p>
              ) : null}

              {/* Desktop-only call to action; the mobile layout renders it
                  above the article body instead. */}
              <div className="mt-6 hidden flex-col gap-3 lg:flex">
                {scholarship.application_url ? (
                  <ButtonExternal
                    href={scholarship.application_url}
                    variant={isClosed ? 'outline' : 'primary'}
                  >
                    {isClosed ? 'View the official page' : 'Apply on the official site'}
                    <span className="sr-only-focusable">
                      {' '}
                      for {scholarship.title} (opens in a new tab)
                    </span>
                  </ButtonExternal>
                ) : null}
                <ButtonLink href="/scholarships" variant="outline">
                  Browse more scholarships
                </ButtonLink>
              </div>

              <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-5 border-t border-ink-200 pt-6">
                <Fact
                  label="Deadline"
                  value={
                    scholarship.is_rolling
                      ? 'Rolling'
                      : formatDate(scholarship.deadline) || 'Not recorded'
                  }
                />
                {scholarship.opens_at ? (
                  <Fact label="Opens" value={formatDate(scholarship.opens_at)} />
                ) : null}
                <Fact
                  label="Application fee"
                  value={
                    scholarship.application_fee_cents === 0
                      ? 'None'
                      : formatCurrency(scholarship.application_fee_cents)
                  }
                />
                <Fact
                  label="Renewable"
                  value={scholarship.is_renewable ? 'Yes' : 'No'}
                />
                {scholarship.award_currency !== 'USD' ? (
                  <Fact label="Currency" value={scholarship.award_currency} />
                ) : null}
              </dl>
            </div>

            {related.length > 0 ? (
              <div>
                <h2 className="mb-3 text-sm font-semibold text-ink-900">
                  Related scholarships
                </h2>
                <div className="space-y-3">
                  {related.map((item) => (
                    <ScholarshipCardCompact key={item.id} scholarship={item} />
                  ))}
                </div>
              </div>
            ) : null}
          </aside>
        </div>
      </Container>
    </Section>
  )
}

/** Eyebrow label over a bold value — the reference's sidebar fact pattern. */
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-ink-900">{value}</dd>
    </div>
  )
}

/**
 * Open/closed status pill.
 *
 * Colour alone is not an accessible signal, so the state is always spelled out
 * in text as well as tinted.
 */
function StatusPill({ isClosed }: { isClosed: boolean }) {
  return (
    <span
      className={
        isClosed
          ? 'inline-flex items-center rounded-sm bg-ink-100 px-2.5 py-1 text-xs font-semibold text-ink-700 ring-1 ring-inset ring-ink-200'
          : 'inline-flex items-center rounded-sm bg-accent-50 px-2.5 py-1 text-xs font-semibold text-accent-800 ring-1 ring-inset ring-accent-200'
      }
    >
      {isClosed ? 'Closed' : 'Open'}
    </span>
  )
}
