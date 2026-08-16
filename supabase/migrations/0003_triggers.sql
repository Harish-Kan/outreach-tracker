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
