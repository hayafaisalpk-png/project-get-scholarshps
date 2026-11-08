import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Bulk lifecycle transitions on the scholarship admin list.
 *
 * The draft option is not a dropdown convenience: moving an archived record
 * back to draft must also clear `archived_at`, because the public policies gate
 * on `status = 'published' and archived_at is null`. A status change that left
 * the timestamp behind would show "Draft" in the table while the record stayed
 * archived for every reader.
 *
 * These assertions read the patch actually sent to PostgREST, not the label.
 */

const state = vi.hoisted(() => ({
  rows: [] as Array<{
    id: string
    title: string
    status: string
    application_url: string | null
    verification_status: string
  }>,
  updates: [] as Array<{ id: string; patch: Record<string, unknown> }>,
  audits: [] as Array<{ name: string; args: Record<string, unknown> }>,
  filters: [] as Array<[string, unknown]>,
}))

const revalidatePath = vi.hoisted(() => vi.fn())

vi.mock('next/cache', () => ({ revalidatePath }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('@/lib/auth/guards', () => ({
  requirePermission: async () => ({
    user: { id: 'user-1' },
    permissions: ['scholarship.manage'],
  }),
}))

vi.mock('@/lib/supabase/server', () => {
  function builder(): Record<string, unknown> {
    const b: Record<string, unknown> = {}
    b.eq = (column: string, value: unknown) => {
      state.filters.push([column, value])
      return b
    }
    b.in = async () => ({ data: state.rows, error: null })
    b.or = () => b
    b.order = () => b
    b.range = () => b
    b.limit = () => b
    b.maybeSingle = async () => ({ data: null, error: null })
    b.single = async () => ({ data: null, error: null })
    b.then = (resolve: (value: unknown) => unknown) =>
      resolve({ data: [], error: null, count: 0 })
    return b
  }

  return {
    createClient: async () => ({
      from: (table: string) => {
        if (table !== 'scholarships') {
          throw new Error(`unexpected table ${table}`)
        }
        return {
          select: () => builder(),
          update: (patch: Record<string, unknown>) => ({
            eq: async (_column: string, id: string) => {
              state.updates.push({ id, patch })
              return { error: null }
            },
          }),
        }
      },
      rpc: async (name: string, args: Record<string, unknown>) => {
        state.audits.push({ name, args })
        return { error: null }
      },
    }),
  }
})

import { bulkSetScholarshipStatusAction } from '@/features/scholarships/admin/actions'
import { listAdminScholarships } from '@/features/scholarships/admin/queries'

function draftForm(): FormData {
  const form = new FormData()
  form.append('ids', '11111111-1111-4111-8111-111111111111')
  form.append('ids', '22222222-2222-4222-8222-222222222222')
  form.append('next', 'draft')
  return form
}

beforeEach(() => {
  state.rows = [
    {
      id: '11111111-1111-4111-8111-111111111111',
      title: 'Archived award',
      status: 'archived',
      application_url: 'https://example.test/apply',
      verification_status: 'verified',
    },
    {
      id: '22222222-2222-4222-8222-222222222222',
      title: 'Published award',
      status: 'published',
      application_url: 'https://example.test/apply',
      verification_status: 'verified',
    },
  ]
  state.updates = []
  state.audits = []
  state.filters = []
})

describe('bulk "Mark as draft"', () => {
  it('sets every selected record to draft and clears archived_at', async () => {
    const result = await bulkSetScholarshipStatusAction(null, draftForm())

    expect(result).toEqual({ ok: true, message: '2 scholarship(s) updated.' })
    expect(state.updates).toHaveLength(2)

    for (const { patch } of state.updates) {
      expect(patch.status).toBe('draft')
      expect(patch.archived_at).toBeNull()
      expect(patch.updated_by).toBe('user-1')
    }
  })

  it('records the previous status in the audit log', async () => {
    await bulkSetScholarshipStatusAction(null, draftForm())

    expect(state.audits).toHaveLength(2)
    expect(state.audits.map((entry) => entry.name)).toEqual([
      'write_audit_log',
      'write_audit_log',
    ])
    expect(state.audits.map((entry) => entry.args.p_action)).toEqual([
      'scholarship.bulk_status_change',
      'scholarship.bulk_status_change',
    ])
    expect(state.audits.map((entry) => entry.args.p_before)).toEqual([
      { status: 'archived' },
      { status: 'published' },
    ])
    expect(state.audits.map((entry) => entry.args.p_after)).toEqual([
      { status: 'draft' },
      { status: 'draft' },
    ])
  })

  it('revalidates the admin list so the table re-renders', async () => {
    await bulkSetScholarshipStatusAction(null, draftForm())

    expect(revalidatePath).toHaveBeenCalledWith('/admin/scholarships')
  })

  it('refuses a submission with no selected records before writing anything', async () => {
    const empty = new FormData()
    empty.append('next', 'draft')

    const result = await bulkSetScholarshipStatusAction(null, empty)

    expect(result).toEqual({
      ok: false,
      message: 'Select at least one scholarship and a valid action.',
    })
    expect(state.updates).toHaveLength(0)
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})

describe('admin status filter', () => {
  it('filters the table query to draft records', async () => {
    await listAdminScholarships({ status: 'draft', page: 1 })

    expect(state.filters).toContainEqual(['status', 'draft'])
  })
})
