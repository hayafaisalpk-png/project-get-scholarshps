import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Container, Section } from '@/components/layout/container'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { ButtonExternal, ButtonLink } from '@/components/ui/button'
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
  formatTimestamp,
  getDeadlineState,
} from '@/lib/format'
import { absoluteUrl } from '@/lib/env'

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

  return {
    title,
    description: description.slice(0, 300),
    alternates: { canonical: `/scholarships/${scholarship.slug}` },
    openGraph: {
      type: 'article',
      title,
      description: description.slice(0, 300),
      url: absoluteUrl(`/scholarships/${scholarship.slug}`),
    },
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

  return (
    <Section>
      <Container>
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

            <h1 className="mt-4 text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">
              {scholarship.title}
            </h1>

            <p className="mt-2 text-lg text-ink-600">
              Offered by {scholarship.sponsor_name}
            </p>

            <p className="mt-6 text-3xl font-bold text-brand-800">
              {formatAwardAmount(
                scholarship.award_amount_min_cents,
                scholarship.award_amount_max_cents,
                scholarship.award_amount_text,
                scholarship.award_currency,
              )}
            </p>
            {scholarship.number_of_awards ? (
              <p className="mt-1 text-sm text-ink-600">
                {scholarship.number_of_awards.toLocaleString('en-US')}{' '}
                {scholarship.number_of_awards === 1 ? 'award' : 'awards'} per year
                {scholarship.award_per_year ? '' : ' in total'}
              </p>
            ) : null}

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

            <div className="mt-8 flex flex-wrap gap-3">
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
              <ButtonLink href="/scholarships" variant="outline" size="lg">
                Browse more scholarships
              </ButtonLink>
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
                <div className="mt-3 whitespace-pre-line text-ink-700">
                  {scholarship.eligibility_requirements}
                </div>
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

            {scholarship.required_documents?.length ? (
              <section className="mt-8">
                <h2 className="text-xl font-bold text-ink-900">
                  Documents you may need
                </h2>
                <ul className="mt-3 list-disc space-y-1.5 pl-5 text-ink-700">
                  {scholarship.required_documents.map((doc) => (
                    <li key={doc}>{doc}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            {scholarship.application_instructions ? (
              <section className="mt-8">
                <h2 className="text-xl font-bold text-ink-900">
                  How to apply
                </h2>
                <div className="mt-3 whitespace-pre-line text-ink-700">
                  {scholarship.application_instructions}
                </div>
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

            <section className="mt-10 rounded-sm border border-ink-200 bg-surface p-5">
              <h2 className="text-base font-semibold text-ink-900">
                About this information
              </h2>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex flex-wrap gap-x-2">
                  <dt className="font-medium text-ink-700">Last reviewed:</dt>
                  <dd className="text-ink-600">
                    {scholarship.last_reviewed_at
                      ? formatTimestamp(scholarship.last_reviewed_at)
                      : 'Not yet reviewed'}
                  </dd>
                </div>
                <div className="flex flex-wrap gap-x-2">
                  <dt className="font-medium text-ink-700">Source status:</dt>
                  <dd className="text-ink-600">
                    {scholarship.verification_status === 'verified'
                      ? 'Checked against the official provider page'
                      : 'Not yet verified — confirm details on the official page'}
                  </dd>
                </div>
              </dl>

              {scholarship.sources.length > 0 ? (
                <div className="mt-3">
                  <h3 className="text-sm font-medium text-ink-700">
                    Official sources
                  </h3>
                  <ul className="mt-1.5 space-y-1 text-sm">
                    {scholarship.sources.map((source) => (
                      <li key={source.source_url}>
                        <a
                          href={source.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-brand-700 underline underline-offset-2"
                        >
                          {source.source_name}
                          <span className="sr-only-focusable"> (opens in a new tab)</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <p className="mt-4 text-sm">
                <Link
                  href={`/contact?type=report&slug=${encodeURIComponent(scholarship.slug)}`}
                  className="font-medium text-brand-700 underline underline-offset-2"
                >
                  Report incorrect information
                </Link>
              </p>
            </section>
          </article>

          {/* --------------------------------------------------------- Sidebar */}
          <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-sm border border-ink-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-ink-900">Key details</h2>
              <dl className="mt-3 space-y-3 text-sm">
                <Detail
                  label="Deadline"
                  value={
                    scholarship.is_rolling
                      ? 'Rolling — applies all year'
                      : formatDate(scholarship.deadline) || 'Not specified'
                  }
                />
                {scholarship.opens_at ? (
                  <Detail label="Opens" value={formatDate(scholarship.opens_at)} />
                ) : null}
                <Detail
                  label="Application fee"
                  value={
                    scholarship.application_fee_cents === 0
                      ? 'None'
                      : formatCurrency(scholarship.application_fee_cents)
                  }
                />
                <Detail
                  label="Renewable"
                  value={scholarship.is_renewable ? 'Yes' : 'No'}
                />
                {scholarship.award_currency !== 'USD' ? (
                  <Detail label="Currency" value={scholarship.award_currency} />
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

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-ink-600">{label}</dt>
      <dd className="text-right font-medium text-ink-900">{value}</dd>
    </div>
  )
}
