import { NewsletterForm } from '@/features/newsletter/components/newsletter-form'
import { getBoolean, getString } from '@/lib/settings'

/**
 * Newsletter signup block.
 *
 * Rendered in the footer, so it is present on every page — which is also why it
 * is GATED ON A DATABASE SETTING rather than being hardcoded.
 *
 * `newsletter.enabled` is seeded `false`, and that default is deliberate. No mail
 * provider is configured (`SMTP_HOST` and the rest are empty), so nothing can be
 * sent: not a confirmation, not a welcome, not an announcement. Publishing a
 * signup form by default would collect real people's addresses against a promise
 * that cannot be kept, which `AGENTS.md` §2.5 treats as a fake feature.
 *
 * So the capability is built and shipped, and switched off until an operator has
 * both a mail provider and something worth sending. Turning it on is one setting
 * change in the CMS.
 *
 * Reading the setting costs no extra round trip: `getPublicSettings()` is
 * memoised per request, and the footer already calls it.
 */
export async function NewsletterBlock() {
  const [enabled, heading] = await Promise.all([
    getBoolean('newsletter.enabled', false),
    getString(
      'newsletter.heading',
      'Stay updated on new scholarships',
    ),
  ])

  if (!enabled) return null

  return (
    <div className="border-t border-ink-200 py-10">
      <h2 className="eyebrow">{heading}</h2>

      <p className="mt-3 max-w-sm text-sm text-ink-600">
        Be told when new scholarships and guides are published.
      </p>

      <div className="mt-4 max-w-sm">
        <NewsletterForm />
      </div>

      {/*
        Stated outright, because a signup form in a live site implies that
        something will arrive. It will not, yet. The same fact is repeated in the
        action's success message so the visitor meets it twice rather than once.
      */}
      <p className="mt-3 max-w-sm text-xs text-ink-500">
        We are not sending email at the moment. Signing up records your address
        so we can reach you when we start, and nothing else.{' '}
        <a href="/privacy" className="underline underline-offset-2 hover:text-brand-700">
          How we handle your data
        </a>
        .
      </p>
    </div>
  )
}