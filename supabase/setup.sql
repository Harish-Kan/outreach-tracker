-- Outreach Tracker — complete database setup
-- Generated from supabase/migrations/*.sql. Run once in the Supabase SQL Editor.
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

commit;
