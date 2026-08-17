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
