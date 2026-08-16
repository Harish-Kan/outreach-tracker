-- Contact writes
--
-- These are SECURITY INVOKER (the default) on purpose: RLS still applies, so
-- a member can only touch contacts in a workspace they belong to. They exist
-- to make "status change + interaction row" atomic — a status that changed
-- without a history entry is a bug (spec §10).

-- ---------------------------------------------------------------------------
-- create_contact
--
-- A unique violation (23505) on (workspace_id, linkedin_url_normalized)
-- propagates to the caller, which catches it and shows the existing contact.
-- That is the hard block from spec §7.2.
-- ---------------------------------------------------------------------------

create or replace function public.create_contact(
  p_workspace_id            uuid,
  p_first_name              text,
  p_last_name               text,
  p_linkedin_url            text,
  p_linkedin_url_normalized text,
  p_company                 text,
  p_title                   text,
  p_email                   text,
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
    company, title, email, notes,
    status, owner_id, created_by
  ) values (
    p_workspace_id, p_first_name, p_last_name,
    p_linkedin_url, p_linkedin_url_normalized,
    p_company, p_title, p_email, p_notes,
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

revoke execute on function public.create_contact(uuid, text, text, text, text, text, text, text, text, boolean) from public, anon;
revoke execute on function public.advance_contact_status(uuid, contact_status, text) from public, anon;
revoke execute on function public.log_contact_note(uuid, text)                        from public, anon;
revoke execute on function public.take_contact_ownership(uuid)                        from public, anon;

grant execute on function public.create_contact(uuid, text, text, text, text, text, text, text, text, boolean) to authenticated;
grant execute on function public.advance_contact_status(uuid, contact_status, text) to authenticated;
grant execute on function public.log_contact_note(uuid, text)                        to authenticated;
grant execute on function public.take_contact_ownership(uuid)                        to authenticated;
