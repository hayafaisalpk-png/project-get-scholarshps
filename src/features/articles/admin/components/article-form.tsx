'use client'

import { useActionState, useId, useState } from 'react'
import { useFormStatus } from 'react-dom'

import { Alert } from '@/components/ui/alert'
import { Button, ButtonLink } from '@/components/ui/button'
import { describedBy, FormField, inputClasses } from '@/features/auth/components/form-field'
import { RichTextEditor } from '@/features/articles/admin/components/rich-text-editor'
import type {
  AdminArticleDetail,
  ArticleFormOptions,
  ArticleRelations,
} from '@/features/articles/admin/queries'
import { isoToLocalDateTime, slugifyArticle } from '@/lib/validation/article'

import {
  type ArticleActionResult,
  createArticleAction,
  updateArticleAction,
} from '../actions'

/**
 * Article create / edit form.
 *
 * As with the scholarship form, the Server Action is imported and referenced
 * directly rather than selected conditionally, so the action reference stays
 * statically analysable and is not silently rebuilt during hydration.
 */
export function CreateArticleForm(props: FormProps) {
  const [state, formAction] = useActionState(createArticleAction, null)
  return (
    <ArticleFormFields
      {...props}
      state={state}
      formAction={formAction}
      isEdit={false}
    />
  )
}

export function EditArticleForm(props: FormProps) {
  const [state, formAction] = useActionState(updateArticleAction, null)
  return (
    <ArticleFormFields
      {...props}
      state={state}
      formAction={formAction}
      isEdit
      record={props.record}
    />
  )
}

export type FormProps = {
  record?: AdminArticleDetail | undefined
  options: ArticleFormOptions
  relations: ArticleRelations
}

function ArticleFormFields({
  state,
  formAction,
  isEdit,
  record,
  options,
  relations,
}: {
  state: ArticleActionResult | null
  formAction: (formData: FormData) => void
  isEdit: boolean
  record?: AdminArticleDetail | undefined
  options: ArticleFormOptions
  relations: ArticleRelations
}) {
  const [slug, setSlug] = useState(record?.slug ?? '')
  const [slugTouched, setSlugTouched] = useState(isEdit)
  const [words, setWords] = useState(record?.word_count ?? 0)

  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {record ? <input type="hidden" name="id" value={record.id} /> : null}

      {state && !state.ok ? <Alert tone="error">{state.message}</Alert> : null}
      {state?.ok && state.message ? (
        <Alert tone="success">{state.message}</Alert>
      ) : null}

      <section className="rounded-sm border border-ink-200 bg-white p-6 shadow-xs">
        <h2 className="text-lg font-semibold text-ink-900">Essentials</h2>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
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
              onChange={(e) => {
                if (!slugTouched) setSlug(slugifyArticle(e.target.value))
              }}
              aria-invalid={Boolean(fieldErrors?.title)}
              aria-describedby={describedBy('title', fieldErrors?.title)}
            />
          </FormField>

          <FormField
            id="slug"
            label="URL slug"
            hint="/articles/your-slug"
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
              aria-describedby={describedBy('slug', fieldErrors?.slug)}
            />
          </FormField>

          <FormField id="author_id" label="Author">
            <select
              id="author_id"
              name="author_id"
              className={inputClasses}
              defaultValue={record?.author_id ?? ''}
            >
              <option value="">No author</option>
              {options.authors.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </FormField>

          <FormField
            id="excerpt"
            label="Excerpt"
            className="sm:col-span-2"
            hint="Shown in listings and search results."
            error={fieldErrors?.excerpt}
          >
            <textarea
              id="excerpt"
              name="excerpt"
              rows={3}
              maxLength={600}
              className={inputClasses}
              defaultValue={record?.excerpt ?? ''}
            />
          </FormField>
        </div>
      </section>

      <section className="rounded-sm border border-ink-200 bg-white p-6 shadow-xs">
        <h2 className="text-lg font-semibold text-ink-900">Body</h2>
        <p className="mt-1 mb-5 text-sm text-ink-600">
          Saved as sanitised HTML. Scripts, embedded frames and unsafe links are
          removed on the server regardless of what the editor produces.
        </p>

        <FormField id="content" label="Article content" error={fieldErrors?.content}>
          <RichTextEditor
            name="content"
            label="Article content"
            initialContent={record?.content ?? ''}
            onWordCountChange={setWords}
          />
        </FormField>

        <p className="mt-3 text-xs text-ink-500">
          Stored word count: {record ? record.word_count : words}
          {isEdit && record && words !== record.word_count ? (
            <span className="ml-2 text-amber-700">
              unsaved changes in the body
            </span>
          ) : null}
        </p>
      </section>

      <section className="rounded-sm border border-ink-200 bg-white p-6 shadow-xs">
        <h2 className="text-lg font-semibold text-ink-900">Publishing</h2>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <FormField id="status" label="Status">
            <select
              id="status"
              name="status"
              className={inputClasses}
              defaultValue={record?.status ?? 'draft'}
            >
              <option value="draft">Draft</option>
              <option value="in_review">In review</option>
              <option value="scheduled">Scheduled</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </FormField>

          <FormField
            id="scheduled_for"
            label="Publish at"
            hint="Required when the status is scheduled."
            error={fieldErrors?.scheduled_for}
          >
            <input
              id="scheduled_for"
              name="scheduled_for"
              type="datetime-local"
              className={inputClasses}
              defaultValue={isoToLocalDateTime(record?.scheduled_for)}
              aria-invalid={Boolean(fieldErrors?.scheduled_for)}
            />
          </FormField>
        </div>
      </section>

      <section className="rounded-sm border border-ink-200 bg-white p-6 shadow-xs">
        <h2 className="text-lg font-semibold text-ink-900">Classification</h2>

        <div className="mt-5 space-y-5">
          <CheckboxGroup
            legend="Categories"
            name="article_category_ids"
            options={options.categories}
            selected={relations.category_ids}
          />
          <CheckboxGroup
            legend="Tags"
            name="article_tag_ids"
            options={options.tags}
            selected={relations.tag_ids}
          />
          <CheckboxGroup
            legend="Related scholarships"
            name="scholarship_ids"
            options={options.scholarships}
            selected={relations.scholarship_ids}
            emptyText="No published scholarships are available to link yet."
          />
        </div>
      </section>

      <section className="rounded-sm border border-ink-200 bg-white p-6 shadow-xs">
        <h2 className="text-lg font-semibold text-ink-900">SEO</h2>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <FormField id="seo_title" label="SEO title" error={fieldErrors?.seo_title}>
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
            id="canonical_url"
            label="Canonical URL"
            className="sm:col-span-2"
            error={fieldErrors?.canonical_url}
          >
            <input
              id="canonical_url"
              name="canonical_url"
              type="url"
              className={inputClasses}
              defaultValue={record?.canonical_url ?? ''}
              aria-invalid={Boolean(fieldErrors?.canonical_url)}
            />
          </FormField>

          <FormField
            id="change_note"
            label="Change note"
            className="sm:col-span-2"
            hint="Recorded in the audit log."
          >
            <input
              id="change_note"
              name="change_note"
              className={inputClasses}
              maxLength={300}
            />
          </FormField>
        </div>

        <div className="mt-5 space-y-3">
          <Checkbox
            name="noindex"
            label="Hide from search engines (noindex)"
            defaultChecked={record?.noindex ?? false}
          />
          <Checkbox
            name="allow_sitemap"
            label="Include in the sitemap"
            defaultChecked={record?.allow_sitemap ?? true}
          />
        </div>
      </section>

      <div className="flex justify-end gap-3 border-t border-ink-200 pt-4">
        <ButtonLink variant="outline" href="/admin/articles">
          Cancel
        </ButtonLink>
        <SubmitButton label={isEdit ? 'Save changes' : 'Create article'} />
      </div>
    </form>
  )
}

/* -------------------------------------------------------------------------- */
/* Pieces                                                                     */
/* -------------------------------------------------------------------------- */

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
  emptyText = 'Nothing available yet.',
}: {
  legend: string
  name: string
  options: { id: string; name: string }[]
  selected: string[]
  emptyText?: string
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-ink-800">{legend}</legend>

      {options.length === 0 ? (
        <p className="text-sm text-ink-500">{emptyText}</p>
      ) : (
        <div className="grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
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
                className="size-4 shrink-0 rounded border-ink-300 text-brand-700 focus:ring-2 focus:ring-brand-200"
              />
              <span className="truncate">{option.name}</span>
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