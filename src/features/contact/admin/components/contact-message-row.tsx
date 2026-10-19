'use client'

import { useState, type KeyboardEvent } from 'react'
import { X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { markContactReadAction } from '../actions'

import { formatTimestamp } from '@/lib/format'
import { CONTACT_SUBJECT_LABELS, type ContactSubject } from '@/lib/validation/contact'
import { ContactStatusActions } from './contact-status-actions'
import { CopyEmailButton } from './copy-email-button'
import type { ContactSubmissionRow } from '../queries'

export function ContactMessageRow({ row }: { row: ContactSubmissionRow }) {
  const [open, setOpen] = useState(false)
  const [readAt, setReadAt] = useState(row.read_at)
  const router = useRouter()
  const subject = CONTACT_SUBJECT_LABELS[row.subject as ContactSubject] ?? row.subject

  function handleRowKeyDown(event: KeyboardEvent<HTMLTableRowElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openMessage()
    }
  }

  function openMessage() {
    setOpen(true)
    if (!readAt) {
      void markContactReadAction(row.id).then((result) => {
        if (result.ok) {
          setReadAt(new Date().toISOString())
          router.refresh()
        }
      })
    }
  }

  return (
    <>
      <tr
        className="cursor-pointer align-top transition-colors hover:bg-ink-50"
        onClick={(event) => {
          if ((event.target as HTMLElement).closest('a, button')) return
          openMessage()
        }}
        onKeyDown={handleRowKeyDown}
        tabIndex={0}
        role="button"
        aria-label={`Read message from ${row.name}: ${subject}`}
      >
        <td className="whitespace-nowrap px-4 pt-[15px] pb-[5px] font-normal text-ink-900">
          {row.name}
        </td>
        <td
          className={`max-w-[360px] px-4 pt-[15px] pb-[5px] text-ink-900 ${
            readAt ? 'font-normal' : 'font-semibold'
          }`}
        >
          {subject}
        </td>
        <td className="px-4 pt-[15px] pb-[5px]">
          <div className="flex items-center gap-1">
            <a
              href={`mailto:${row.email}`}
              className="break-all text-brand-700 hover:underline"
            >
              {row.email}
            </a>
            <CopyEmailButton email={row.email} />
          </div>
        </td>
        <td className="whitespace-nowrap px-4 pt-[15px] pb-[5px] text-ink-600">
          <time dateTime={row.created_at}>{formatTimestamp(row.created_at)}</time>
        </td>
        <td className="px-4 pt-[15px] pb-[5px] text-center">
          <ContactStatusActions id={row.id} status={row.status} />
        </td>
      </tr>
      {open ? (
        <tr>
          <td colSpan={5} className="p-0">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby={`message-title-${row.id}`}
              className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/35 p-4 backdrop-blur-sm"
              onClick={(event) => {
                if (event.target === event.currentTarget) setOpen(false)
              }}
            >
              <div className="max-h-[75vh] w-full max-w-3xl overflow-y-auto rounded-sm bg-white p-6 shadow-xl">
                <div className="flex items-start justify-between gap-4">
                  <h2 id={`message-title-${row.id}`} className="text-xl font-semibold text-ink-900">
                    {subject}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Close message"
                    className="rounded-sm p-1.5 text-ink-600 hover:bg-ink-100 hover:text-ink-900 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none"
                  >
                    <X className="size-5" aria-hidden="true" />
                  </button>
                </div>

                <dl className="mt-5 space-y-2 border-y border-ink-200 py-4 text-sm">
                  <div className="grid grid-cols-[7rem_1fr] gap-3">
                    <dt className="font-medium text-ink-600">Name</dt>
                    <dd className="border-l border-ink-200 pl-3 text-ink-900">{row.name}</dd>
                  </div>
                  <div className="grid grid-cols-[7rem_1fr] gap-3">
                    <dt className="font-medium text-ink-600">Status</dt>
                    <dd className="border-l border-ink-200 pl-3 text-ink-900">
                      {readAt ? 'Marked as Read' : 'Marking as Read…'}
                    </dd>
                  </div>
                  <div className="grid grid-cols-[7rem_1fr] gap-3">
                    <dt className="font-medium text-ink-600">Email</dt>
                    <dd className="flex items-center gap-1 border-l border-ink-200 pl-3">
                      <a
                        href={`mailto:${row.email}`}
                        className="text-brand-700 hover:underline"
                      >
                        {row.email}
                      </a>
                      <CopyEmailButton email={row.email} />
                    </dd>
                  </div>
                  {row.whatsapp_no ? (
                    <div className="grid grid-cols-[7rem_1fr] gap-3">
                      <dt className="font-medium text-ink-600">WhatsApp</dt>
                      <dd className="border-l border-ink-200 pl-3 text-ink-900">{row.whatsapp_no}</dd>
                    </div>
                  ) : null}
                  <div className="grid grid-cols-[7rem_1fr] gap-3">
                    <dt className="font-medium text-ink-600">Date</dt>
                    <dd className="border-l border-ink-200 pl-3 text-ink-900">
                      <time dateTime={row.created_at}>{formatMessageDate(row.created_at)}</time>
                    </dd>
                  </div>
                </dl>

                <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-ink-800">
                  {row.message}
                </p>
              </div>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  )
}

function formatMessageDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const day = String(date.getUTCDate()).padStart(2, '0')
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  return `${day}/${month}/${date.getUTCFullYear()}`
}
