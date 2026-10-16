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
 * in the same change that adds their route.
 *
 * Icons are referenced by KEY rather than by component. The filtered result is
 * passed from a Server Component to a Client Component, and a React component
 * is not a serialisable prop. Keying them keeps the handoff plain data.
 *
 * This is presentation only. Hiding a link is a usability measure and is never
 * the enforcement boundary — every route and mutation is authorised
 * server-side and by RLS.
 */

export type AdminIconKey =
  | 'dashboard'
  | 'scholarships'
  | 'articles'
  | 'taxonomy'
  | 'tags'
  | 'media'
  | 'homepage'
  | 'newsletter'
  | 'reports'
  | 'users'
  | 'audit'
  | 'settings'

/** Key → icon. Resolved on the client, where the nav is rendered. */
export const ADMIN_ICONS: Record<AdminIconKey, LucideIcon> = {
  dashboard: LayoutDashboard,
  scholarships: GraduationCap,
  articles: FileText,
  taxonomy: ListOrdered,
  tags: Tags,
  media: Images,
  homepage: Home,
  newsletter: Mail,
  reports: TriangleAlert,
  users: Users,
  audit: ScrollText,
  settings: Settings,
}

export type AdminNavItem = {
  href: string
  label: string
  icon: AdminIconKey
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
    icon: 'dashboard',
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
  {
    href: '/admin/scholarships',
    label: 'Scholarships',
    icon: 'scholarships',
    permissions: ['scholarship.manage'],
    match: 'prefix',
  },
  {
    href: '/admin/articles',
    label: 'Articles',
    icon: 'articles',
    permissions: ['article.manage', 'article.create', 'article.edit_own'],
    match: 'prefix',
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
  { href: '/admin/taxonomy', label: 'Categories & fields', icon: 'taxonomy' },
  { href: '/admin/tags', label: 'Tags', icon: 'tags' },
  { href: '/admin/media', label: 'Media library', icon: 'media' },
  { href: '/admin/homepage', label: 'Homepage', icon: 'homepage' },
  { href: '/admin/newsletter', label: 'Newsletter', icon: 'newsletter' },
  { href: '/admin/reports', label: 'Reported issues', icon: 'reports' },
  { href: '/admin/users', label: 'Users', icon: 'users' },
  { href: '/admin/audit', label: 'Audit log', icon: 'audit' },
  { href: '/admin/settings', label: 'Site settings', icon: 'settings' },
] as const satisfies readonly { href: string; label: string; icon: AdminIconKey }[]

/** The nav for a viewer holding `permissions`, as plain serialisable data. */
export function adminNavigation(
  permissions: readonly Permission[],
): AdminNavItem[] {
  return ADMIN_NAV.filter((item) =>
    item.permissions.some((p) => permissions.includes(p)),
  )
}

/** True when `href` is the current page (or an ancestor of it). */
export function isActiveNavItem(
  item: Pick<AdminNavItem, 'href' | 'match'>,
  pathname: string,
): boolean {
  return item.match === 'exact'
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(`${item.href}/`)
}