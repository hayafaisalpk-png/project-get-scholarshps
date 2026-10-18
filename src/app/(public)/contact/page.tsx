import type { Metadata } from 'next'
import Link from 'next/link'

import { Container, Section } from '@/components/layout/container'
import { ContactForm } from '@/features/contact/components/contact-form'
import { ReportForm } from '@/features/contact/components/report-form'
import { createClient } from '@/lib/supabase/server'
import { CONTACT_SUBJECTS, type ContactSubject } from '@/lib/validation/contact'
import type { ReportTarget } from '@/lib/validation/contact'

/**
 * Contact page.
 *
 * Serves two distinct jobs, chosen by `?type=report&slug=…`:
 *
 *   /contact                  a message to a person      -> contact_submissions
 *   /contact?type=report&…    a correction to a record   -> content_reports
 *
 * The second form exists because every scholarship and article page links to it
 * with the record already identified. Before this route existed those links 404'd
 * — the "Report incorrect information" affordance was advertised and did nothing.
 *
 * The record's title is resolved server-side through the session client, so RLS
 * decides whether it can be shown. An unpublished or non-existent slug falls
 * back to the general contact form rather than rendering a report form pointed at
 * nothing.
 */

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Contact us',
  description:
    'Send GetScholarship a message, or report a scholarship or article that carries incorrect information.',
  alternates: { canonical: '/contact' },
  // A contact page has no value in a search index and is often scraped.
  robots: { index: true, follow: true },
}

type Params = {
  searchParams: Promise<{
    type?: string | undefined
    kind?: string | undefined
    slug?: string | undefined
    subject?: string | undefined
  }>
}

/** Only the exact value `report` opens the correction form. */
function isReportRequest(type: string | undefined): boolean {
  return type === 'report'
}

/** Resolve a public record's title so the form can name what is being reported. */
async function resolveRecord(
  kind: ReportTarget,
  slug: string,
): Promise<string | null> {
  const supabase = await createClient()

  const table = kind === 'article' ? 'articles' : 'scholarships'

  // Session client, so RLS applies: a draft or unpublished record is invisible
  // here and the page degrades to the general contact form.
  const { data, error } = await supabase
    .from(table)
    .select('title')
    .eq('slug', slug)
    .maybeSingle()

  if (error) {
    console.error('[contact] record lookup failed:', error.message)
    return null
  }

  return data?.title ?? null
}

export default async function ContactPage({ searchParams }: Params) {
  const params = await searchParams

  const wantsReport = isReportRequest(params.type)
  const slug = params.slug?.trim() ?? ''

  const kind: ReportTarget = params.kind === 'article' ? 'article' : 'scholarship'

  // Only attempt a report form when we were given something to report AND the
  // record actually resolves to something a visitor is allowed to see.
  const recordTitle = wantsReport && slug ? await resolveRecord(kind, slug) : null

  const subject = CONTACT_SUBJECTS.find(
    (value) => value === params.subject,
  ) as ContactSubject | undefined

  return (
    <Section>
      <Container>
        <div className="mx-auto max-w-2xl">
          <h1 className="text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">
            {recordTitle ? 'Report incorrect information' : 'Contact us'}
          </h1>

          <p className="mt-3 text-ink-600">
            {recordTitle
              ? 'Corrections are the most useful thing you can send us. Tell us what is wrong and we will check it against the awarding body’s own page.'
              : 'Questions, corrections and feedback all reach the same editorial team. If you are asking about your own application, the awarding body is usually the only party that can answer.'}
          </p>

          <div className="mt-10">
            {recordTitle ? (
              <ReportForm
                target={kind}
                slug={slug}
                recordTitle={recordTitle}
              />
            ) : (
              <ContactForm defaultSubject={subject} />
            )}
          </div>

          <nav
            aria-label="Other ways to get help"
            className="mt-12 border-t border-ink-200 pt-8"
          >
            <h2 className="text-sm font-semibold text-ink-900">
              Before you write
            </h2>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link
                  href="/help"
                  className="text-brand-700 underline underline-offset-4 hover:text-brand-800"
                >
                  The Help page
                </Link>{' '}
                answers how to search and read a record.
              </li>
              <li>
                <Link
                  href="/editorial-standards"
                  className="text-brand-700 underline underline-offset-4 hover:text-brand-800"
                >
                  Our editorial standards
                </Link>{' '}
                explain how records are sourced and corrected.
              </li>
              <li>
                <Link
                  href="/scholarships"
                  className="text-brand-700 underline underline-offset-4 hover:text-brand-800"
                >
                  Search scholarships
                </Link>{' '}
                is usually the fastest route to what you need.
              </li>
            </ul>
          </nav>
        </div>
      </Container>
    </Section>
  )
}