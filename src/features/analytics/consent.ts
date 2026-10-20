/** The preference bag the consent banner stores in `localStorage`. */
type ConsentPreferences = { analytics?: boolean; ads?: boolean; functionality?: boolean }

/**
 * Read the consent decision a visitor has stored in the browser and decide
 * whether it allows the analytics tag.
 *
/**
 * The consent banner persists its decision to `localStorage` BEFORE dispatching
 * `getscholarship:consent-changed` (see `consent-manager.tsx`), so reading
 * storage is always safe — including from the change listener itself.
 *
 * Any unreadable or missing storage means NO consent: the tag must stay off.
 */
export function storedConsentAllowsAnalytics(
  stored: string | null,
): boolean {
  if (!stored) return false

  let parsed: unknown
  try {
    parsed = JSON.parse(stored) as unknown
  } catch {
    return false
  }

  if (typeof parsed !== 'object' || parsed === null) return false

  // Read only the one flag the analytics tag cares about, never trusting the
  // object's shape beyond that.
  const analytics = (parsed as Partial<ConsentPreferences>).analytics
  return analytics === true
}
