import 'server-only'

import { cache } from 'react'

import { createClient } from '@/lib/supabase/server'

export type UserRow = {
  id: string
  email: string | null
  fullName: string | null
  roles: string[]
  status: string | null
  createdAt: string | null
}

/** List all user accounts visible to this viewer (RLS applies). */
export type RoleRow = { id: string; key: string; name: string }

export const listRoles = cache(async (): Promise<RoleRow[]> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('roles')
    .select('id, key, name')
    .order('name', { ascending: true })

  if (error || !data) return []
  return data.map((r) => ({ id: r.id, key: r.key, name: r.name }))
})

export const listUsers = cache(async (): Promise<UserRow[]> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('user_role_summary')
    .select('user_id, email, full_name, roles, status, created_at')
    .order('created_at', { ascending: false })

  if (error || !data) return []

  return data
    .filter((row) => row.user_id !== null)
    .map((row) => ({
      id: row.user_id as string,
      email: row.email,
      fullName: row.full_name,
      roles: row.roles ?? [],
      status: row.status,
      createdAt: row.created_at,
    }))
})