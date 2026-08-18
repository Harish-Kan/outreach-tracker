-- Workspace notepad.
--
-- Scratch notes that belong to the workspace rather than to any one contact:
-- "ask the RBC recruiter about the new grad track", "Amara is covering Stripe
-- this week". Contact-specific history stays in interactions, which is
-- append-only; these are editable because a reminder that cannot be corrected
-- is worse than no reminder.

create type note_visibility as enum ('private', 'public');

create table public.notes (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  author_id    uuid not null references public.profiles (id) on delete cascade,
  body         text not null check (
                 length(btrim(body)) > 0 and length(body) <= 2000
               ),
  -- Private by default. Someone who mistakes the toggle should end up with a
  -- note only they can see, not one the whole team can.
  visibility   note_visibility not null default 'private',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- The panel lists newest first, filtered to one workspace.
create index notes_workspace_created_idx
  on public.notes (workspace_id, created_at desc);

create trigger notes_set_updated_at
  before update on public.notes
  for each row execute function public.set_updated_at();

alter table public.notes enable row level security;

-- The whole point of the feature, and the only place it is enforced. A private
-- note is invisible to everyone but its author even if a query forgets to
-- filter, because the filter lives here rather than in application code.
create policy notes_select on public.notes
  for select
  using (
    public.is_member_of(workspace_id)
    and (visibility = 'public' or author_id = auth.uid())
  );

-- author_id is pinned to the caller so a note cannot be written under
-- somebody else's name.
create policy notes_insert on public.notes
  for insert
  with check (public.is_member_of(workspace_id) and author_id = auth.uid());

-- Only the author edits or deletes, including flipping the visibility. A
-- teammate cannot make someone's private note public.
create policy notes_update on public.notes
  for update
  using (author_id = auth.uid() and public.is_member_of(workspace_id))
  with check (author_id = auth.uid() and public.is_member_of(workspace_id));

create policy notes_delete on public.notes
  for delete
  using (author_id = auth.uid() and public.is_member_of(workspace_id));
