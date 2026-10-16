import type { LucideIcon } from 'lucide-react'
import {
  FileText,
  GraduationCap,
  Home,
  Images,
  LayoutDashboard,
  ListOrdered,
  Mail,
  ScrollText,
  Settings,
  Tags,
  TriangleAlert,
  Users,
} from 'lucide-react'

import type { Permission } from '@/lib/auth/permissions'

/**
 * Administration navigation.
 *
 * IMPORTANT — no dead links.
 *
 * Every entry here must correspond to a route that actually exists. Rendering
 * a sidebar item for an unbuilt screen produces a 404 on click, which reads as
 * a broken product rather than an honest "not yet". Entries are therefore added
 * in the same change that adds their route, and `adminNavigation()` filters by
 * BOTH the viewer's permissions and whether the section is built.
 *
 * This is presentation only. Hiding a link is a usability measure and is never
 * the enforcement boundary — every route and mutation is authorised
 * server-side and by RLS.
 */

export type AdminNavItem = {
  href: string
  label: string
  icon: LucideIcon
  /** Any one of these permissions grants access. */
  permissions: readonly Permission[]
  /** Exact match only, or a prefix match for nested sections. */
  match: 'exact' | 'prefix'
}

/**
 * Sections that are implemented. Everything else is deliberately absent until
 * its route lands.
 */
export const ADMIN_NAV: readonly AdminNavItem[] = [
  {
    href: '/admin',
    label: 'Dashboard',
    icon: LayoutDashboard,
    // Any administrative role may see the dashboard; it shows only what that
    // role is permitted to see, and the queries are RLS-scoped regardless.
    permissions: [
      'scholarship.manage',
      'article.manage',
      'article.create',
      'taxonomy.manage',
      'media.upload',
      'media.manage',
      'user.manage',
      'role.manage',
      'settings.manage',
      'navigation.manage',
      'homepage.manage',
      'newsletter.manage',
      'contact.manage',
      'report.manage',
      'ads.manage',
      'seo.manage',
      'audit.view',
    ],
    match: 'exact',
  },
]

/**
 * Sections that are planned but not yet built.
 *
 * Kept here as documentation of the intended shape, and deliberately NOT
 * merged into `ADMIN_NAV`. Flipping an entry across is a deliberate act that
 * should happen with the route, not before it.
 */
export const ADMIN_NAV_PLANNED = [
  { href: '/admin/scholarships', label: 'Scholarships', icon: GraduationCap },
  { href: '/admin/articles', label: 'Articles', icon: FileText },
  { href: '/admin/taxonomy', label: 'Categories & fields', icon: ListOrdered },
  { href: '/admin/tags', label: 'Tags', icon: Tags },
  { href: '/admin/media', label: 'Media library', icon: Images },
  { href: '/admin/homepage', label: 'Homepage', icon: Home },
  { href: '/admin/newsletter', label: 'Newsletter', icon: Mail },
  { href: '/admin/reports', label: 'Reported issues', icon: TriangleAlert },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/audit', label: 'Audit log', icon: ScrollText },
  { href: '/admin/settings', label: 'Site settings', icon: Settings },
] as const satisfies readonly { href: string; label: string; icon: LucideIcon }[]

/** Build the navigation for a viewer holding `permissions`. */
export function adminNavigation(
  permissions: readonly Permission[],
): AdminNavItem[] {
  return ADMIN_NAV.filter((item) =>
    item.permissions.some((p) => permissions.includes(p)),
  )
}

/** True when `href` should be rendered as the current page. */
export function isActiveNavItem(
  item: AdminNavItem,
  pathname: string,
): boolean {
  return item.match === 'exact'
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(`${item.href}/`)
}