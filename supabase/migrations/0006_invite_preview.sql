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
