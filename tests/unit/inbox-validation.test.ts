import { describe, expect, it } from 'vitest'

import {
  buildContactStatusPatch,
  buildReportStatusPatch,
  CLOSED_REPORT_STATUSES,
  CONTACT_STATUSES,
  CONTACT_TRIAGE_TARGETS,
  contactTriageSchema,
  isClosedReportStatus,
  REPORT_STATUSES,
  reportTriageSchema,
  RESOLUTION_NOTE_MAX,
} from '@/lib/validation/inbox'

/**
 * Inbox triage rules.
 *
 * The tests that matter here are the ones a reviewer would otherwise have to
 * take on trust: `content_reports_resolved_consistent` is a database CHECK that
 * equates a closed status with a non-null `resolved_at`, so a patch builder that
 * writes only `status` fails the whole UPDATE with `23514` and the editor sees a
 * generic error. That relationship is asserted directly below, along with the
 * UUID guard that keeps a caller-supplied id out of a PostgREST filter.
 */

const UUID = '3f1a1f9e-2c2b-4a51-9d3e-8f2a1c4b5d6e'
const NOW = '2026-10-18T09:00:00.000Z'
const ACTOR = '11111111-1111-4111-8111-111111111111'

/* -------------------------------------------------------------------------- */
/* Enums                                                                       */
/* -------------------------------------------------------------------------- */

describe('inbox status vocabularies', () => {
  it('lists exactly the database enums', () => {
    // Mirrors public.contact_status and public.report_status in migration 009.
    expect([...CONTACT_STATUSES]).toEqual(['new', 'in_progress', 'resolved', 'spam'])
    expect([...REPORT_STATUSES]).toEqual(['open', 'reviewing', 'resolved', 'dismissed'])
  })

  it('does not offer "new" as a triage destination', () => {
    // Arrival state, not a decision. Offering it would let an editor "move" a
    // message to where it already is.
    expect(CONTACT_TRIAGE_TARGETS).not.toContain('new')
  })

  it('treats resolved and dismissed as the closed report statuses', () => {
    expect([...CLOSED_REPORT_STATUSES]).toEqual(['resolved', 'dismissed'])
    expect(isClosedReportStatus('resolved')).toBe(true)
    expect(isClosedReportStatus('dismissed')).toBe(true)
    expect(isClosedReportStatus('open')).toBe(false)
    expect(isClosedReportStatus('reviewing')).toBe(false)
  })
})

/* -------------------------------------------------------------------------- */
/* contactTriageSchema                                                         */
/* -------------------------------------------------------------------------- */

describe('contactTriageSchema', () => {
  const valid = { id: UUID, status: 'resolved', currentStatus: 'new' }

  it('accepts a valid transition', () => {
    expect(contactTriageSchema.safeParse(valid).success).toBe(true)
  })

  it.each([...CONTACT_STATUSES])('accepts the %s status', (status) => {
    expect(
      contactTriageSchema.safeParse({
        id: UUID,
        status,
        currentStatus: status === 'new' ? 'spam' : 'new',
      }).success,
    ).toBe(true)
  })

  it('rejects an unknown status', () => {
    const result = contactTriageSchema.safeParse({ ...valid, status: 'deleted' })
    expect(result.success).toBe(false)
  })

  it.each([
    ['not a uuid', 'abc'],
    ['a uuid with an injected filter', `${UUID}?status=spam`],
    ['empty', ''],
  ])('rejects an id that is %s', (_label, id) => {
    // The id is interpolated into a PostgREST filter, so its shape is a
    // security-relevant property, not a cosmetic one.
    expect(contactTriageSchema.safeParse({ ...valid, id }).success).toBe(false)
  })
})

/* -------------------------------------------------------------------------- */
/* buildContactStatusPatch                                                     */
/* -------------------------------------------------------------------------- */

describe('buildContactStatusPatch', () => {
  it('stamps the handler and the time when resolving', () => {
    expect(
      buildContactStatusPatch({ status: 'resolved', actorId: ACTOR, now: NOW }),
    ).toEqual({ status: 'resolved', handled_by: ACTOR, handled_at: NOW })
  })

  it.each(['new', 'in_progress', 'spam'] as const)(
    'leaves handled_by and handled_at null for %s',
    (status) => {
      // A timestamp claiming someone handled a message they did not handle is
      // worse than no timestamp, so reopening clears both.
      expect(
        buildContactStatusPatch({ status, actorId: ACTOR, now: NOW }),
      ).toEqual({ status, handled_by: null, handled_at: null })
    },
  )
})

/* -------------------------------------------------------------------------- */
/* reportTriageSchema                                                          */
/* -------------------------------------------------------------------------- */

describe('reportTriageSchema', () => {
  const base = {
    id: UUID,
    status: 'resolved',
    currentStatus: 'open',
    resolutionNote: 'Deadline corrected against the awarding body site.',
  }

  it('accepts closing a report with a note', () => {
    expect(reportTriageSchema.safeParse(base).success).toBe(true)
  })

  it.each([
    ['open', 'reviewing'],
    ['resolved', 'open'],
  ])('accepts moving %s -> %s without a note', (currentStatus, status) => {
    expect(
      reportTriageSchema.safeParse({
        ...base,
        status,
        currentStatus,
        resolutionNote: '',
      }).success,
    ).toBe(true)
  })

  it.each(['resolved', 'dismissed'])('refuses to close a report (%s) with no note', (status) => {
    const result = reportTriageSchema.safeParse({ ...base, status, resolutionNote: '' })
    expect(result.success).toBe(false)
    expect(result.error?.issues.some((i) => i.path.join('.') === 'resolutionNote')).toBe(
      true,
    )
  })

  it('refuses a whitespace-only note', () => {
    expect(
      reportTriageSchema.safeParse({ ...base, resolutionNote: '   \n  ' }).success,
    ).toBe(false)
  })

  it('refuses a note longer than the cap', () => {
    expect(
      reportTriageSchema.safeParse({ ...base, resolutionNote: 'x'.repeat(RESOLUTION_NOTE_MAX + 1) })
        .success,
    ).toBe(false)
  })

  it('refuses a no-op transition', () => {
    const result = reportTriageSchema.safeParse({ ...base, currentStatus: 'resolved' })
    expect(result.success).toBe(false)
  })

  it('rejects an unknown status', () => {
    expect(
      reportTriageSchema.safeParse({ ...base, status: 'ignored' }).success,
    ).toBe(false)
  })
})

/* -------------------------------------------------------------------------- */
/* buildReportStatusPatch — the CHECK constraint, expressed                    */
/* -------------------------------------------------------------------------- */

describe('buildReportStatusPatch', () => {
  /**
   * The database enforces:
   *   check ((status in ('resolved','dismissed')) = (resolved_at is not null))
   *
   * This is that constraint re-stated as a test, so a future edit to the builder
   * fails here rather than in production with a `23514` the editor cannot act on.
   */
  function satisfiesResolvedConsistent(patch: {
    status: string
    resolved_at: string | null
  }): boolean {
    return (patch.status === 'resolved' || patch.status === 'dismissed') ===
      (patch.resolved_at !== null)
  }

  it.each([...REPORT_STATUSES])('satisfies the CHECK for status %s', (status) => {
    const patch = buildReportStatusPatch({
      status,
      note: 'Checked against the awarding body.',
      actorId: ACTOR,
      now: NOW,
    })
    expect(satisfiesResolvedConsistent(patch)).toBe(true)
  })

  it('records who closed the report and when', () => {
    expect(
      buildReportStatusPatch({
        status: 'resolved',
        note: 'Corrected the deadline.',
        actorId: ACTOR,
        now: NOW,
      }),
    ).toEqual({
      status: 'resolved',
      resolved_by: ACTOR,
      resolved_at: NOW,
      resolution_note: 'Corrected the deadline.',
    })
  })

  it('trims the stored note', () => {
    expect(
      buildReportStatusPatch({
        status: 'dismissed',
        note: '  The record is accurate.  ',
        actorId: ACTOR,
        now: NOW,
      }).resolution_note,
    ).toBe('The record is accurate.')
  })

  it('clears the resolution when a report is reopened', () => {
    // Carrying a note onto a reopened report would assert a correction that has
    // been undone, so all three fields are reset together.
    expect(
      buildReportStatusPatch({
        status: 'open',
        note: 'Corrected the deadline.',
        actorId: ACTOR,
        now: NOW,
      }),
    ).toEqual({
      status: 'open',
      resolved_by: null,
      resolved_at: null,
      resolution_note: null,
    })
  })
})