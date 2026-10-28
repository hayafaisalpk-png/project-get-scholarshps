'use client'

import { useActionState, useEffect, useId, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'

import { Alert } from '@/components/ui/alert'
import { Button, ButtonLink } from '@/components/ui/button'
import { describedBy, FormField, inputClasses } from '@/features/auth/components/form-field'
import {
  type ScholarshipActionResult,
  createScholarshipAction,
  updateScholarshipAction,
} from '@/features/scholarships/admin/actions'
import type {
  AdminScholarshipDetail,
  ScholarshipTaxonomy,
  TaxonomyOptions,
} from '@/features/scholarships/admin/queries'
import { fromCents, slugify } from '@/lib/validation/scholarship'
import { RichTextEditor } from '@/features/articles/admin/components/rich-text-editor'

/**
 * Scholarship create / edit form.
 *
 * See the contact form for the rationale behind the controlled draft: React
 * resets a `<form action={…}>` once the action resolves, which wipes every
 * field on a rejected submission unless the values live in component state.
 */
export function CreateScholarshipForm(props: FormProps) {
  const [state, formAction] = useActionState(createScholarshipAction, null)

  return (
    <ScholarshipFormFields
      {...props}
      state={state}
      formAction={formAction}
      isEdit={false}
    />
  )
}

/** Edit form. Same static-reference requirement as above. */
export function EditScholarshipForm(props: FormProps) {
  const [state, formAction] = useActionState(updateScholarshipAction, null)

  return (
    <ScholarshipFormFields
      {...props}
      state={state}
      formAction={formAction}
      isEdit
      record={props.record}
    />
  )
}

export type FormProps = {
  record?: AdminScholarshipDetail | undefined
  taxonomyOptions: TaxonomyOptions
  selected: ScholarshipTaxonomy
}

type Draft = {
  title: string
  slug: string
  sponsor_name: string
  institution_logo_url: string
  institution_country: string
  summary: string
  eligibility_requirements: string
  application_instructions: string
  internal_notes: string
  required_documents: string
  award_amount_min: string
  award_amount_max: string
  award_currency: string
  award_amount_text: string
  number_of_awards: string
  award_per_year: boolean
  application_fee: string
  is_renewable: boolean
  max_renewals: string
  opens_at: string
  deadline: string
  is_rolling: boolean
  application_url: string
  status: string
  verification_status: string
  featured: boolean
  noindex: boolean
  seo_title: string
  seo_description: string
  social_media_share_image_url: string
  category_ids: string[]
  education_level_ids: string[]
  field_ids: string[]
  location_ids: string[]
}

const TEXT_KEYS: (keyof Draft)[] = [
  'title',
  'slug',
  'sponsor_name',
  'institution_logo_url',
  'institution_country',
  'summary',
  'eligibility_requirements',
  'application_instructions',
  'internal_notes',
  'required_documents',
  'award_amount_min',
  'award_amount_max',
  'award_currency',
  'award_amount_text',
  'number_of_awards',
  'application_fee',
  'max_renewals',
  'opens_at',
  'deadline',
  'application_url',
  'status',
  'verification_status',
  'seo_title',
  'seo_description',
  'social_media_share_image_url',
]

const BOOL_KEYS: (keyof Draft)[] = [
  'award_per_year',
  'is_renewable',
  'is_rolling',
  'featured',
  'noindex',
]

const ARRAY_KEYS: (keyof Draft)[] = [
  'category_ids',
  'education_level_ids',
  'field_ids',
  'location_ids',
]

function ScholarshipFormFields({
  state,
  formAction,
  isEdit,
  record,
  taxonomyOptions,
  selected,
}: {
  state: ScholarshipActionResult | null
  formAction: (formData: FormData) => void
  isEdit: boolean
  record?: AdminScholarshipDetail | undefined
  taxonomyOptions: TaxonomyOptions
  selected: ScholarshipTaxonomy
}) {
  const formRef = useRef<HTMLFormElement>(null)
  const statusRef = useRef<HTMLDivElement>(null)

  const [slugTouched, setSlugTouched] = useState(isEdit)
  const [editorResetKey, setEditorResetKey] = useState(0)

  const [draft, setDraft] = useState<Draft>(() => ({
    title: record?.title ?? '',
    slug: record?.slug ?? '',
    sponsor_name: record?.sponsor_name ?? '',
    institution_logo_url: record?.institution_logo_url ?? '',
    institution_country: record?.institution_country ?? '',
    summary: record?.summary ?? '',
    eligibility_requirements: record?.eligibility_requirements ?? '',
    application_instructions: record?.application_instructions ?? '',
    internal_notes: record?.internal_notes ?? '',
    required_documents: record?.required_documents ?? '',
    award_amount_min: fromCents(record?.award_amount_min_cents),
    award_amount_max: fromCents(record?.award_amount_max_cents),
    award_currency: record?.award_currency ?? 'USD',
    award_amount_text: record?.award_amount_text ?? '',
    number_of_awards:
      record?.number_of_awards != null ? String(record.number_of_awards) : '',
    award_per_year: record?.award_per_year ?? false,
    application_fee: fromCents(record?.application_fee_cents),
    is_renewable: record?.is_renewable ?? false,
    max_renewals: record?.max_renewals != null ? String(record.max_renewals) : '',
    opens_at: record?.opens_at ?? '',
    deadline: record?.deadline ?? '',
    is_rolling: record?.is_rolling ?? false,
    application_url: record?.application_url ?? '',
    status: record?.status ?? 'draft',
    verification_status: record?.verification_status ?? 'unverified',
    featured: record?.featured ?? false,
    noindex: record?.noindex ?? false,
    seo_title: record?.seo_title ?? '',
    seo_description: record?.seo_description ?? '',
    social_media_share_image_url: record?.social_media_share_image_url ?? '',
    category_ids: selected.category_ids,
    education_level_ids: selected.education_level_ids,
    field_ids: selected.field_ids,
    location_ids: selected.location_ids,
  }))

  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined

  const [lastState, setLastState] = useState(state)
  if (state !== lastState) {
    setLastState(state)
    if (state?.ok) {
      // Keep the edited values in place; the form stays usable for further edits.
    } else if (state?.values) {
      setDraft((current) => {
        const v = state.values as Record<string, string | string[]>
        const next = { ...current }
        for (const key of TEXT_KEYS) {
          if (v[key] !== undefined) (next as Record<string, unknown>)[key] = String(v[key])
        }
        for (const key of BOOL_KEYS) {
          (next as Record<string, unknown>)[key] = v[key] === 'on'
        }
        for (const key of ARRAY_KEYS) {
          if (Array.isArray(v[key])) (next as Record<string, unknown>)[key] = v[key]
        }
        return next
      })
      setEditorResetKey((k) => k + 1)
      if (state.values.slug) setSlugTouched(true)
    }
  }

  useEffect(() => {
    if (!state) return
    if (state.ok) {
      statusRef.current?.focus()
      return
    }
    const firstError = Object.keys(state.fieldErrors ?? {})[0]
    if (firstError) document.getElementById(firstError)?.focus()
    else statusRef.current?.focus()
  }, [state])

  const setField = (key: keyof Draft, value: unknown) =>
    setDraft((d) => ({ ...d, [key]: value }))

  return (
    <form ref={formRef} action={formAction} className="space-y-8" noValidate>
      {record ? (
        <input type="hidden" name="id" value={record.id} />
      ) : null}

      {state && !state.ok ? <Alert tone="error">{state.message}</Alert> : null}
      {state?.ok && state.message ? (
        <Alert tone="success">{state.message}</Alert>
      ) : null}

      {/* ---------------------------------------------------------------- */}
      <Fieldset
        title="Essentials"
        description="How this scholarship appears in listings and search."
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            id="title"
            label="Title"
            className="sm:col-span-2"
            error={fieldErrors?.title}
          >
            <input
              id="title"
              name="title"
              required
              maxLength={300}
              className={inputClasses}
              value={draft.title}
              onChange={(e) => {
                const value = e.target.value
                setDraft((d) => ({
                  ...d,
                  title: value,
                  ...(slugTouched ? {} : { slug: slugify(value) }),
                }))
              }}
              aria-invalid={Boolean(fieldErrors?.title)}
              aria-describedby={describedBy('title', fieldErrors?.title)}
            />
          </FormField>

          <FormField
            id="slug"
            label="URL slug"
            hint="/scholarships/your-slug"
            error={fieldErrors?.slug}
          >
            <input
              id="slug"
              name="slug"
              required
              maxLength={200}
              className={inputClasses}
              value={draft.slug}
              onChange={(e) => {
                setDraft((d) => ({ ...d, slug: e.target.value }))
                setSlugTouched(true)
              }}
              aria-invalid={Boolean(fieldErrors?.slug)}
              aria-describedby={describedBy('slug', fieldErrors?.slug, hintId('slug'))}
            />
          </FormField>

          <FormField
            id="sponsor_name"
            label="Sponsor or provider"
            error={fieldErrors?.sponsor_name}
          >
            <input
              id="sponsor_name"
              name="sponsor_name"
              required
              maxLength={300}
              className={inputClasses}
              value={draft.sponsor_name}
              onChange={(e) => setField('sponsor_name', e.target.value)}
              aria-invalid={Boolean(fieldErrors?.sponsor_name)}
              aria-describedby={describedBy(
                'sponsor_name',
                fieldErrors?.sponsor_name,
              )}
            />
          </FormField>

          <FormField
            id="institution_logo_url"
            label="Institution logo URL"
            hint="HTTPS URL to the university/college logo. Reused across scholarships with the same sponsor."
            error={fieldErrors?.institution_logo_url}
          >
            <input
              id="institution_logo_url"
              name="institution_logo_url"
              type="url"
              maxLength={2000}
              className={inputClasses}
              value={draft.institution_logo_url}
              onChange={(e) => setField('institution_logo_url', e.target.value)}
              aria-invalid={Boolean(fieldErrors?.institution_logo_url)}
            />
          </FormField>

          <FormField
            id="institution_country"
            label="Institution country"
            error={fieldErrors?.institution_country}
          >
            <input
              id="institution_country"
              name="institution_country"
              maxLength={100}
              className={inputClasses}
              value={draft.institution_country}
              onChange={(e) => setField('institution_country', e.target.value)}
              aria-invalid={Boolean(fieldErrors?.institution_country)}
            />
          </FormField>

          <FormField
            id="summary"
            label="Summary"
            className="sm:col-span-2"
            hint="One or two sentences, shown on cards and in search results."
            error={fieldErrors?.summary}
          >
            <textarea
              id="summary"
              name="summary"
              rows={3}
              maxLength={400}
              className={inputClasses}
              value={draft.summary}
              onChange={(e) => setField('summary', e.target.value)}
              aria-describedby={describedBy('summary', undefined, hintId('summary'))}
            />
          </FormField>
        </div>
      </Fieldset>

      {/* ---------------------------------------------------------------- */}
      <Fieldset title="Award" description="Leave amounts blank if not monetary.">
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            id="award_amount_min"
            label="Minimum award"
            error={fieldErrors?.award_amount_min}
          >
            <MoneyInput
              name="award_amount_min"
              value={draft.award_amount_min}
              onChange={(v) => setField('award_amount_min', v)}
              invalid={Boolean(fieldErrors?.award_amount_min)}
            />
          </FormField>

          <FormField
            id="award_amount_max"
            label="Maximum award"
            error={fieldErrors?.award_amount_max}
          >
            <MoneyInput
              name="award_amount_max"
              value={draft.award_amount_max}
              onChange={(v) => setField('award_amount_max', v)}
              invalid={Boolean(fieldErrors?.award_amount_max)}
            />
          </FormField>

          <FormField
            id="award_currency"
            label="Currency"
            hint="Three-letter code, e.g. USD."
            error={fieldErrors?.award_currency}
          >
            <input
              id="award_currency"
              name="award_currency"
              className={inputClasses}
              value={draft.award_currency}
              onChange={(e) => setField('award_currency', e.target.value)}
              maxLength={3}
              aria-invalid={Boolean(fieldErrors?.award_currency)}
            />
          </FormField>

          <FormField
            id="award_amount_text"
            label="Amount description"
            hint="For non-monetary awards, e.g. “Full tuition”."
            error={fieldErrors?.award_amount_text}
          >
            <input
              id="award_amount_text"
              name="award_amount_text"
              className={inputClasses}
              value={draft.award_amount_text}
              onChange={(e) => setField('award_amount_text', e.target.value)}
              maxLength={120}
            />
          </FormField>

          <FormField
            id="number_of_awards"
            label="Number of awards"
            error={fieldErrors?.number_of_awards}
          >
            <input
              id="number_of_awards"
              name="number_of_awards"
              type="number"
              min={1}
              className={inputClasses}
              value={draft.number_of_awards}
              onChange={(e) => setField('number_of_awards', e.target.value)}
            />
          </FormField>

          <FormField
            id="application_fee"
            label="Application fee"
            error={fieldErrors?.application_fee}
          >
            <MoneyInput
              name="application_fee"
              value={draft.application_fee}
              onChange={(v) => setField('application_fee', v)}
              invalid={Boolean(fieldErrors?.application_fee)}
            />
          </FormField>
        </div>

        <Checkbox
          name="award_per_year"
          label="Award is paid per year"
          checked={draft.award_per_year}
          onChange={(c) => setField('award_per_year', c)}
        />
        <Checkbox
          name="is_renewable"
          label="Renewable"
          checked={draft.is_renewable}
          onChange={(c) => setField('is_renewable', c)}
        />
        <FormField id="max_renewals" label="Maximum renewals">
          <input
            id="max_renewals"
            name="max_renewals"
            type="number"
            min={0}
            className={inputClasses}
            value={draft.max_renewals}
            onChange={(e) => setField('max_renewals', e.target.value)}
          />
        </FormField>
      </Fieldset>

      {/* ---------------------------------------------------------------- */}
      <Fieldset title="Timeline">
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField id="opens_at" label="Applications open">
            <input
              id="opens_at"
              name="opens_at"
              type="date"
              className={inputClasses}
              value={draft.opens_at}
              onChange={(e) => setField('opens_at', e.target.value)}
            />
          </FormField>

          <FormField
            id="deadline"
            label="Deadline"
            error={fieldErrors?.deadline}
          >
            <input
              id="deadline"
              name="deadline"
              type="date"
              className={inputClasses}
              value={draft.deadline}
              onChange={(e) => setField('deadline', e.target.value)}
              aria-invalid={Boolean(fieldErrors?.deadline)}
              aria-describedby={describedBy('deadline', fieldErrors?.deadline)}
            />
          </FormField>
        </div>

        <Checkbox
          name="is_rolling"
          label="Rolling applications (no fixed deadline)"
          checked={draft.is_rolling}
          onChange={(c) => setField('is_rolling', c)}
        />
      </Fieldset>

      {/* ---------------------------------------------------------------- */}
      <Fieldset
        title="Application"
        description="The official link must use HTTPS so applicants never submit credentials in clear text."
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            id="application_url"
            label="Official application link"
            className="sm:col-span-2"
            error={fieldErrors?.application_url}
          >
            <input
              id="application_url"
              name="application_url"
              type="url"
              inputMode="url"
              placeholder="https://"
              className={inputClasses}
              value={draft.application_url}
              onChange={(e) => setField('application_url', e.target.value)}
              aria-invalid={Boolean(fieldErrors?.application_url)}
              aria-describedby={describedBy(
                'application_url',
                fieldErrors?.application_url,
              )}
            />
          </FormField>

          <FormField
            id="eligibility_requirements"
            label="Eligibility"
            className="sm:col-span-2"
            error={fieldErrors?.eligibility_requirements}
          >
            <RichTextEditor
              key={`eligibility-${editorResetKey}`}
              name="eligibility_requirements"
              label="Eligibility"
              initialContent={draft.eligibility_requirements}
              onHtmlChange={(html) =>
                setField('eligibility_requirements', html)
              }
            />
          </FormField>

          <FormField
            id="application_instructions"
            label="Application instructions"
            className="sm:col-span-2"
            error={fieldErrors?.application_instructions}
          >
            <RichTextEditor
              key={`instructions-${editorResetKey}`}
              name="application_instructions"
              label="Application instructions"
              initialContent={draft.application_instructions}
              onHtmlChange={(html) =>
                setField('application_instructions', html)
              }
            />
          </FormField>

          <FormField
            id="required_documents"
            label="Required documents"
            className="sm:col-span-2"
            error={fieldErrors?.required_documents}
          >
            <RichTextEditor
              key={`documents-${editorResetKey}`}
              name="required_documents"
              label="Required documents"
              initialContent={draft.required_documents}
              onHtmlChange={(html) =>
                setField('required_documents', html)
              }
            />
          </FormField>
        </div>
      </Fieldset>

      {/* ---------------------------------------------------------------- */}
      <Fieldset
        title="Publishing"
        description="Publishing requires an official application link and a resolved verification status."
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField id="status" label="Status">
            <select
              id="status"
              name="status"
              className={inputClasses}
              value={draft.status}
              onChange={(e) => setField('status', e.target.value)}
            >
              <option value="draft">Draft</option>
              <option value="pending_review">Pending review</option>
              <option value="published">Published</option>
              <option value="expired">Expired</option>
              <option value="archived">Archived</option>
            </select>
          </FormField>

          <FormField
            id="verification_status"
            label="Verification"
            error={fieldErrors?.verification_status}
          >
            <select
              id="verification_status"
              name="verification_status"
              className={inputClasses}
              value={draft.verification_status}
              onChange={(e) => setField('verification_status', e.target.value)}
              aria-invalid={Boolean(fieldErrors?.verification_status)}
              aria-describedby={describedBy(
                'verification_status',
                fieldErrors?.verification_status,
              )}
            >
              <option value="unverified">Unverified</option>
              <option value="pending">Pending</option>
              <option value="verified">Verified</option>
              <option value="disputed">Disputed</option>
            </select>
          </FormField>
        </div>

        <Checkbox
          name="featured"
          label="Feature on the homepage"
          checked={draft.featured}
          onChange={(c) => setField('featured', c)}
        />
        <Checkbox
          name="noindex"
          label="Hide from search engines (noindex)"
          checked={draft.noindex}
          onChange={(c) => setField('noindex', c)}
        />
      </Fieldset>

      {/* ---------------------------------------------------------------- */}
      <Fieldset
        title="Classification"
        description="Assigning these makes the scholarship discoverable through browse and filter pages."
      >
        <CheckboxGroup
          legend="Categories"
          name="category_ids"
          options={taxonomyOptions.categories}
          selected={draft.category_ids}
          onChange={(ids) => setField('category_ids', ids)}
        />
        <CheckboxGroup
          legend="Education levels"
          name="education_level_ids"
          options={taxonomyOptions.educationLevels}
          selected={draft.education_level_ids}
          onChange={(ids) => setField('education_level_ids', ids)}
        />
        <CheckboxGroup
          legend="Fields of study"
          name="field_ids"
          options={taxonomyOptions.fields}
          selected={draft.field_ids}
          onChange={(ids) => setField('field_ids', ids)}
        />
        <CheckboxGroup
          legend="Locations"
          name="location_ids"
          options={taxonomyOptions.locations}
          selected={draft.location_ids}
          onChange={(ids) => setField('location_ids', ids)}
        />
      </Fieldset>

      {/* ---------------------------------------------------------------- */}
      <Fieldset title="SEO and notes">
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            id="seo_title"
            label="SEO title"
            error={fieldErrors?.seo_title}
          >
            <input
              id="seo_title"
              name="seo_title"
              className={inputClasses}
              maxLength={300}
              value={draft.seo_title}
              onChange={(e) => setField('seo_title', e.target.value)}
            />
          </FormField>

          <FormField
            id="seo_description"
            label="Meta description"
            error={fieldErrors?.seo_description}
          >
            <input
              id="seo_description"
              name="seo_description"
              className={inputClasses}
              maxLength={500}
              value={draft.seo_description}
              onChange={(e) => setField('seo_description', e.target.value)}
            />
          </FormField>

          <FormField
            id="social_media_share_image_url"
            label="Social Media Share Image URL"
            hint="Optional. This image is used only for social media sharing previews on platforms such as Facebook, WhatsApp, LinkedIn, and X. It does not change the images displayed on the scholarship page."
            error={fieldErrors?.social_media_share_image_url}
          >
            <input
              id="social_media_share_image_url"
              name="social_media_share_image_url"
              type="url"
              inputMode="url"
              placeholder="https://example.com/scholarship-social-image.jpg"
              maxLength={2000}
              className={inputClasses}
              value={draft.social_media_share_image_url}
              onChange={(e) =>
                setField('social_media_share_image_url', e.target.value)
              }
              aria-invalid={Boolean(fieldErrors?.social_media_share_image_url)}
              aria-describedby={describedBy(
                'social_media_share_image_url',
                fieldErrors?.social_media_share_image_url,
              )}
            />
          </FormField>

          <FormField
            id="internal_notes"
            label="Internal notes"
            className="sm:col-span-2"
            hint="Never shown on the public site."
          >
            <textarea
              id="internal_notes"
              name="internal_notes"
              rows={3}
              className={inputClasses}
              value={draft.internal_notes}
              onChange={(e) => setField('internal_notes', e.target.value)}
            />
          </FormField>
        </div>
      </Fieldset>

      <div className="sticky bottom-0 flex justify-end gap-3 border-t border-ink-200 bg-ink-50 py-4">
        <ButtonLink variant="outline" href="/admin/scholarships">
          Cancel
        </ButtonLink>
        <SubmitButton label={isEdit ? 'Save changes' : 'Create scholarship'} />
      </div>
    </form>
  )
}

/* -------------------------------------------------------------------------- */
/* Pieces                                                                     */
/* -------------------------------------------------------------------------- */

function hintId(id: string): string {
  return `${id}-hint`
}

function Fieldset({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-sm border border-ink-200 bg-white p-6 shadow-xs">
      <h2 className="text-lg font-semibold text-ink-900">{title}</h2>
      {description ? (
        <p className="mt-1 mb-5 text-sm text-ink-600">{description}</p>
      ) : (
        <div className="mb-5" />
      )}
      <div className="space-y-4">{children}</div>
    </section>
  )
}

function MoneyInput({
  name,
  value,
  onChange,
  invalid,
}: {
  name: string
  value: string
  onChange: (value: string) => void
  invalid?: boolean
}) {
  return (
    <input
      id={name}
      name={name}
      inputMode="decimal"
      placeholder="0.00"
      className={inputClasses}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-invalid={invalid || undefined}
    />
  )
}

function Checkbox({
  name,
  label,
  checked,
  onChange,
}: {
  name: string
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  const id = useId()

  return (
    <div className="flex items-start gap-2.5">
      <input
        id={id}
        name={name}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 rounded border-ink-300 text-brand-700 focus:ring-2 focus:ring-brand-200"
      />
      <label htmlFor={id} className="text-sm text-ink-800">
        {label}
      </label>
    </div>
  )
}

function CheckboxGroup({
  legend,
  name,
  options,
  selected,
  onChange,
}: {
  legend: string
  name: string
  options: { id: string; name: string }[]
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  const toggle = (id: string, checked: boolean) => {
    const next = checked
      ? [...selected, id]
      : selected.filter((x) => x !== id)
    onChange(next)
  }

  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-ink-800">
        {legend}
      </legend>

      {options.length === 0 ? (
        <p className="text-sm text-ink-500">Nothing available yet.</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {options.map((option) => (
            <label
              key={option.id}
              className="flex items-center gap-2.5 rounded-sm border border-ink-200 px-3 py-2 text-sm text-ink-800 hover:bg-ink-50"
            >
              <input
                type="checkbox"
                name={name}
                value={option.id}
                checked={selected.includes(option.id)}
                onChange={(e) => toggle(option.id, e.target.checked)}
                className="size-4 rounded border-ink-300 text-brand-700 focus:ring-2 focus:ring-brand-200"
              />
              {option.name}
            </label>
          ))}
        </div>
      )}
    </fieldset>
  )
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Saving…' : label}
    </Button>
  )
}