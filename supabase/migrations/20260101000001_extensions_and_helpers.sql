-- =============================================================================
-- 001_extensions_and_helpers.sql
-- Extensions and generic trigger helpers.
--
-- NOTE: the authorization helpers (current_user_role_keys, has_permission, …)
-- live in migration 004 because they reference the identity tables created in
-- 003. SQL-language function bodies are validated at creation time, so they
-- cannot be defined before the tables they query exist.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- -----------------------------------------------------------------------------
-- set_updated_at()
-- Maintains updated_at on every table that carries the column.
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Trigger function that sets NEW.updated_at to now().';

-- -----------------------------------------------------------------------------
-- attach_updated_at_trigger(table)
-- Wires set_updated_at onto a table. Invoked at the end of each migration that
-- creates a table with an updated_at column.
-- -----------------------------------------------------------------------------
create or replace function public.attach_updated_at_trigger(p_table text)
returns void
language plpgsql
as $$
begin
  execute format('drop trigger if exists set_updated_at on public.%I;', p_table);
  execute format(
    'create trigger set_updated_at before update on public.%I
       for each row execute function public.set_updated_at();',
    p_table
  );
end;
$$;

comment on function public.attach_updated_at_trigger(text) is
  'Attaches the set_updated_at trigger to the named table.';
