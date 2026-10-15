import { describe, expect, it } from 'vitest'

import {
  APP_ROLES,
  CMS_ROLES,
  PERMISSIONS,
  PUBLISHING_ROLES,
  canPublishByRole,
  isAppRole,
  isCmsRole,
  isPermission,
} from '@/lib/auth/permissions'

describe('role helpers', () => {
  it('recognises every seeded role', () => {
    for (const role of APP_ROLES) expect(isAppRole(role)).toBe(true)
  })

  it('rejects unknown roles', () => {
    expect(isAppRole('wizard')).toBe(false)
    expect(isAppRole('')).toBe(false)
    expect(isAppRole('ADMIN')).toBe(false) // case sensitive on purpose
  })

  it('never treats a student as a CMS role', () => {
    expect(isCmsRole('student')).toBe(false)
    expect(CMS_ROLES).not.toContain('student')
  })

  it('restricts publishing to editor and above', () => {
    expect(canPublishByRole('super_admin')).toBe(true)
    expect(canPublishByRole('admin')).toBe(true)
    expect(canPublishByRole('editor')).toBe(true)
    expect(canPublishByRole('author')).toBe(false)
    expect(canPublishByRole('reviewer')).toBe(false)
    expect(canPublishByRole('student')).toBe(false)
    expect(PUBLISHING_ROLES).not.toContain('author')
  })
})

describe('permission helpers', () => {
  it('recognises every seeded permission', () => {
    for (const p of PERMISSIONS) expect(isPermission(p)).toBe(true)
  })

  it('rejects unknown permissions', () => {
    expect(isPermission('scholarship.destroy_everything')).toBe(false)
    expect(isPermission('article.manage ')).toBe(false) // trailing space
  })

  it('does not grant publish or delete to authors', () => {
    // This is a design invariant, not a current fact about the database.
    // If an author is ever granted article.manage or article.publish, the RLS
    // policy in migration 012 would allow editing any article, so keep the
    // vocabulary honest about which permissions exist and why.
    expect(PERMISSIONS).toContain('article.edit_own')
    expect(PERMISSIONS).toContain('article.manage')
    expect(PERMISSIONS).not.toContain('article.edit_any')
  })

  it('has no duplicate permission keys', () => {
    expect(new Set(PERMISSIONS).size).toBe(PERMISSIONS.length)
  })

  it('has no duplicate role keys', () => {
    expect(new Set(APP_ROLES).size).toBe(APP_ROLES.length)
  })
})
