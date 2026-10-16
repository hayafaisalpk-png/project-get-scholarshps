import { Award, BookOpen, GraduationCap, MapPin, Search } from 'lucide-react'
import Link from 'next/link'

import { Container, Section, SectionHeading } from '@/components/layout/container'
import { ButtonLink } from '@/components/ui/button'
import { ScholarshipCard } from '@/features/scholarships/components/scholarship-card'
import {
  getClosingSoonScholarships,
  getFeaturedScholarships,
  getRecentScholarships,
} from '@/features/scholarships/queries'
import { getHomepageSections } from '@/lib/homepage'
import {
  getAcademicFields,
  getEducationLevels,
  getLocations,
  getScholarshipCategories,
  getSiteStats,
} from '@/lib/taxonomy'

/**
 * Homepage.
 *
 * Assembled from `homepage_sections`, so editors control which blocks appear,
 * their order, headings and item limits without a redeploy.
 *
 * Two rules hold throughout:
 *
 *   1. Every number is a real aggregate from the database.
 *   2. A block with no content is omitted rather than rendered as an empty
 *      shell, because an empty "Featured Scholarships" heading teaches a visitor
 *      nothing. The genuine "nothing here yet" case is handled once, in the
 *      hero, with an explanation.
 */

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const sections = await getHomepageSections()
  const byKey = new Map(sections.map((s) => [s.key, s]))

  const [
    stats,
    featured,
    closingSoon,
    recent,
    levels,
    fields,
    locations,
    categories,
  ] = await Promise.all([
    getSiteStats(),
    getFeaturedScholarships(byKey.get('featured')?.config.limit ?? 6),
    getClosingSoonScholarships(byKey.get('deadlines')?.config.limit ?? 6),
    getRecentScholarships(byKey.get('recent')?.config.limit ?? 8),
    getEducationLevels(),
    getAcademicFields(),
    getLocations(),
    getScholarshipCategories(),
  ])

  const hero = byKey.get('hero')
  const isEmpty = stats.totalScholarships === 0

  return (
    <>
      {/* ---------------------------------------------------------------- Hero */}
      <Section className="bg-gradient-to-b from-brand-50 to-background pt-14 sm:pt-20">
        <Container>
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-3xl font-bold tracking-tight text-ink-900 sm:text-5xl">
              {hero?.heading ?? 'Find scholarships that actually fit you'}
            </h1>

            {hero?.subheading ? (
              <p className="mx-auto mt-4 max-w-2xl text-lg text-ink-600">
                {hero.subheading}
              </p>
            ) : null}

            <form action="/scholarships" method="get" className="mt-8">
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                  <label htmlFor="hero-search" className="sr-only-focusable">
                    Search scholarships by keyword or sponsor
                  </label>
                  <Search
                    className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-400"
                    aria-hidden="true"
                  />
                  <input
                    id="hero-search"
                    type="search"
                    name="q"
                    placeholder="Search by keyword, sponsor or subject"
                    className="h-13 w-full rounded-sm border border-ink-300 bg-white pl-12 pr-4 text-base text-ink-900 placeholder:text-ink-400 focus:border-brand-500"
                  />
                </div>
                <ButtonLink href="/scholarships" size="lg" className="shrink-0">
                  Browse all scholarships
                </ButtonLink>
              </div>
            </form>

            {isEmpty ? (
              <div className="mx-auto mt-8 max-w-xl rounded-sm border border-ink-200 bg-white p-5 text-left">
                <h2 className="text-base font-semibold text-ink-900">
                  Our scholarship database is being prepared
                </h2>
                <p className="mt-2 text-sm text-ink-600">
                  We publish a scholarship only after an editor has confirmed the
                  award amount, deadline and official application link with the
                  provider. We would rather show you nothing than show you
                  something wrong. Listings appear here as they are verified.
                </p>
              </div>
            ) : null}
          </div>
        </Container>
      </Section>

      {/* --------------------------------------------------------------- Stats */}
      {stats.totalScholarships > 0 ? (
        <Section className="py-8">
          <Container>
            <dl className="grid grid-cols-2 gap-6 rounded-sm border border-ink-200 bg-white p-6 sm:grid-cols-4">
              <Stat
                icon={<Award className="h-5 w-5" aria-hidden="true" />}
                value={stats.totalScholarships.toLocaleString('en-US')}
                label="Scholarships listed"
              />
              <Stat
                icon={<Search className="h-5 w-5" aria-hidden="true" />}
                value={stats.openScholarships.toLocaleString('en-US')}
                label="Applications still open"
              />
              <Stat
                icon={<GraduationCap className="h-5 w-5" aria-hidden="true" />}
                value={stats.educationLevels.toLocaleString('en-US')}
                label="Education levels"
              />
              <Stat
                icon={<MapPin className="h-5 w-5" aria-hidden="true" />}
                value={stats.locations.toLocaleString('en-US')}
                label="Locations covered"
              />
            </dl>
          </Container>
        </Section>
      ) : null}

      {/* ------------------------------------------------------------ Featured */}
      {featured.length > 0 ? (
        <Section>
          <Container>
            <SectionHeading
              title={byKey.get('featured')?.heading ?? 'Featured Scholarships'}
              description={byKey.get('featured')?.subheading}
              action={
                <Link
                  href="/scholarships"
                  className="text-sm font-semibold text-brand-700 hover:underline underline-offset-4"
                >
                  View all
                </Link>
              }
            />
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((s) => (
                <ScholarshipCard key={s.id} scholarship={s} />
              ))}
            </div>
          </Container>
        </Section>
      ) : null}

      {/* -------------------------------------------------------- Closing soon */}
      {closingSoon.length > 0 ? (
        <Section className="bg-surface">
          <Container>
            <SectionHeading
              title={byKey.get('deadlines')?.heading ?? 'Closing soon'}
              description={byKey.get('deadlines')?.subheading}
            />
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {closingSoon.map((s) => (
                <ScholarshipCard key={s.id} scholarship={s} />
              ))}
            </div>
          </Container>
        </Section>
      ) : null}

      {/* -------------------------------------------------- By education level */}
      {levels.length > 0 ? (
        <Section>
          <Container>
            <SectionHeading
              title={byKey.get('by-level')?.heading ?? 'Scholarships by education level'}
              description={byKey.get('by-level')?.subheading}
            />
            <TaxonomyGrid
              items={levels.slice(0, 8).map((l) => ({
                name: l.name,
                href: `/scholarships/education-level/${l.slug}`,
                description: l.description,
              }))}
            />
          </Container>
        </Section>
      ) : null}

      {/* ------------------------------------------------------- By study field */}
      {fields.length > 0 ? (
        <Section className="bg-surface">
          <Container>
            <SectionHeading
              title={byKey.get('by-field')?.heading ?? 'Scholarships by field of study'}
              description={byKey.get('by-field')?.subheading}
            />
            <TaxonomyGrid
              items={fields.slice(0, 8).map((f) => ({
                name: f.name,
                href: `/scholarships/field/${f.slug}`,
                description: f.description,
              }))}
            />
          </Container>
        </Section>
      ) : null}

      {/* ----------------------------------------------------- By scholarship type */}
      {categories.length > 0 ? (
        <Section>
          <Container>
            <SectionHeading
              title={byKey.get('by-category')?.heading ?? 'Types of scholarships'}
              description={byKey.get('by-category')?.subheading}
            />
            <TaxonomyGrid
              items={categories.map((c) => ({
                name: c.name,
                href: `/scholarships/category/${c.slug}`,
                description: c.description,
              }))}
            />
          </Container>
        </Section>
      ) : null}

      {/* ----------------------------------------------------------- By location */}
      {locations.length > 0 ? (
        <Section className="bg-surface">
          <Container>
            <SectionHeading
              title={byKey.get('by-location')?.heading ?? 'Scholarships by location'}
              description={byKey.get('by-location')?.subheading}
            />
            <TaxonomyGrid
              items={locations.slice(0, 8).map((l) => ({
                name: l.name,
                href: `/scholarships/location/${l.slug}`,
                description: null,
              }))}
            />
          </Container>
        </Section>
      ) : null}

      {/* --------------------------------------------------------- Recently added */}
      {recent.length > 0 ? (
        <Section>
          <Container>
            <SectionHeading
              title={byKey.get('recent')?.heading ?? 'Recently added'}
              description={byKey.get('recent')?.subheading}
            />
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {recent.map((s) => (
                <ScholarshipCard key={s.id} scholarship={s} />
              ))}
            </div>
          </Container>
        </Section>
      ) : null}

      {/* ------------------------------------------------------------------- FAQ */}
      <FaqSection />

      {/* -------------------------------------------------------------- Editorial */}
      <Section className="bg-surface">
        <Container>
          <div className="mx-auto max-w-3xl rounded-sm border border-ink-200 bg-white p-8">
            <div className="flex items-start gap-4">
              <span
                aria-hidden="true"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-sm bg-brand-50 text-brand-700"
              >
                <BookOpen className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-xl font-bold text-ink-900">
                  How we verify scholarships
                </h2>
                <p className="mt-2 text-ink-600">
                  Every listing records the official source we checked, the date
                  it was last reviewed, and its verification status. We never
                  publish a scholarship without a confirmed application link, and
                  we never copy a provider&apos;s description in place of our own
                  summary.
                </p>
                <Link
                  href="/editorial-standards"
                  className="mt-4 inline-block text-sm font-semibold text-brand-700 hover:underline underline-offset-4"
                >
                  Read our editorial standards
                </Link>
              </div>
            </div>
          </div>
        </Container>
      </Section>
    </>
  )
}

function Stat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode
  value: string
  label: string
}) {
  return (
    <div className="text-center">
      <span
        aria-hidden="true"
        className="mx-auto mb-2 inline-flex h-10 w-10 items-center justify-center rounded-sm bg-brand-50 text-brand-700"
      >
        {icon}
      </span>
      <dd className="text-2xl font-bold text-ink-900">{value}</dd>
      <dt className="mt-1 text-sm text-ink-600">{label}</dt>
    </div>
  )
}

function TaxonomyGrid({
  items,
}: {
  items: { name: string; href: string; description: string | null }[]
}) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <li key={item.href}>
          <Link
            href={item.href}
            className="flex h-full flex-col rounded-sm border border-ink-200 bg-white p-5 transition-colors hover:border-brand-300 hover:bg-brand-50/40"
          >
            <span className="font-semibold text-ink-900">{item.name}</span>
            {item.description ? (
              <span className="mt-1 line-clamp-2 text-sm text-ink-600">
                {item.description}
              </span>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  )
}

/**
 * Frequently asked questions.
 *
 * Wrapped in `<details>` elements, which are keyboard operable and work without
 * JavaScript — a better choice here than a custom accordion that needs state.
 */
function FaqSection() {
  const faqs = [
    {
      q: 'Are the scholarships on this site real?',
      a: 'Yes. Each listing is entered by an editor who has checked the award amount, deadline and application link against the official provider page. The source we checked and the date we last reviewed it are shown on every scholarship page.',
    },
    {
      q: 'Does GetScholarship charge a fee to apply?',
      a: 'We never charge to search or to apply. Where a scholarship has its own application fee, that is stated on the listing so you are not surprised.',
    },
    {
      q: 'Why is a scholarship marked as closed?',
      a: 'Its deadline has passed. We keep the page so the information stays available, and so we can point you to similar opportunities that are still open.',
    },
    {
      q: 'How often is the information checked?',
      a: 'Scholarships nearing their deadline are reviewed first. The date each listing was last reviewed appears on its page, and you can report anything that looks wrong.',
    },
  ]

  return (
    <Section>
      <Container>
        <div className="mx-auto max-w-3xl">
          <SectionHeading
            title="Frequently asked questions"
            description="Common questions from students."
          />

          <div className="divide-y divide-ink-200 rounded-sm border border-ink-200 bg-white">
            {faqs.map((faq) => (
              <details key={faq.q} className="group px-5 py-4">
                <summary className="cursor-pointer list-none font-semibold text-ink-900 marker:hidden">
                  <span className="flex items-start justify-between gap-4">
                    {faq.q}
                    <span
                      aria-hidden="true"
                      className="mt-0.5 shrink-0 text-ink-400 transition-transform group-open:rotate-45"
                    >
                      +
                    </span>
                  </span>
                </summary>
                <p className="mt-3 text-sm text-ink-600">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </Container>
    </Section>
  )
}
