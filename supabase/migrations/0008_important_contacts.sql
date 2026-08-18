-- Pinned contacts.
--
-- An important contact sorts above everything else regardless of the ordering
-- the user picked, so the people who matter never scroll off the top.

alter table public.contacts
  add column is_important boolean not null default false;

-- Partial index: only the pinned rows are worth indexing, and they are the
-- ones every sort has to pull to the front.
create index contacts_workspace_important_idx
  on public.contacts (workspace_id)
  where is_important;
