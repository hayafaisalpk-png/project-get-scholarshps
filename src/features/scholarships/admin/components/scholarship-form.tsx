'use client'

import { useActionState, useId, useState } from 'react'
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

/**
 * Scholarship create / edit form.
 *
 * The only client component in the scholarship screens; every page around it is
 * a Server Component.
 *
 * IMPORTANT — `action` is passed in as a prop by the calling Server Component
 * rather than chosen here with a ternary:
 *
 *   const [state, action] = useActionState(
 *     isEdit ? updateAction : createAction, null)   // BROKEN
 *
 * A conditional expression between two Server Actions cannot be resolved
 * statically by the compiler. The form then renders an indirect `$ACTION_REF`
 * reference instead of a registered `$ACTION_ID`, the server cannot resolve it,
 * and the submit 404s. Passing the action down from a Server Component keeps it
 * a statically-known reference while still avoiding a duplicated form.
 *
 * Two behaviours worth calling out:
 *
 *   - The slug is suggested from the title until the editor edits it by hand.
 *     Once touched it is never overwritten, because silently changing a live
 *     URL under the editor is far worse than an imperfect initial guess.
 *   - Money is entered as decimal currency and converted to integer cents
 *     server-side. No float ever touches an amount.
 */
/**
 * Create form.
 *
 * The Server Action is imported and referenced directly rather than chosen
 * with a conditional expression, so the reference stays statically analysable
 * and Next.js emits a registered action id for the form.
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

/**
 * Shared form body.
 *
 * Not exported: it receives an already-bound `formAction` from the wrapper
 * above, which is an ordinary in-module value rather than something crossing the
 * server/client boundary.
 */
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

  const [slug, setSlug] = useState(record?.slug ?? '')
  const [slugTouched, setSlugTouched] = useState(isEdit)
  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined

  const onTitleChange = (value: string) => {
    if (!slugTouched) setSlug(slugify(value))
  }

  return (
    <form action={formAction} className="space-y-8" noValidate>
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
              defaultValue={record?.title ?? ''}
              onChange={(e) => onTitleChange(e.target.value)}
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
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value)
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
              defaultValue={record?.sponsor_name ?? ''}
              aria-invalid={Boolean(fieldErrors?.sponsor_name)}
              aria-describedby={describedBy(
                'sponsor_name',
                fieldErrors?.sponsor_name,
              )}
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
              defaultValue={record?.summary ?? ''}
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
              defaultValue={fromCents(record?.award_amount_min_cents)}
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
              defaultValue={fromCents(record?.award_amount_max_cents)}
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
              defaultValue={record?.award_currency ?? 'USD'}
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
              defaultValue={record?.award_amount_text ?? ''}
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
              defaultValue={record?.number_of_awards ?? ''}
            />
          </FormField>

          <FormField
            id="application_fee"
            label="Application fee"
            error={fieldErrors?.application_fee}
          >
            <MoneyInput
              name="application_fee"
              defaultValue={fromCents(record?.application_fee_cents)}
              invalid={Boolean(fieldErrors?.application_fee)}
            />
          </FormField>
        </div>

        <Checkbox
          name="award_per_year"
          label="Award is paid per year"
          defaultChecked={record?.award_per_year ?? false}
        />
        <Checkbox
          name="is_renewable"
          label="Renewable"
          defaultChecked={record?.is_renewable ?? false}
        />
        <FormField id="max_renewals" label="Maximum renewals">
          <input
            id="max_renewals"
            name="max_renewals"
            type="number"
            min={0}
            className={inputClasses}
            defaultValue={record?.max_renewals ?? ''}
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
              defaultValue={record?.opens_at ?? ''}
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
              defaultValue={record?.deadline ?? ''}
              aria-invalid={Boolean(fieldErrors?.deadline)}
              aria-describedby={describedBy('deadline', fieldErrors?.deadline)}
            />
          </FormField>
        </div>

        <Checkbox
          name="is_rolling"
          label="Rolling applications (no fixed deadline)"
          defaultChecked={record?.is_rolling ?? false}
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
              defaultValue={record?.application_url ?? ''}
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
          >
            <textarea
              id="eligibility_requirements"
              name="eligibility_requirements"
              rows={5}
              className={inputClasses}
              defaultValue={record?.eligibility_requirements ?? ''}
            />
          </FormField>

          <FormField
            id="application_instructions"
            label="Application instructions"
            className="sm:col-span-2"
          >
            <textarea
              id="application_instructions"
              name="application_instructions"
              rows={5}
              className={inputClasses}
              defaultValue={record?.application_instructions ?? ''}
            />
          </FormField>

          <FormField
            id="required_documents"
            label="Required documents"
            className="sm:col-span-2"
            hint="One per line."
          >
            <textarea
              id="required_documents"
              name="required_documents"
              rows={4}
              className={inputClasses}
              defaultValue={(record?.required_documents ?? []).join('\n')}
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
              defaultValue={record?.status ?? 'draft'}
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
              defaultValue={record?.verification_status ?? 'unverified'}
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
          defaultChecked={record?.featured ?? false}
        />
        <Checkbox
          name="noindex"
          label="Hide from search engines (noindex)"
          defaultChecked={record?.noindex ?? false}
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
          selected={selected.category_ids}
        />
        <CheckboxGroup
          legend="Education levels"
          name="education_level_ids"
          options={taxonomyOptions.educationLevels}
          selected={selected.education_level_ids}
        />
        <CheckboxGroup
          legend="Fields of study"
          name="field_ids"
          options={taxonomyOptions.fields}
          selected={selected.field_ids}
        />
        <CheckboxGroup
          legend="Locations"
          name="location_ids"
          options={taxonomyOptions.locations}
          selected={selected.location_ids}
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
              defaultValue={record?.seo_title ?? ''}
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
              defaultValue={record?.seo_description ?? ''}
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
              defaultValue={record?.internal_notes ?? ''}
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
  defaultValue,
  invalid,
}: {
  name: string
  defaultValue: string
  invalid?: boolean
}) {
  return (
    <input
      id={name}
      name={name}
      inputMode="decimal"
      placeholder="0.00"
      className={inputClasses}
      defaultValue={defaultValue}
      aria-invalid={invalid || undefined}
    />
  )
}

function Checkbox({
  name,
  label,
  defaultChecked,
}: {
  name: string
  label: string
  defaultChecked?: boolean
}) {
  const id = useId()

  return (
    <div className="flex items-start gap-2.5">
      <input
        id={id}
        name={name}
        type="checkbox"
        defaultChecked={defaultChecked}
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
}: {
  legend: string
  name: string
  options: { id: string; name: string }[]
  selected: string[]
}) {
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
                defaultChecked={selected.includes(option.id)}
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