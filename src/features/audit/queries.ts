import 'server-only'

import { cache } from 'react'

import { createClient } from '@/lib/supabase/server'

export type AuditEntry = {
  id: number
  action: string
  entityType: string
  entityId: string | null
  actorEmail: string | null
  createdAt: string
}

export const listAuditLog = cache(
  async (page: number = 1): Promise<{ items: AuditEntry[]; total: number; page: number; totalPages: number }> => {
    const supabase = await createClient()
    const pageSize = 25
    const from = (page - 1) * pageSize
    const { data, error, count } = await supabase
      .from('audit_logs')
      .select('id, action, entity_type, entity_id, actor_email, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1)

    if (error || !data) {
      return { items: [], total: 0, page, totalPages: 1 }
    }

    return {
      items: data.map((row) => ({
        id: row.id,
        action: row.action,
        entityType: row.entity_type,
        entityId: row.entity_id,
        actorEmail: row.actor_email,
        createdAt: row.created_at,
      })),
      total: count ?? 0,
      page,
      totalPages: Math.max(1, Math.ceil((count ?? 0) / pageSize)),
    }
  },
)