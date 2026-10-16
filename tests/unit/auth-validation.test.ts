import { describe, expect, it } from 'vitest'

import {
  confirmPasswordSchema,
  emailSchema,
  forgotPasswordSchema,
  loginSchema,
  passwordSchema,
  resetPasswordSchema,
  safeReturnPath,
} from '@/lib/validation/auth'

/**
 * Authentication validation.
 *
 * The `safeReturnPath` cases are the important ones: that function is the
 * open-redirect defence, and an open redirect on a sign-in page is a
 * credential-phishing primitive — an administrator types their password and is
 * handed straight to an attacker's site.
 */

describe('safeReturnPath', () => {
  it('allows ordinary internal paths', () => {
    expect(safeReturnPath('/admin')).toBe('/admin')
    expect(safeReturnPath('/admin/scholarships?page=2')).toBe(
      '/admin/scholarships?page=2',
    )
    expect(safeReturnPath('/admin#section')).toBe('/admin#section')
  })

  it('rejects absolute URLs to another origin', () => {
    expect(safeReturnPath('https://evil.example/steal')).toBe('/admin')
    expect(safeReturnPath('http://evil.example')).toBe('/admin')
  })

  it('rejects protocol-relative URLs', () => {
    // "//evil.example" is resolved by the browser as a host, not a path.
    expect(safeReturnPath('//evil.example')).toBe('/admin')
    expect(safeReturnPath('//evil.example/steal')).toBe('/admin')
  })

  it('rejects backslash variants browsers normalise to slashes', () => {
    expect(safeReturnPath('/\\evil.example')).toBe('/admin')
    expect(safeReturnPath('/admin\\..\\evil')).toBe('/admin')
  })

  it('rejects anything containing a backslash', () => {
    expect(safeReturnPath('/admin\\evil')).toBe('/admin')
  })

  it('rejects relative paths that are not rooted', () => {
    expect(safeReturnPath('admin')).toBe('/admin')
    expect(safeReturnPath('javascript:alert(1)')).toBe('/admin')
    expect(safeReturnPath('data:text/html,<script>alert(1)</script>')).toBe(
      '/admin',
    )
  })

  it('rejects control characters and whitespace used for smuggling', () => {
    expect(safeReturnPath('/admin\nSet-Cookie: a=b')).toBe('/admin')
    expect(safeReturnPath('/admin\tx')).toBe('/admin')
    expect(safeReturnPath('/admin\r\nLocation: https://evil.example')).toBe(
      '/admin',
    )
  })

  it('falls back for non-strings and empty values', () => {
    expect(safeReturnPath(undefined)).toBe('/admin')
    expect(safeReturnPath(null)).toBe('/admin')
    expect(safeReturnPath(42)).toBe('/admin')
    expect(safeReturnPath({})).toBe('/admin')
    expect(safeReturnPath('')).toBe('/admin')
    expect(safeReturnPath('   ')).toBe('/admin')
  })

  it('honours a custom fallback', () => {
    expect(safeReturnPath('https://evil.example', '/auth/login')).toBe(
      '/auth/login',
    )
  })

  it('rejects absurdly long values', () => {
    expect(safeReturnPath(`/${'a'.repeat(4096)}`)).toBe('/admin')
  })

  it('trims surrounding whitespace before validating', () => {
    expect(safeReturnPath('  /admin  ')).toBe('/admin')
  })
})

describe('emailSchema', () => {
  it('accepts ordinary addresses and trims whitespace', () => {
    expect(emailSchema.parse('  admin@example.com  ')).toBe(
      'admin@example.com',
    )
  })

  it('rejects empty and malformed addresses', () => {
    expect(emailSchema.safeParse('').success).toBe(false)
    expect(emailSchema.safeParse('not-an-email').success).toBe(false)
    expect(emailSchema.safeParse('@example.com').success).toBe(false)
  })

  it('rejects an over-long address', () => {
    expect(emailSchema.safeParse(`${'a'.repeat(400)}@example.com`).success).toBe(
      false,
    )
  })
})

describe('passwordSchema', () => {
  it('accepts a long passphrase', () => {
    expect(passwordSchema.safeParse('correct horse battery').success).toBe(true)
  })

  it('rejects anything shorter than twelve characters', () => {
    expect(passwordSchema.safeParse('a'.repeat(11)).success).toBe(false)
  })
})

describe('loginSchema', () => {
  it('requires an email and a non-empty password', () => {
    const result = loginSchema.safeParse({
      email: 'admin@example.com',
      password: '',
    })
    expect(result.success).toBe(false)
  })
})

describe('forgotPasswordSchema', () => {
  it('requires only an email', () => {
    expect(
      forgotPasswordSchema.safeParse({ email: 'admin@example.com' }).success,
    ).toBe(true)
  })
})

describe('resetPasswordSchema', () => {
  it('accepts a matching pair', () => {
    const result = resetPasswordSchema.safeParse({
      password: 'a-long-enough-passphrase',
      confirmPassword: 'a-long-enough-passphrase',
    })
    expect(result.success).toBe(true)
  })

  it('rejects a mismatch', () => {
    const result = resetPasswordSchema.safeParse({
      password: 'a-long-enough-passphrase',
      confirmPassword: 'a-different-passphrase',
    })
    expect(result.success).toBe(false)
  })

  it('rejects a short password', () => {
    const result = resetPasswordSchema.safeParse({
      password: 'short',
      confirmPassword: 'short',
    })
    expect(result.success).toBe(false)
  })
})

describe('confirmPasswordSchema', () => {
  it('is exported for reuse by profile forms', () => {
    expect(confirmPasswordSchema.safeParse('anything').success).toBe(true)
  })
})