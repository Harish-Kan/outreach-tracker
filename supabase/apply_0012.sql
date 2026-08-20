-- Run this ONCE in the Supabase SQL Editor. Applies migration 0012.
--
-- IF YOU GET "unsafe use of new value ... of enum type": Postgres will not let
-- a new enum value be used in the same transaction that added it, and the SQL
-- editor sometimes wraps a paste in one. Run the two ALTER TYPE lines below on
-- their own first, then run the rest as a second query. Nothing is lost either
-- way; both halves are safe to re-run.

-- ---------------------------------------------------------------------------
-- Step 1: the new enum values
-- ---------------------------------------------------------------------------

alter type contact_status add value if not exists 'follow_up_needed' after 'chat_completed';

alter type interaction_type add value if not exists 'marked_follow_up' after 'chat_completed';

-- ---------------------------------------------------------------------------
-- Step 2: teach advance_contact_status about them
--
-- Re-created only to add the new case arm; everything else is unchanged from
-- migration 0004. Without this, advancing to the new status falls through to
-- the generic 'note_added' and the timeline loses what actually happened.
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
