import { NotFoundContent } from '@/components/layout/not-found-content'

/**
 * 404 for `notFound()` calls inside the public route group. Unmatched URLs are
 * handled by the root `app/not-found.tsx`, which also renders the site chrome.
 */
export default function NotFound() {
  return <NotFoundContent />
}
