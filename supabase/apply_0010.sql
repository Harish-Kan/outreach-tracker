-- Flagged contacts.
--
-- Purely a visual marker. Unlike is_important, a flag changes no ordering and
-- no filtering — it tints the row so it catches the eye while scrolling past.
-- The two are deliberately separate: "this person matters" and "look at this"
-- are different signals, and collapsing them loses one of them.

alter table public.contacts
  add column is_flagged boolean not null default false;

-- No index on purpose. Nothing sorts or filters on this column, so an index
-- would only add write cost.
