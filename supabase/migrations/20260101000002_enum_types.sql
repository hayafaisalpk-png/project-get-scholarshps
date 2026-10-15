-- =============================================================================
-- 002_enum_types.sql
-- Native Postgres enums for every status-like column.
--
-- Changing an enum value later requires a new migration (add value, or create a
-- new type and swap). Never edit this file after it has been applied.
-- =============================================================================

-- --- Scholarships ------------------------------------------------------------
create type public.scholarship_status as enum (
  'draft',
  'pending_review',
  'published',
  'expired',
  'archived'
);

create type public.verification_status as enum (
  'unverified',
  'pending',
  'verified',
  'disputed'
);

create type public.verification_result as enum (
  'confirmed',
  'updated',
  'deadline_extended',
  'disputed',
  'unreachable'
);

-- --- Articles ----------------------------------------------------------------
create type public.article_status as enum (
  'draft',
  'in_review',
  'scheduled',
  'published',
  'archived'
);

create type public.review_decision as enum (
  'approved',
  'changes_requested',
  'rejected'
);

-- --- Taxonomy ----------------------------------------------------------------
-- Shared across categories, tags, education levels, academic fields, locations.
create type public.taxonomy_status as enum (
  'active',
  'inactive'
);

create type public.location_type as enum (
  'country',
  'state',
  'region'
);

-- --- Identity ----------------------------------------------------------------
create type public.user_status as enum (
  'active',
  'pending',
  'suspended'
);

-- --- Platform ----------------------------------------------------------------
create type public.newsletter_status as enum (
  'pending',
  'subscribed',
  'unsubscribed',
  'bounced'
);

create type public.contact_status as enum (
  'new',
  'in_progress',
  'resolved',
  'spam'
);

create type public.report_status as enum (
  'open',
  'reviewing',
  'resolved',
  'dismissed'
);

create type public.report_reason as enum (
  'incorrect_deadline',
  'incorrect_amount',
  'not_eligible',
  'no_longer_available',
  'broken_link',
  'duplicate',
  'other'
);

create type public.consent_source as enum (
  'banner',
  'settings'
);

create type public.setting_value_type as enum (
  'string',
  'text',
  'number',
  'boolean',
  'json',
  'url',
  'image'
);

create type public.navigation_location as enum (
  'header',
  'footer_column_1',
  'footer_column_2',
  'footer_column_3',
  'footer_column_4',
  'legal'
);
