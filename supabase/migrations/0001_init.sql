-- Outreach Tracker — schema
--
-- Everything lives inside a workspace. A solo user is a workspace with one
-- member, so there is no separate code path for "solo mode".

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type workspace_type as enum ('personal', 'team');

create type member_role as enum ('owner', 'admin', 'member');

create type contact_status as enum (
  'added',           -- in the list, nobody has contacted them
  'reached_out',     -- owner has sent a message
  'responded',       -- they replied, conversation live
  'chat_booked',     -- date is set
  'chat_completed',  -- done, notes logged
  'no_response',     -- went cold, may follow up
  'not_interested'   -- closed
);

create type interaction_type as enum (
  'reached_out',
  'follow_up_sent',
  'replied',
  'chat_booked',
  'chat_completed',
  'marked_no_response',
  'marked_not_interested',
  'note_added',
  'ownership_changed'
);

-- ---------------------------------------------------------------------------
-- profiles — mirrors auth.users with app-level fields
-- ---------------------------------------------------------------------------

create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text,
  email      text,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- workspaces
-- ---------------------------------------------------------------------------

create table public.workspaces (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  type       workspace_type not null default 'personal',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- memberships
-- ---------------------------------------------------------------------------

create table public.memberships (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  role         member_role not null default 'member',
  joined_at    timestamptz not null default now(),
  unique (user_id, workspace_id)
);

-- is_member_of() filters on user_id first; the unique index above covers
-- (user_id, workspace_id) but a workspace-first index serves member listings.
create index memberships_workspace_id_idx on public.memberships (workspace_id);

-- ---------------------------------------------------------------------------
-- invites
-- ---------------------------------------------------------------------------

create table public.invites (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  code         text not null unique,
  created_by   uuid references public.profiles (id) on delete set null,
  role_granted member_role not null default 'member',
  expires_at   timestamptz not null default now() + interval '7 days',
  max_uses     int not null default 25,
  uses_count   int not null default 0,
  revoked_at   timestamptz,
  created_at   timestamptz not null default now()
);

create index invites_workspace_id_idx on public.invites (workspace_id);

-- ---------------------------------------------------------------------------
-- contacts
-- ---------------------------------------------------------------------------

create table public.contacts (
  id                      uuid primary key default gen_random_uuid(),
  workspace_id            uuid not null references public.workspaces (id) on delete cascade,
  first_name              text not null,
  last_name               text not null,
  linkedin_url            text not null,
  linkedin_url_normalized text not null,
  company                 text,
  title                   text,
  email                   text,
  notes                   text,
  status                  contact_status not null default 'added',
  owner_id                uuid references public.profiles (id) on delete set null,
  created_by              uuid not null references public.profiles (id),
  last_activity_at        timestamptz not null default now(),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  -- normalizeLinkedInUrl() in lib/linkedin.ts is the single source of truth for
  -- this value. This constraint does not re-implement it; it just stops a
  -- malformed value from reaching the unique index below, where it would sit
  -- unmatched forever and silently defeat duplicate detection.
  constraint contacts_linkedin_url_normalized_shape
    check (linkedin_url_normalized ~ '^linkedin\.com/in/[^/?#[:space:]]+$')
);

-- The single most important constraint in the schema: one person, one row,
-- per workspace. Duplicate handling is a hard block (spec §7.2), so the
-- server action catches 23505 and shows the existing contact instead.
create unique index contacts_workspace_linkedin_key
  on public.contacts (workspace_id, linkedin_url_normalized);

create index contacts_workspace_status_idx        on public.contacts (workspace_id, status);
create index contacts_workspace_owner_idx         on public.contacts (workspace_id, owner_id);
create index contacts_workspace_last_activity_idx on public.contacts (workspace_id, last_activity_at desc);

-- ---------------------------------------------------------------------------
-- interactions — append-only history
-- ---------------------------------------------------------------------------

create table public.interactions (
  id           uuid primary key default gen_random_uuid(),
  contact_id   uuid not null references public.contacts (id) on delete cascade,
  -- Denormalized so RLS does not need a join back to contacts.
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id      uuid not null references public.profiles (id),
  type         interaction_type not null,
  note         text,
  occurred_at  timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

create index interactions_contact_occurred_idx on public.interactions (contact_id, occurred_at desc);
create index interactions_workspace_idx        on public.interactions (workspace_id);
