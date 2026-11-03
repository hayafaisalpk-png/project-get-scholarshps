"use client";

import { FormField, inputClasses, describedBy } from '@/features/auth/components/form-field';

interface MetaKeywordsInputProps {
  id: string;
  /** Controlled value. Mutually exclusive with `defaultValue`. */
  value?: string;
  /** Uncontrolled initial value. Mutually exclusive with `value`. */
  defaultValue?: string;
  onChange?: (value: string) => void;
  error?: string | undefined;
  hint?: string;
}

/**
 * Comma-separated textarea for SEO meta keywords.
 *
 * Editors enter keywords separated by commas, semicolons or new lines. The
 * consuming server action parses the value into a PostgreSQL `TEXT[]` via
 * `parseKeywords()` before saving.
 */
export default function MetaKeywordsInput({
  id,
  value,
  defaultValue,
  onChange,
  error,
  hint,
}: MetaKeywordsInputProps) {
  return (
    <FormField
      id={id}
      label="Meta Keywords"
      error={error}
      hint={hint ?? "Enter keywords separated by commas. Example: scholarships 2027, fully funded scholarships, study abroad."}
      className="sm:col-span-2"
    >
      <textarea
        id={id}
        name={id}
        rows={3}
        maxLength={2000}
        className={inputClasses}
        {...(value !== undefined
          ? {
              value,
              onChange: (e) => onChange?.(e.target.value),
            }
          : { defaultValue })}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy(id, error, hint)}
      />
    </FormField>
  );
}
