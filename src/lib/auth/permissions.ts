/**
 * Role and permission keys.
 *
 * These unions mirror the values seeded in `supabase/seed.sql`. They are the
 * single set of values the application will recognise, so a typo is a compile
 * error rather than a silently-denied permission.
 *
 * If you add a permission to `seed.sql`, add it here in the same commit.
 */

/** Roles defined in `roles.is_system = true`. */
export const APP_ROLES = [
  'super_admin',
  'admin',
  'editor',
  'author',
  'reviewer',
  'student',
] as const

export type AppRole = (typeof APP_ROLES)[number]

export function isAppRole(value: string): value is AppRole {
  return (APP_ROLES as readonly string[]).includes(value)
}

export const PERMISSIONS = [
  // Scholarships
  'scholarship.manage',
  'scholarship.publish',
  'scholarship.delete',
  'scholarship.verify',
  // Articles
  'article.create',
  'article.edit_own',
  'article.manage',
  'article.publish',
  'article.delete',
  'article.review',
  // Taxonomy
  'taxonomy.manage',
  // Media
  'media.upload',
  'media.manage',
  // Users
  'user.manage',
  'role.manage',
  // Settings
  'settings.manage',
  'navigation.manage',
  'homepage.manage',
  // Inbox
  'newsletter.manage',
  'contact.manage',
  'report.manage',
  // Ads and SEO
  'ads.manage',
  'seo.manage',
  // Audit
  'audit.view',
] as const

export type Permission = (typeof PERMISSIONS)[number]

export function isPermission(value: string): value is Permission {
  return (PERMISSIONS as readonly string[]).includes(value)
}

/** Roles with any administrative capability. Students are never included. */
export const CMS_ROLES: readonly AppRole[] = [
  'super_admin',
  'admin',
  'editor',
  'author',
  'reviewer',
]

export function isCmsRole(role: AppRole): boolean {
  return CMS_ROLES.includes(role)
}

/** Roles permitted to publish content. */
export const PUBLISHING_ROLES: readonly AppRole[] = [
  'super_admin',
  'admin',
  'editor',
]

export function canPublishByRole(role: AppRole): boolean {
  return PUBLISHING_ROLES.includes(role)
}
