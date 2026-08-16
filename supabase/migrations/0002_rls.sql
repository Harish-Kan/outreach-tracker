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
