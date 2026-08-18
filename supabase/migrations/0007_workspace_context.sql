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
