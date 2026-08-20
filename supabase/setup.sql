-- Outreach Tracker — complete database setup
-- Generated from supabase/migrations/*.sql. For a FRESH project only.
-- If you already ran an earlier version, run the individual migration you
-- are missing instead — this file recreates everything from scratch.
-- Wrapped in a transaction: if any statement fails, nothing is applied.

begin;

-- ===========================================================================
-- 0001_init.sql
-- ===========================================================================

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
  -- Either identifier will do, but at least one is required. See the
  -- contacts_requires_an_identifier constraint below.
  linkedin_url            text,
  linkedin_url_normalized text,
  email                   text,
  email_normalized        text,
  company                 text,
  title                   text,
  notes                   text,
  status                  contact_status not null default 'added',
  owner_id                uuid references public.profiles (id) on delete set null,
  created_by              uuid not null references public.profiles (id),
  last_activity_at        timestamptz not null default now(),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  -- normalizeLinkedInUrl() and normalizeEmail() in lib/ are the single source
  -- of truth for these values. These constraints do not re-implement them; they
  -- stop a malformed value from reaching the unique indexes below, where it
  -- would sit unmatched forever and silently defeat duplicate detection.
  constraint contacts_linkedin_url_normalized_shape
    check (linkedin_url_normalized is null
           or linkedin_url_normalized ~ '^linkedin\.com/in/[^/?#[:space:]]+$'),

  constraint contacts_email_normalized_shape
    check (email_normalized is null
           or email_normalized ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),

  -- A contact with neither identifier cannot be deduplicated against anything,
  -- which defeats the purpose of the app. One or the other is required.
  constraint contacts_requires_an_identifier
    check (linkedin_url_normalized is not null or email_normalized is not null),

  -- Raw and normalized columns are populated together or not at all.
  constraint contacts_linkedin_pair
    check ((linkedin_url is null) = (linkedin_url_normalized is null)),

  constraint contacts_email_pair
    check ((email is null) = (email_normalized is null))
);

-- The most important constraints in the schema: one person, one row, per
-- workspace. Duplicate handling is a hard block (spec §7.2), so the server
-- action catches 23505 and shows the existing contact instead.
--
-- Postgres treats NULLs as distinct in a unique index, so any number of
-- contacts may omit either identifier — they just are not deduplicated on the
-- one they omit.
create unique index contacts_workspace_linkedin_key
  on public.contacts (workspace_id, linkedin_url_normalized);

create unique index contacts_workspace_email_key
  on public.contacts (workspace_id, email_normalized);

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

-- ===========================================================================
-- 0002_rls.sql
-- ===========================================================================

-- Row Level Security
--
-- The rule is the same shape everywhere: a row is visible if the requesting
-- user has a membership in that row's workspace. RLS is the security boundary
-- for this app — nothing in the browser is trusted.

-- ---------------------------------------------------------------------------
-- Helpers
--
-- All three are `security definer` so they read `memberships` without
-- re-entering the policies defined on `memberships`, which would recurse.
-- ---------------------------------------------------------------------------

create or replace function public.is_member_of(ws uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from memberships
    where memberships.workspace_id = ws
      and memberships.user_id = auth.uid()
  );
$$;

-- Used by the profiles select policy: you can see the profile of anyone you
-- share a workspace with, so contact owners render as names rather than uuids.
create or replace function public.shares_workspace_with(other uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from memberships mine
    join memberships theirs on theirs.workspace_id = mine.workspace_id
    where mine.user_id = auth.uid()
      and theirs.user_id = other
  );
$$;

create or replace function public.has_workspace_role(ws uuid, roles member_role[])
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from memberships
    where memberships.workspace_id = ws
      and memberships.user_id = auth.uid()
      and memberships.role = any (roles)
  );
$$;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------

alter table public.profiles     enable row level security;
alter table public.workspaces   enable row level security;
alter table public.memberships  enable row level security;
alter table public.invites      enable row level security;
alter table public.contacts     enable row level security;
alter table public.interactions enable row level security;

-- ---------------------------------------------------------------------------
-- profiles
-- Insert is deliberately absent: rows arrive only via the security definer
-- trigger on auth.users.
-- ---------------------------------------------------------------------------

create policy "profiles are visible to self and workspace peers"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_workspace_with(id));

create policy "users update their own profile"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- workspaces
-- ---------------------------------------------------------------------------

create policy "members read their workspaces"
  on public.workspaces for select to authenticated
  using (public.is_member_of(id));

create policy "authenticated users create workspaces"
  on public.workspaces for insert to authenticated
  with check (created_by = auth.uid());

create policy "owners and admins update the workspace"
  on public.workspaces for update to authenticated
  using (public.has_workspace_role(id, array['owner', 'admin']::member_role[]))
  with check (public.has_workspace_role(id, array['owner', 'admin']::member_role[]));

create policy "owners delete the workspace"
  on public.workspaces for delete to authenticated
  using (public.has_workspace_role(id, array['owner']::member_role[]));

-- ---------------------------------------------------------------------------
-- memberships
-- Joining a workspace you are not yet a member of goes through the
-- redeem_invite() RPC, which is security definer.
-- ---------------------------------------------------------------------------

create policy "members read the member list"
  on public.memberships for select to authenticated
  using (public.is_member_of(workspace_id));

create policy "owners and admins add members"
  on public.memberships for insert to authenticated
  with check (public.has_workspace_role(workspace_id, array['owner', 'admin']::member_role[]));

create policy "owners and admins change roles"
  on public.memberships for update to authenticated
  using (public.has_workspace_role(workspace_id, array['owner', 'admin']::member_role[]))
  with check (public.has_workspace_role(workspace_id, array['owner', 'admin']::member_role[]));

create policy "members leave, owners and admins remove"
  on public.memberships for delete to authenticated
  using (
    user_id = auth.uid()
    or public.has_workspace_role(workspace_id, array['owner', 'admin']::member_role[])
  );

-- ---------------------------------------------------------------------------
-- invites
-- ---------------------------------------------------------------------------

create policy "owners and admins read invites"
  on public.invites for select to authenticated
  using (public.has_workspace_role(workspace_id, array['owner', 'admin']::member_role[]));

create policy "owners and admins create invites"
  on public.invites for insert to authenticated
  with check (
    public.has_workspace_role(workspace_id, array['owner', 'admin']::member_role[])
    and created_by = auth.uid()
  );

create policy "owners and admins update invites"
  on public.invites for update to authenticated
  using (public.has_workspace_role(workspace_id, array['owner', 'admin']::member_role[]))
  with check (public.has_workspace_role(workspace_id, array['owner', 'admin']::member_role[]));

create policy "owners and admins delete invites"
  on public.invites for delete to authenticated
  using (public.has_workspace_role(workspace_id, array['owner', 'admin']::member_role[]));

-- ---------------------------------------------------------------------------
-- contacts
-- Notes are readable by every member of the workspace (spec §7.1, full
-- visibility) — there is no separate policy hiding the notes column.
-- ---------------------------------------------------------------------------

create policy "members read workspace contacts"
  on public.contacts for select to authenticated
  using (public.is_member_of(workspace_id));

create policy "members add contacts"
  on public.contacts for insert to authenticated
  with check (public.is_member_of(workspace_id) and created_by = auth.uid());

-- Any member may update, which is what makes ownership takeover possible.
-- workspace_id is held immutable by a trigger, not by this policy.
create policy "members update workspace contacts"
  on public.contacts for update to authenticated
  using (public.is_member_of(workspace_id))
  with check (public.is_member_of(workspace_id));

create policy "owners and workspace admins delete contacts"
  on public.contacts for delete to authenticated
  using (
    public.is_member_of(workspace_id)
    and (
      owner_id = auth.uid()
      or public.has_workspace_role(workspace_id, array['owner', 'admin']::member_role[])
    )
  );

-- ---------------------------------------------------------------------------
-- interactions — append only. No update or delete policy exists, so a mistake
-- gets a corrective entry rather than an edit.
-- ---------------------------------------------------------------------------

create policy "members read workspace interactions"
  on public.interactions for select to authenticated
  using (public.is_member_of(workspace_id));

create policy "members log their own interactions"
  on public.interactions for insert to authenticated
  with check (public.is_member_of(workspace_id) and user_id = auth.uid());

-- ===========================================================================
-- 0003_triggers.sql
-- ===========================================================================

-- Triggers and RPCs

-- ---------------------------------------------------------------------------
-- Signup: profile + personal workspace + owner membership, in one transaction.
-- A new user can add a contact immediately, with zero setup.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  display_name text;
  new_workspace_id uuid;
begin
  display_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    split_part(new.email, '@', 1)
  );

  insert into public.profiles (id, full_name, email)
  values (new.id, display_name, new.email);

  insert into public.workspaces (name, type, created_by)
  values (display_name || '''s Workspace', 'personal', new.id)
  returning id into new_workspace_id;

  insert into public.memberships (user_id, workspace_id, role)
  values (new.id, new_workspace_id, 'owner');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- contacts.workspace_id is immutable. No cross-workspace data movement (spec
-- §3) — the answer to wanting it is CSV export plus CSV import, not a merge.
-- ---------------------------------------------------------------------------

create or replace function public.prevent_workspace_change()
returns trigger
language plpgsql
as $$
begin
  if new.workspace_id is distinct from old.workspace_id then
    raise exception 'workspace_id is immutable';
  end if;
  return new;
end;
$$;

create trigger contacts_workspace_id_immutable
  before update on public.contacts
  for each row execute function public.prevent_workspace_change();

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger contacts_set_updated_at
  before update on public.contacts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Logging an interaction bumps the contact's last_activity_at, which is what
-- the "needs follow-up" bucket reads. Done in the database so no server action
-- can forget it. greatest() keeps a backdated entry from pulling activity
-- backwards.
-- ---------------------------------------------------------------------------

create or replace function public.bump_contact_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.contacts
  set last_activity_at = greatest(last_activity_at, new.occurred_at)
  where id = new.contact_id;
  return new;
end;
$$;

create trigger interactions_bump_contact_activity
  after insert on public.interactions
  for each row execute function public.bump_contact_activity();

-- ---------------------------------------------------------------------------
-- Workspace creation
--
-- Needed as an RPC because of a chicken-and-egg problem: the memberships
-- insert policy requires owner/admin on the workspace, which the creator does
-- not hold until their owner membership exists.
-- ---------------------------------------------------------------------------

create or replace function public.create_team_workspace(workspace_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_workspace_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if coalesce(trim(workspace_name), '') = '' then
    raise exception 'workspace name is required' using errcode = '22023';
  end if;

  insert into public.workspaces (name, type, created_by)
  values (trim(workspace_name), 'team', auth.uid())
  returning id into new_workspace_id;

  insert into public.memberships (user_id, workspace_id, role)
  values (auth.uid(), new_workspace_id, 'owner');

  return new_workspace_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Invite codes
-- ---------------------------------------------------------------------------

-- Ambiguous characters (i, l, o, 0, 1) are left out so codes survive being
-- read aloud or retyped.
create or replace function public.gen_invite_code()
returns text
language sql
volatile
as $$
  select string_agg(
    substr('abcdefghjkmnpqrstuvwxyz23456789', floor(random() * 31)::int + 1, 1),
    ''
  )
  from generate_series(1, 10);
$$;

alter table public.invites alter column code set default public.gen_invite_code();

-- Redeeming needs security definer: the joining user is not a member yet, so
-- the invites select policy would hide the row from them.
create or replace function public.redeem_invite(invite_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  invite public.invites;
  rows_inserted int;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select * into invite
  from public.invites
  where code = invite_code
  for update;

  if not found then
    raise exception 'invite not found' using errcode = '22023';
  end if;

  if invite.revoked_at is not null then
    raise exception 'invite has been revoked' using errcode = '22023';
  end if;

  if invite.expires_at <= now() then
    raise exception 'invite has expired' using errcode = '22023';
  end if;

  if invite.uses_count >= invite.max_uses then
    raise exception 'invite has no uses left' using errcode = '22023';
  end if;

  insert into public.memberships (user_id, workspace_id, role)
  values (auth.uid(), invite.workspace_id, invite.role_granted)
  on conflict (user_id, workspace_id) do nothing;

  get diagnostics rows_inserted = row_count;

  -- Re-redeeming as an existing member is a no-op, not a consumed use.
  if rows_inserted > 0 then
    update public.invites
    set uses_count = uses_count + 1
    where id = invite.id;
  end if;

  return invite.workspace_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants — these RPCs are for signed-in users only.
-- ---------------------------------------------------------------------------

revoke execute on function public.create_team_workspace(text) from public, anon;
revoke execute on function public.redeem_invite(text)         from public, anon;
revoke execute on function public.gen_invite_code()           from public, anon;

grant execute on function public.create_team_workspace(text) to authenticated;
grant execute on function public.redeem_invite(text)         to authenticated;

-- ===========================================================================
-- 0004_contact_rpcs.sql
-- ===========================================================================

-- Contact writes
--
-- These are SECURITY INVOKER (the default) on purpose: RLS still applies, so
-- a member can only touch contacts in a workspace they belong to. They exist
-- to make "status change + interaction row" atomic — a status that changed
-- without a history entry is a bug (spec §10).

-- ---------------------------------------------------------------------------
-- create_contact
--
-- A unique violation (23505) on either (workspace_id, linkedin_url_normalized)
-- or (workspace_id, email_normalized) propagates to the caller, which catches
-- it and shows the existing contact. That is the hard block from spec §7.2.
-- ---------------------------------------------------------------------------

create or replace function public.create_contact(
  p_workspace_id            uuid,
  p_first_name              text,
  p_last_name               text,
  p_linkedin_url            text,
  p_linkedin_url_normalized text,
  p_email                   text,
  p_email_normalized        text,
  p_company                 text,
  p_title                   text,
  p_notes                   text,
  p_mark_reached_out        boolean
)
returns uuid
language plpgsql
as $$
declare
  new_contact_id uuid;
begin
  insert into public.contacts (
    workspace_id, first_name, last_name,
    linkedin_url, linkedin_url_normalized,
    email, email_normalized,
    company, title, notes,
    status, owner_id, created_by
  ) values (
    p_workspace_id, p_first_name, p_last_name,
    p_linkedin_url, p_linkedin_url_normalized,
    p_email, p_email_normalized,
    p_company, p_title, p_notes,
    case when p_mark_reached_out then 'reached_out' else 'added' end::contact_status,
    case when p_mark_reached_out then auth.uid() else null end,
    auth.uid()
  )
  returning id into new_contact_id;

  -- Logging the first outreach is what claims ownership, so the interaction
  -- row and the owner_id above have to land together.
  if p_mark_reached_out then
    insert into public.interactions (contact_id, workspace_id, user_id, type)
    values (new_contact_id, p_workspace_id, auth.uid(), 'reached_out');
  end if;

  return new_contact_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- advance_contact_status
-- ---------------------------------------------------------------------------

create or replace function public.advance_contact_status(
  p_contact_id uuid,
  p_status     contact_status,
  p_note       text default null
)
returns void
language plpgsql
as $$
declare
  contact          public.contacts;
  interaction_kind interaction_type;
begin
  select * into contact from public.contacts where id = p_contact_id;

  if not found then
    raise exception 'contact not found' using errcode = '22023';
  end if;

  interaction_kind := case p_status
    -- Coming back from cold is a follow-up, not a first touch.
    when 'reached_out'    then case when contact.status = 'no_response'
                                    then 'follow_up_sent' else 'reached_out' end
    when 'responded'      then 'replied'
    when 'chat_booked'    then 'chat_booked'
    when 'chat_completed' then 'chat_completed'
    when 'no_response'    then 'marked_no_response'
    when 'not_interested' then 'marked_not_interested'
    else 'note_added'
  end::interaction_type;

  update public.contacts
  set status = p_status,
      -- Whoever logs the first outreach becomes the owner (spec §3).
      owner_id = coalesce(owner_id, auth.uid())
  where id = p_contact_id;

  insert into public.interactions (contact_id, workspace_id, user_id, type, note)
  values (p_contact_id, contact.workspace_id, auth.uid(), interaction_kind,
          nullif(trim(coalesce(p_note, '')), ''));
end;
$$;

-- ---------------------------------------------------------------------------
-- log_contact_note — append a note without changing status
-- ---------------------------------------------------------------------------

create or replace function public.log_contact_note(
  p_contact_id uuid,
  p_note       text
)
returns void
language plpgsql
as $$
declare
  contact_workspace_id uuid;
begin
  if coalesce(trim(p_note), '') = '' then
    raise exception 'note is required' using errcode = '22023';
  end if;

  select workspace_id into contact_workspace_id
  from public.contacts where id = p_contact_id;

  if not found then
    raise exception 'contact not found' using errcode = '22023';
  end if;

  insert into public.interactions (contact_id, workspace_id, user_id, type, note)
  values (p_contact_id, contact_workspace_id, auth.uid(), 'note_added', trim(p_note));
end;
$$;

-- ---------------------------------------------------------------------------
-- take_contact_ownership
-- ---------------------------------------------------------------------------

create or replace function public.take_contact_ownership(p_contact_id uuid)
returns void
language plpgsql
as $$
declare
  contact public.contacts;
begin
  select * into contact from public.contacts where id = p_contact_id;

  if not found then
    raise exception 'contact not found' using errcode = '22023';
  end if;

  if contact.owner_id = auth.uid() then
    return; -- already yours, nothing to record
  end if;

  update public.contacts set owner_id = auth.uid() where id = p_contact_id;

  insert into public.interactions (contact_id, workspace_id, user_id, type, note)
  values (
    p_contact_id, contact.workspace_id, auth.uid(), 'ownership_changed',
    case
      when contact.owner_id is null then 'Claimed an unowned contact'
      else 'Took over from a previous owner'
    end
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke execute on function public.create_contact(uuid, text, text, text, text, text, text, text, text, text, boolean) from public, anon;
revoke execute on function public.advance_contact_status(uuid, contact_status, text) from public, anon;
revoke execute on function public.log_contact_note(uuid, text)                        from public, anon;
revoke execute on function public.take_contact_ownership(uuid)                        from public, anon;

grant execute on function public.create_contact(uuid, text, text, text, text, text, text, text, text, text, boolean) to authenticated;
grant execute on function public.advance_contact_status(uuid, contact_status, text) to authenticated;
grant execute on function public.log_contact_note(uuid, text)                        to authenticated;
grant execute on function public.take_contact_ownership(uuid)                        to authenticated;

-- ===========================================================================
-- 0005_single_name_and_edit.sql
-- ===========================================================================

-- Merge first_name/last_name into a single name field, and add editing.
--
-- Splitting names assumes a structure many real names do not have — mononyms,
-- multiple family names, names where the given name is not first. One field
-- stores what the user actually typed.

-- ---------------------------------------------------------------------------
-- contacts.name
-- ---------------------------------------------------------------------------

alter table public.contacts add column name text;

-- Backfill before the old columns go away. Existing rows have both parts.
update public.contacts
set name = btrim(coalesce(first_name, '') || ' ' || coalesce(last_name, ''));

alter table public.contacts alter column name set not null;

alter table public.contacts
  add constraint contacts_name_not_blank check (btrim(name) <> '');

alter table public.contacts drop column first_name;
alter table public.contacts drop column last_name;

-- ---------------------------------------------------------------------------
-- create_contact — replaced because the argument list changed. The old
-- signature has to be dropped explicitly or Postgres keeps it as an overload.
-- ---------------------------------------------------------------------------

drop function if exists public.create_contact(
  uuid, text, text, text, text, text, text, text, text, text, boolean
);

create or replace function public.create_contact(
  p_workspace_id            uuid,
  p_name                    text,
  p_linkedin_url            text,
  p_linkedin_url_normalized text,
  p_email                   text,
  p_email_normalized        text,
  p_company                 text,
  p_title                   text,
  p_notes                   text,
  p_mark_reached_out        boolean
)
returns uuid
language plpgsql
as $$
declare
  new_contact_id uuid;
begin
  insert into public.contacts (
    workspace_id, name,
    linkedin_url, linkedin_url_normalized,
    email, email_normalized,
    company, title, notes,
    status, owner_id, created_by
  ) values (
    p_workspace_id, btrim(p_name),
    p_linkedin_url, p_linkedin_url_normalized,
    p_email, p_email_normalized,
    p_company, p_title, p_notes,
    case when p_mark_reached_out then 'reached_out' else 'added' end::contact_status,
    case when p_mark_reached_out then auth.uid() else null end,
    auth.uid()
  )
  returning id into new_contact_id;

  -- Logging the first outreach is what claims ownership, so the interaction
  -- row and the owner_id above have to land together.
  if p_mark_reached_out then
    insert into public.interactions (contact_id, workspace_id, user_id, type)
    values (new_contact_id, p_workspace_id, auth.uid(), 'reached_out');
  end if;

  return new_contact_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- update_contact
--
-- Details only. Status and ownership have their own RPCs so that every change
-- to them keeps writing an interaction row; editing a company name is not
-- outreach and does not belong in the timeline.
--
-- A unique violation (23505) propagates exactly as it does on insert, so
-- editing someone onto another contact's LinkedIn URL or email is blocked the
-- same way adding them would be.
-- ---------------------------------------------------------------------------

create or replace function public.update_contact(
  p_contact_id              uuid,
  p_name                    text,
  p_linkedin_url            text,
  p_linkedin_url_normalized text,
  p_email                   text,
  p_email_normalized        text,
  p_company                 text,
  p_title                   text,
  p_notes                   text
)
returns void
language plpgsql
as $$
begin
  update public.contacts
  set name                    = btrim(p_name),
      linkedin_url            = p_linkedin_url,
      linkedin_url_normalized = p_linkedin_url_normalized,
      email                   = p_email,
      email_normalized        = p_email_normalized,
      company                 = p_company,
      title                   = p_title,
      notes                   = p_notes
  where id = p_contact_id;

  if not found then
    raise exception 'contact not found' using errcode = '22023';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke execute on function public.create_contact(uuid, text, text, text, text, text, text, text, text, boolean) from public, anon;
revoke execute on function public.update_contact(uuid, text, text, text, text, text, text, text, text)           from public, anon;

grant execute on function public.create_contact(uuid, text, text, text, text, text, text, text, text, boolean) to authenticated;
grant execute on function public.update_contact(uuid, text, text, text, text, text, text, text, text)           to authenticated;

-- ===========================================================================
-- 0006_invite_preview.sql
-- ===========================================================================

-- Invite preview
--
-- The join page has to show "Join Harish's Workspace?" before the user is a
-- member — but until they are, RLS hides both the invite and the workspace.
-- Hence security definer, same reason redeem_invite needs it.
--
-- This deliberately reveals a workspace name to anyone holding the code. That
-- is the point of the code.

create or replace function public.preview_invite(invite_code text)
returns table (workspace_name text, invite_status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  invite public.invites;
  workspace public.workspaces;
begin
  select * into invite from public.invites where code = invite_code;

  if not found then
    return query select null::text, 'not_found'::text;
    return;
  end if;

  select * into workspace from public.workspaces where id = invite.workspace_id;

  if invite.revoked_at is not null then
    return query select workspace.name, 'revoked'::text;
  elsif invite.expires_at <= now() then
    return query select workspace.name, 'expired'::text;
  elsif invite.uses_count >= invite.max_uses then
    return query select workspace.name, 'exhausted'::text;
  else
    return query select workspace.name, 'valid'::text;
  end if;
end;
$$;

-- Readable before sign-in so the join page can say which workspace is being
-- offered, then send the user to sign up.
grant execute on function public.preview_invite(text) to anon, authenticated;

-- ===========================================================================
-- 0007_workspace_context.sql
-- ===========================================================================

-- One round trip for the workspace context.
--
-- Resolving the active workspace previously took four sequential requests --
-- auth.getUser, memberships, workspaces, member count -- and every page waited
-- on all of them before rendering a byte. This returns the lot in one call.
--
-- security definer with an explicit auth.uid() filter: the function only ever
-- returns rows for the calling user, and PostgREST has already verified the
-- JWT signature before auth.uid() resolves.

create or replace function public.workspace_context()
returns table (
  user_id      uuid,
  workspace_id uuid,
  name         text,
  type         workspace_type,
  created_by   uuid,
  created_at   timestamptz,
  role         member_role,
  member_count bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select
    auth.uid(),
    w.id,
    w.name,
    w.type,
    w.created_by,
    w.created_at,
    m.role,
    (select count(*) from memberships peers where peers.workspace_id = w.id)
  from memberships m
  join workspaces w on w.id = m.workspace_id
  where m.user_id = auth.uid()
  order by m.joined_at asc;
$$;

revoke execute on function public.workspace_context() from public, anon;
grant execute on function public.workspace_context() to authenticated;

-- ===========================================================================
-- 0008_important_contacts.sql
-- ===========================================================================

-- Pinned contacts.
--
-- An important contact sorts above everything else regardless of the ordering
-- the user picked, so the people who matter never scroll off the top.

alter table public.contacts
  add column is_important boolean not null default false;

-- Partial index: only the pinned rows are worth indexing, and they are the
-- ones every sort has to pull to the front.
create index contacts_workspace_important_idx
  on public.contacts (workspace_id)
  where is_important;

-- ===========================================================================
-- 0009_remove_member.sql
-- ===========================================================================

-- Removing someone from a workspace.
--
-- Deleting the membership alone would leave their contacts pointing at an
-- owner_id who can no longer see the workspace: the contact would render as
-- "Unclaimed" while still being unclaimable, because owner_id is set. So this
-- releases their contacts in the same transaction and records why.

create or replace function public.remove_workspace_member(
  p_workspace_id uuid,
  p_user_id      uuid
)
returns integer
language plpgsql
as $$
declare
  target_role       member_role;
  released_contacts integer;
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'You cannot remove yourself from a workspace'
      using errcode = '22023';
  end if;

  if not public.has_workspace_role(
       p_workspace_id, array['owner', 'admin']::member_role[]
     ) then
    raise exception 'Only owners and admins can remove people'
      using errcode = '42501';
  end if;

  select role into target_role
  from public.memberships
  where workspace_id = p_workspace_id and user_id = p_user_id;

  if not found then
    raise exception 'That person is not in this workspace' using errcode = '22023';
  end if;

  -- Removing the owner would leave the workspace with nobody who can
  -- administer or delete it.
  if target_role = 'owner' then
    raise exception 'The workspace owner cannot be removed'
      using errcode = '22023';
  end if;

  -- Logged before the update, while owner_id still identifies their contacts.
  insert into public.interactions (contact_id, workspace_id, user_id, type, note)
  select c.id, c.workspace_id, auth.uid(), 'ownership_changed',
         'Released when their owner was removed from the workspace'
  from public.contacts c
  where c.workspace_id = p_workspace_id
    and c.owner_id = p_user_id;

  update public.contacts
  set owner_id = null
  where workspace_id = p_workspace_id
    and owner_id = p_user_id;

  get diagnostics released_contacts = row_count;

  delete from public.memberships
  where workspace_id = p_workspace_id and user_id = p_user_id;

  return released_contacts;
end;
$$;

revoke execute on function public.remove_workspace_member(uuid, uuid) from public, anon;
grant execute on function public.remove_workspace_member(uuid, uuid) to authenticated;

-- ===========================================================================
-- 0010_flagged_contacts.sql
-- ===========================================================================

-- Flagged contacts.
--
-- Purely a visual marker. Unlike is_important, a flag changes no ordering and
-- no filtering — it tints the row so it catches the eye while scrolling past.
-- The two are deliberately separate: "this person matters" and "look at this"
-- are different signals, and collapsing them loses one of them.

alter table public.contacts
  add column is_flagged boolean not null default false;

-- No index on purpose. Nothing sorts or filters on this column, so an index
-- would only add write cost.

-- ===========================================================================
-- 0011_notes.sql
-- ===========================================================================

-- Workspace notepad.
--
-- Scratch notes that belong to the workspace rather than to any one contact:
-- "ask the RBC recruiter about the new grad track", "Amara is covering Stripe
-- this week". Contact-specific history stays in interactions, which is
-- append-only; these are editable because a reminder that cannot be corrected
-- is worse than no reminder.

create type note_visibility as enum ('private', 'public');

create table public.notes (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  author_id    uuid not null references public.profiles (id) on delete cascade,
  body         text not null check (
                 length(btrim(body)) > 0 and length(body) <= 2000
               ),
  -- Private by default. Someone who mistakes the toggle should end up with a
  -- note only they can see, not one the whole team can.
  visibility   note_visibility not null default 'private',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- The panel lists newest first, filtered to one workspace.
create index notes_workspace_created_idx
  on public.notes (workspace_id, created_at desc);

create trigger notes_set_updated_at
  before update on public.notes
  for each row execute function public.set_updated_at();

alter table public.notes enable row level security;

-- The whole point of the feature, and the only place it is enforced. A private
-- note is invisible to everyone but its author even if a query forgets to
-- filter, because the filter lives here rather than in application code.
create policy notes_select on public.notes
  for select
  using (
    public.is_member_of(workspace_id)
    and (visibility = 'public' or author_id = auth.uid())
  );

-- author_id is pinned to the caller so a note cannot be written under
-- somebody else's name.
create policy notes_insert on public.notes
  for insert
  with check (public.is_member_of(workspace_id) and author_id = auth.uid());

-- Only the author edits or deletes, including flipping the visibility. A
-- teammate cannot make someone's private note public.
create policy notes_update on public.notes
  for update
  using (author_id = auth.uid() and public.is_member_of(workspace_id))
  with check (author_id = auth.uid() and public.is_member_of(workspace_id));

create policy notes_delete on public.notes
  for delete
  using (author_id = auth.uid() and public.is_member_of(workspace_id));

-- ===========================================================================
-- 0012_follow_up_status.sql
-- ===========================================================================

-- "Follow up needed" as a pipeline status.
--
-- Distinct from no_response, which means they went cold on us. This one means
-- the ball is in our court: they replied and we owe them something, or a chat
-- happened and there is an action outstanding. Without it, everyone parks
-- those people in 'responded' and the list stops telling you what to do next.

alter type contact_status add value if not exists 'follow_up_needed' after 'chat_completed';

-- A matching timeline entry, so advancing to the new status does not fall
-- through to the generic 'note_added' and lose what actually happened.
alter type interaction_type add value if not exists 'marked_follow_up' after 'chat_completed';

-- Re-created only to add the new case arm. Everything else is unchanged from
-- migration 0004. Enum literals inside a plpgsql body are resolved at run time,
-- so this is safe in the same transaction that adds the values above.
create or replace function public.advance_contact_status(
  p_contact_id uuid,
  p_status     contact_status,
  p_note       text default null
)
returns void
language plpgsql
as $$
declare
  contact          public.contacts;
  interaction_kind interaction_type;
begin
  select * into contact from public.contacts where id = p_contact_id;

  if not found then
    raise exception 'contact not found' using errcode = '22023';
  end if;

  interaction_kind := case p_status
    -- Coming back from cold is a follow-up, not a first touch.
    when 'reached_out'      then case when contact.status = 'no_response'
                                      then 'follow_up_sent' else 'reached_out' end
    when 'responded'        then 'replied'
    when 'chat_booked'      then 'chat_booked'
    when 'chat_completed'   then 'chat_completed'
    when 'follow_up_needed' then 'marked_follow_up'
    when 'no_response'      then 'marked_no_response'
    when 'not_interested'   then 'marked_not_interested'
    else 'note_added'
  end::interaction_type;

  update public.contacts
  set status = p_status,
      -- Whoever logs the first outreach becomes the owner (spec §3).
      owner_id = coalesce(owner_id, auth.uid())
  where id = p_contact_id;

  insert into public.interactions (contact_id, workspace_id, user_id, type, note)
  values (p_contact_id, contact.workspace_id, auth.uid(), interaction_kind,
          nullif(trim(coalesce(p_note, '')), ''));
end;
$$;

revoke execute on function public.advance_contact_status(uuid, contact_status, text) from public, anon;
grant execute on function public.advance_contact_status(uuid, contact_status, text) to authenticated;

commit;
