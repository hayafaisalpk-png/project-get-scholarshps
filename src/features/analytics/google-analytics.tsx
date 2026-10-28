import 'server-only'

import { getPublicEnv, isProduction } from '@/lib/env'
import { getBoolean } from '@/lib/settings'

import { GaTag } from './ga-tag'

/** GA4 measurement IDs look like `G-XXXXXXXXXX`. */
const MEASUREMENT_ID_PATTERN = /^G-[A-Z0-9_-]+$/

/**
 * Google Analytics tag for the public site.
 *
 * Renders nothing — and therefore never requests anything from Google — unless
 * ALL of these hold:
 *
 *  1. a measurement ID is configured in `NEXT_PUBLIC_GA_MEASUREMENT_ID`
 *     (empty means the integration is switched off);
 *  2. the build is a production build, so local development and tests never
 *     appear in the property's reports;
 *  3. the ID matches the GA4 shape, because the ID is interpolated into an
 *     inline script and only a real measurement ID may pass that check.
 *
 * Consent itself is enforced by `GaTag`, using the `privacy.require_consent`
 * setting (which the CMS owns) plus the visitor's own stored choice.
 *
 * Mounted in the `(public)` layout only: the admin CMS sits outside that route
 * group and is deliberately not tracked.
 */
export async function GoogleAnalytics() {
  const measurementId = getPublicEnv().NEXT_PUBLIC_GA_MEASUREMENT_ID
  if (!measurementId) {
    if (isProduction()) {
      console.warn(
        '[analytics] NEXT_PUBLIC_GA_MEASUREMENT_ID is empty; GA4 is disabled in production.',
      )
    }
    return null
  }

  if (!isProduction()) return null

  if (!MEASUREMENT_ID_PATTERN.test(measurementId)) {
    console.error(
      `[analytics] NEXT_PUBLIC_GA_MEASUREMENT_ID="${measurementId}" is not a GA4 ` +
        'measurement ID (expected the G-XXXXXXXXXX shape); the tag is not rendered.',
    )
    return null
  }

  const requireConsent = await getBoolean('privacy.require_consent', true)

  return <GaTag measurementId={measurementId} requireConsent={requireConsent} />
}
