-- =============================================================================
-- 003_identity.sql
-- Profiles, roles, permissions and their assignments.
--
-- Supabase Auth (auth.users) is the sole identity provider. Passwords are NEVER
-- stored here — only a profile row keyed to auth.users(id).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------
create table public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  email             text,
  full_name         text,
  avatar_url        text,
  bio               text,
  status            public.user_status not null default 'active',
  last_sign_in_at   timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint profiles_full_name_length check (
    full_name is null or char_length(full_name) between 1 and 200
  )
);

comment on table public.profiles is
  'Profile data linked to auth.users. Never stores credentials.';

create index profiles_email_idx on public.profiles (lower(email));

select public.attach_updated_at_trigger('profiles');

-- -----------------------------------------------------------------------------
-- roles
-- -----------------------------------------------------------------------------
create table public.roles (
  id          uuid primary key default gen_random_uuid(),
  key         extensions.citext not null unique,
  name        text not null,
  description text,
  -- System roles back the authorization model and must never be deleted.
  is_system   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.roles is
  'Named roles: super_admin, admin, editor, author, reviewer, student.';

-- -----------------------------------------------------------------------------
-- permissions
-- -----------------------------------------------------------------------------
create table public.permissions (
  id          uuid primary key default gen_random_uuid(),
  key         extensions.citext not null unique,
  description text,
  -- Grouping used by the admin UI, e.g. 'scholarship', 'article', 'settings'.
  category    text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- role_permissions
-- -----------------------------------------------------------------------------
create table public.role_permissions (
  role_id       uuid not null references public.roles (id) on delete cascade,
  permission_id uuid not null references public.permissions (id) on delete cascade,
  primary key (role_id, permission_id)
);

create index role_permissions_permission_idx
  on public.role_permissions (permission_id);

-- -----------------------------------------------------------------------------
-- user_roles
-- -----------------------------------------------------------------------------
create table public.user_roles (
  user_id     uuid not null references auth.users (id) on delete cascade,
  role_id     uuid not null references public.roles (id) on delete cascade,
  granted_by  uuid references auth.users (id) on delete set null,
  granted_at  timestamptz not null default now(),
  primary key (user_id, role_id)
);

create index user_roles_role_idx on public.user_roles (role_id);

comment on table public.user_roles is
  'Roles assigned to a user. A user may hold several roles.';

-- -----------------------------------------------------------------------------
-- profiles -> roles convenience view
--
-- security_invoker = true means the view executes with the caller's privileges,
-- so the RLS policies on the underlying tables still apply to it. Without this,
-- a view would run as its owner and silently bypass RLS.
-- -----------------------------------------------------------------------------
create view public.user_role_summary
with (security_invoker = true) as
  select
    p.id      as user_id,
    p.email,
    p.full_name,
    p.status,
    coalesce(
      array_agg(r.key order by r.key) filter (where r.key is not null),
      '{}'::text[]
    ) as roles,
    p.created_at
  from public.profiles p
  left join public.user_roles ur on ur.user_id = p.id
  left join public.roles r on r.id = ur.role_id
  group by p.id, p.email, p.full_name, p.status, p.created_at;

comment on view public.user_role_summary is
  'User profile plus the array of role keys assigned to it.';
