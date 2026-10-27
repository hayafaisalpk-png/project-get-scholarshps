-- =============================================================================
-- 041_rich_text_required_documents.sql
--
-- `required_documents` changes from text[] to text so the CMS can store rich-text
-- (HTML) content produced by the editor, matching `eligibility_requirements`
-- and `application_instructions`.
--
-- Existing array values are joined with newlines so no information is lost; the
-- public page renders the result through the sanitiser, so legacy plain text
-- stays readable.
-- =============================================================================
alter table public.scholarships
  alter column required_documents type text
  using case
    when required_documents is null or required_documents = '{}' then null
    else array_to_string(required_documents, E'\n')
  end;

alter table public.scholarships
  alter column required_documents drop default;

alter table public.scholarships
  alter column required_documents set default null;

comment on column public.scholarships.required_documents is
  'Rich-text (HTML) list of documents an applicant may need. Sanitised on write and on read.';