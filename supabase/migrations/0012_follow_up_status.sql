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
