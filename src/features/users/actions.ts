'use server'

import { revalidatePath } from 'next/cache'

import { requirePermission } from '@/lib/auth/guards'
import { createAdminClient, hasAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export type UserActionResult =
  | { ok: true; message: string; link?: string }
  | { ok: false; message: string }

/**
 * Delete a user account.
 *
 * Requires `user.manage` and the service-role client. Refuses to delete the
 * signed-in account itself.
 */
export async function deleteUserAction(userId: string): Promise<UserActionResult> {
  await requirePermission('user.manage')

  if (!hasAdminClient()) {
    return {
      ok: false,
      message: 'The service-role key is not configured; deletion is unavailable.',
    }
  }

  const session = await createClient()
  const { data: claimsData } = await session.auth.getClaims()
  const currentUserId = claimsData?.claims?.sub
  if (currentUserId === userId) {
    return { ok: false, message: 'You cannot delete your own account.' }
  }

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) {
    console.error('[users] delete failed:', error.message)
    return { ok: false, message: 'The account could not be deleted. Please try again.' }
  }

  revalidatePath('/admin')
  return { ok: true, message: 'The account was deleted.' }
}

/**
 * Generate a password-reset (recovery) link for a user.
 *
 * No mail provider is configured, so the link is returned to the administrator
 * rather than emailed. Requires `user.manage` and the service-role client.
 */
/**
 * Assign a role to a user.
 */
export async function assignRoleAction(
  userId: string,
  roleKey: string,
): Promise<UserActionResult> {
  await requirePermission('role.manage')

  if (!userId || !roleKey) {
    return { ok: false, message: 'Missing user or role.' }
  }

  const supabase = await createClient()

  const { data: role, error: roleError } = await supabase
    .from('roles')
    .select('id')
    .eq('key', roleKey)
    .maybeSingle()

  if (roleError || !role) {
    return { ok: false, message: 'That role could not be found.' }
  }

  const { error } = await supabase
    .from('user_roles')
    .insert({ user_id: userId, role_id: role.id })

  if (error) {
    // 23505 = already assigned; treat as success-ish
    if (error.code === '23505') {
      revalidatePath('/admin')
      return { ok: true, message: 'Role already assigned.' }
    }
    console.error('[users] assign role failed:', error.message)
    return { ok: false, message: 'The role could not be assigned.' }
  }

  revalidatePath('/admin')
  return { ok: true, message: 'Role assigned.' }
}

/**
 * Revoke a role from a user.
 */
export async function revokeRoleAction(
  userId: string,
  roleKey: string,
): Promise<UserActionResult> {
  await requirePermission('role.manage')

  if (!userId || !roleKey) {
    return { ok: false, message: 'Missing user or role.' }
  }

  const supabase = await createClient()

  const { data: role, error: roleError } = await supabase
    .from('roles')
    .select('id')
    .eq('key', roleKey)
    .maybeSingle()

  if (roleError || !role) {
    return { ok: false, message: 'That role could not be found.' }
  }

  const { error } = await supabase
    .from('user_roles')
    .delete()
    .eq('user_id', userId)
    .eq('role_id', role.id)

  if (error) {
    console.error('[users] revoke role failed:', error.message)
    return { ok: false, message: 'The role could not be revoked.' }
  }

  revalidatePath('/admin')
  return { ok: true, message: 'Role revoked.' }
}

export async function resetPasswordAction(
  email: string,
): Promise<UserActionResult> {
  await requirePermission('user.manage')

  if (!email) {
    return { ok: false, message: 'No email address is recorded for this account.' }
  }

  if (!hasAdminClient()) {
    return {
      ok: false,
      message: 'The service-role key is not configured; reset is unavailable.',
    }
  }

  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email,
  })

  if (error || !data?.properties?.action_link) {
    console.error('[users] reset link failed:', error?.message)
    return {
      ok: false,
      message: 'A reset link could not be generated. Please try again.',
    }
  }

  return {
    ok: true,
    message: 'A reset link was generated. Copy it and send it to the user.',
    link: data.properties.action_link,
  }
}