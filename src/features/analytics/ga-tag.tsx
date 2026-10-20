'use client'

import Script from 'next/script'
import { useEffect, useState } from 'react'

import { storedConsentAllowsAnalytics } from './consent'

/**
 * Consent-gated Google Analytics (gtag.js).
 *
 * The tag is OFF until consent allows it:
 *
 *  - when `requireConsent` is true (the `privacy.require_consent` setting),
 *    the tag stays unmounted until the visitor's stored consent records
 *    `analytics: true`. A decision made later in the same visit is picked up
 *    through the banner's `getscholarship:consent-changed` event, so accepting
 *    mid-page loads the tag without a reload.
 *  - when `requireConsent` is false, the tag loads after hydration like any
 *    other `afterInteractive` script.
 *
 * Once consent is granted the tag remains loaded for the rest of the session —
 * revoking the consent in the banner takes effect on the next visit rather than
 * retroactively resetting the measurement ID in memory.
 *
 * The measurement ID is not a secret (it ships in every page's HTML), so it is
 * safe to pass to a Client Component. Being a `NEXT_PUBLIC_` variable it is
 * also inlined at build time, meaning changing it requires a rebuild.
 */
export function GaTag({
  measurementId,
  requireConsent,
}: {
  measurementId: string
  requireConsent: boolean
}) {
  // The server render and the first client render must agree, and neither knows
  // the visitor's stored consent — so the only non-shifted initial state is
  // "off", corrected to "on" by the effect below once storage is readable.
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    let active = true

    const evaluate = () => {
      if (!active) return
      if (
        !requireConsent ||
        storedConsentAllowsAnalytics(
          window.localStorage.getItem('getscholarship-consent'),
        )
      ) {
        setAllowed(true)
      }
    }

    evaluate()

    if (!requireConsent) return () => { active = false }

    window.addEventListener('getscholarship:consent-changed', evaluate)
    return () => {
      active = false
      window.removeEventListener('getscholarship:consent-changed', evaluate)
    }
  }, [requireConsent])

  if (!allowed) return null

  return (
    <>
      {/*
        The standard gtag.js bootstrap. It runs inline, defines `dataLayer` and
        queues the `config` command; the loader below then picks up the queue
        whenever it arrives, so the order between the two is not load-bearing.
      */}
      <Script id="ga-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${measurementId}');`}
      </Script>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`}
        strategy="afterInteractive"
      />
    </>
  )
}
