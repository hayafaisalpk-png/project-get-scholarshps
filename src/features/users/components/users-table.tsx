'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { deleteUserAction, resetPasswordAction, assignRoleAction, revokeRoleAction } from '@/features/users/actions'
import type { RoleRow, UserRow } from '@/features/users/queries'

export function UsersTable({ users, roles }: { users: UserRow[]; roles: RoleRow[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [resetLink, setResetLink] = useState<string | null>(null)

  function onDelete(userId: string) {
    setMessage(null)
    setError(null)
    setResetLink(null)
    if (!window.confirm('Delete this user account? This cannot be undone.')) {
      return
    }
    startTransition(async () => {
      const result = await deleteUserAction(userId)
      if (result.ok) {
        setMessage(result.message)
        router.refresh()
      } else {
        setError(result.message)
      }
    })
  }

  function onReset(email: string) {
    setMessage(null)
    setError(null)
    setResetLink(null)
    startTransition(async () => {
      const result = await resetPasswordAction(email)
      if (result.ok) {
        setMessage(result.message)
        if (result.link) setResetLink(result.link)
      } else {
        setError(result.message)
      }
    })
  }

  function onAssign(userId: string, roleKey: string) {
    setMessage(null)
    setError(null)
    startTransition(async () => {
      const result = await assignRoleAction(userId, roleKey)
      if (result.ok) {
        setMessage(result.message)
        router.refresh()
      } else {
        setError(result.message)
      }
    })
  }

  function onRevoke(userId: string, roleKey: string) {
    setMessage(null)
    setError(null)
    startTransition(async () => {
      const result = await revokeRoleAction(userId, roleKey)
      if (result.ok) {
        setMessage(result.message)
        router.refresh()
      } else {
        setError(result.message)
      }
    })
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-sm border border-ink-200 bg-white">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">User accounts</caption>
          <thead className="border-b border-ink-200 bg-ink-50 text-xs tracking-wide text-ink-600 uppercase">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">
                Email
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Name
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Roles
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Status
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Created
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {users.map((user) => (
              <tr key={user.id}>
                <td className="px-4 py-3 font-medium text-ink-900">
                  {user.email ?? '—'}
                </td>
                <td className="px-4 py-3 text-ink-700">
                  {user.fullName ?? '—'}
                </td>
                <td className="px-4 py-3 text-ink-700">
                  {user.roles.join(', ') || '—'}
                </td>
                <td className="px-4 py-3 text-ink-700">{user.status ?? '—'}</td>
                <td className="px-4 py-3 whitespace-nowrap text-ink-600">
                  {user.createdAt
                    ? new Date(user.createdAt).toLocaleDateString()
                    : '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-1">
                      {user.roles.map((role) => (
                        <button
                          key={role}
                          type="button"
                          onClick={() => onRevoke(user.id, role)}
                          disabled={pending}
                          className="inline-flex items-center gap-1 rounded-sm bg-ink-100 px-2 py-0.5 text-xs font-medium text-ink-700 hover:bg-red-50 hover:text-red-700 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none disabled:opacity-60"
                          title="Revoke role"
                        >
                          {role} ×
                        </button>
                      ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <select
                        value=""
                        onChange={(e) => {
                          if (e.target.value) onAssign(user.id, e.target.value)
                        }}
                        disabled={pending}
                        className="rounded-sm border border-ink-300 bg-white px-2 py-1 text-xs text-ink-700 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none disabled:opacity-60"
                      >
                        <option value="">Assign role…</option>
                        {roles
                          .filter((r) => !user.roles.includes(r.key))
                          .map((r) => (
                            <option key={r.key} value={r.key}>
                              {r.name}
                            </option>
                          ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => onReset(user.email ?? '')}
                        disabled={pending || !user.email}
                        className="rounded-sm bg-navy px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-navy/90 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none disabled:opacity-60"
                      >
                        Reset password
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(user.id)}
                        disabled={pending}
                        className="rounded-sm bg-red-700 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-800 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none disabled:opacity-60"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-6 text-center text-sm text-ink-600"
                >
                  No user accounts.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {message ? (
        <p role="status" aria-live="polite" className="text-xs text-ink-500">
          {message}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      ) : null}
      {resetLink ? (
        <p className="break-all rounded-sm border border-ink-200 bg-ink-50 px-3 py-2 text-xs text-ink-700">
          Reset link: {resetLink}
        </p>
      ) : null}
    </div>
  )
}