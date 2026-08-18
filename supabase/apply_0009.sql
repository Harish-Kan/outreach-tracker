-- Run this ONCE in the Supabase SQL Editor.
-- Applies migration 0009. Adds one function; no tables or data change.

begin;

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

commit;
